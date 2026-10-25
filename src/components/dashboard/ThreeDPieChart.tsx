'use client';

import React, { useState, useMemo } from 'react';

export interface PieSliceData {
  id: string;
  name: string;
  value: number;
  color: string;
  secondaryValue?: string | number;
  unit?: string;
}

interface ThreeDPieChartProps {
  data: PieSliceData[];
  title?: string;
  subtitle?: string;
  depth?: number; // 3D extrusion height in px
  tilt?: number; // 0.4 to 0.7 aspect ratio for ellipse
  height?: number;
  showCenterTotal?: boolean;
  centerLabel?: string;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
}

// 3D Color helpers to compute darker side walls and specular highlights
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default function ThreeDPieChart({
  data = [],
  title,
  subtitle,
  depth = 26,
  tilt = 0.56, // ry = rx * tilt
  height = 320,
  showCenterTotal = true,
  centerLabel,
  valueFormatter = (v) => v.toLocaleString(),
  emptyMessage = 'কোনো তথ্য নেই (No data)',
}: ThreeDPieChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(true);

  // Filter non-zero items
  const validData = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const totalValue = useMemo(() => validData.reduce((acc, d) => acc + d.value, 0), [validData]);

  // Compute angles for each slice (0 rad at 3 o'clock, clockwise)
  const slicesWithAngles = useMemo(() => {
    if (totalValue === 0) return [];

    let currentAngle = -Math.PI / 2; // Start from top (12 o'clock)
    return validData.map((item) => {
      const sliceAngle = (item.value / totalValue) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;
      const percent = Number(((item.value / totalValue) * 100).toFixed(1));

      currentAngle = endAngle;

      return {
        ...item,
        startAngle,
        endAngle,
        midAngle,
        percent,
      };
    });
  }, [validData, totalValue]);

  // Dimensions
  const rx = 130;
  const ry = is3D ? rx * tilt : rx;
  const cx = 190;
  const cy = is3D ? 135 : 160;
  const effectiveDepth = is3D ? depth : 0;

  if (totalValue === 0 || validData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200" style={{ minHeight: height }}>
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
          📊
        </div>
        <p className="text-sm font-medium text-slate-600">{emptyMessage}</p>
        <p className="text-xs text-slate-400 mt-1">এই সময়ে কোনো রেকর্ড নেই</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Chart Top Controls / Legend */}
      {(title || subtitle) && (
        <div className="flex items-center justify-between gap-3 mb-2 px-1">
          <div>
            {title && <h4 className="text-sm font-bold text-slate-800">{title}</h4>}
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => setIs3D(!is3D)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
              is3D
                ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
            title="3D / 2D পরিবর্তন করুন"
          >
            {is3D ? '🧊 3D ভিউ' : '⭕ 2D ভিউ'}
          </button>
        </div>
      )}

      {/* SVG Canvas */}
      <div className="relative w-full flex items-center justify-center select-none" style={{ height }}>
        <svg
          viewBox="0 0 380 320"
          className="w-full h-full max-w-[420px] overflow-visible"
        >
          <defs>
            {/* Soft Floor Shadow */}
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
              <feOffset dx="0" dy="16" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.25" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Slices 3D Gradients */}
            {slicesWithAngles.map((slice) => {
              const topLight = adjustBrightness(slice.color, 18);
              const sideDark = adjustBrightness(slice.color, -32);
              const sideMid = adjustBrightness(slice.color, -16);

              return (
                <React.Fragment key={`grad-${slice.id}`}>
                  {/* Top face gradient with subtle glossy specular highlight */}
                  <linearGradient id={`topGrad-${slice.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={topLight} />
                    <stop offset="100%" stopColor={slice.color} />
                  </linearGradient>

                  {/* 3D Side extrusion cylinder wall gradient */}
                  <linearGradient id={`sideGrad-${slice.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={sideMid} />
                    <stop offset="100%" stopColor={sideDark} />
                  </linearGradient>
                </React.Fragment>
              );
            })}
          </defs>

          {/* 3D Floor Shadow */}
          {is3D && (
            <ellipse
              cx={cx}
              cy={cy + effectiveDepth + 12}
              rx={rx * 0.96}
              ry={ry * 0.82}
              fill="#0f172a"
              opacity="0.14"
              filter="blur(14px)"
            />
          )}

          {/* LAYER 1: 3D Side Walls (Extrusions) */}
          {is3D && (
            <g className="transition-all duration-300">
              {slicesWithAngles.map((slice) => {
                const isHovered = hoveredId === slice.id;
                // Pop-out offset vector along mid-angle
                const popDist = isHovered ? 10 : 0;
                const popX = Math.cos(slice.midAngle) * popDist;
                const popY = Math.sin(slice.midAngle) * popDist * tilt;

                // A cylinder wall is only visible from camera on front half (y > 0 relative to center)
                // In radians, front arc is between 0 and PI.
                // Subdivide the arc to compute front-facing segments
                const start = slice.startAngle;
                const end = slice.endAngle;

                // Approximate front arc extrusion with SVG path
                // Samples points along the slice arc
                const steps = 18;
                const topPoints: Array<[number, number]> = [];
                const botPoints: Array<[number, number]> = [];

                for (let i = 0; i <= steps; i++) {
                  const a = start + (end - start) * (i / steps);
                  const px = cx + rx * Math.cos(a) + popX;
                  const py = cy + ry * Math.sin(a) + popY;
                  topPoints.push([px, py]);
                  botPoints.push([px, py + effectiveDepth]);
                }

                // Check if any point in this arc is on the front side (sin(a) >= -0.05)
                const isFacingFront = topPoints.some(
                  (_, i) => Math.sin(start + (end - start) * (i / steps)) >= -0.05
                );

                if (!isFacingFront) return null;

                // Path for the curved cylindrical outer wall
                let pathD = `M ${topPoints[0][0]} ${topPoints[0][1]} `;
                for (let i = 1; i < topPoints.length; i++) {
                  pathD += `L ${topPoints[i][0]} ${topPoints[i][1]} `;
                }
                pathD += `L ${botPoints[botPoints.length - 1][0]} ${botPoints[botPoints.length - 1][1]} `;
                for (let i = botPoints.length - 2; i >= 0; i--) {
                  pathD += `L ${botPoints[i][0]} ${botPoints[i][1]} `;
                }
                pathD += 'Z';

                return (
                  <path
                    key={`wall-${slice.id}`}
                    d={pathD}
                    fill={`url(#sideGrad-${slice.id})`}
                    stroke={adjustBrightness(slice.color, -38)}
                    strokeWidth="0.6"
                    className="transition-transform duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredId(slice.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              })}
            </g>
          )}

          {/* LAYER 2: Top Surface Faces */}
          <g>
            {slicesWithAngles.map((slice) => {
              const isHovered = hoveredId === slice.id;
              const popDist = isHovered ? 10 : 0;
              const popX = Math.cos(slice.midAngle) * popDist;
              const popY = Math.sin(slice.midAngle) * popDist * (is3D ? tilt : 1);

              // Single slice that is 100% full circle
              if (slice.endAngle - slice.startAngle >= 2 * Math.PI - 0.001) {
                return (
                  <ellipse
                    key={`top-${slice.id}`}
                    cx={cx + popX}
                    cy={cy + popY}
                    rx={rx}
                    ry={ry}
                    fill={`url(#topGrad-${slice.id})`}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? '2.5' : '1.5'}
                    className="transition-all duration-200 cursor-pointer drop-shadow-xs"
                    onMouseEnter={() => setHoveredId(slice.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              }

              // Elliptical arc calculation
              const x1 = cx + rx * Math.cos(slice.startAngle) + popX;
              const y1 = cy + ry * Math.sin(slice.startAngle) + popY;
              const x2 = cx + rx * Math.cos(slice.endAngle) + popX;
              const y2 = cy + ry * Math.sin(slice.endAngle) + popY;
              const centerTargetX = cx + popX;
              const centerTargetY = cy + popY;

              const isLargeArc = slice.endAngle - slice.startAngle > Math.PI ? 1 : 0;

              const pathD = `
                M ${centerTargetX} ${centerTargetY}
                L ${x1} ${y1}
                A ${rx} ${ry} 0 ${isLargeArc} 1 ${x2} ${y2}
                Z
              `;

              // Slice label position along midAngle
              const labelRadiusX = rx * 0.72;
              const labelRadiusY = ry * 0.72;
              const lx = centerTargetX + labelRadiusX * Math.cos(slice.midAngle);
              const ly = centerTargetY + labelRadiusY * Math.sin(slice.midAngle);

              return (
                <g key={`top-group-${slice.id}`} className="transition-all duration-200">
                  <path
                    d={pathD}
                    fill={`url(#topGrad-${slice.id})`}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? '2.5' : '1.5'}
                    className="cursor-pointer transition-all duration-200 hover:brightness-105"
                    onMouseEnter={() => setHoveredId(slice.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />

                  {/* Percentage Label on Slice (if >= 6% share) */}
                  {slice.percent >= 6 && (
                    <text
                      x={lx}
                      y={ly + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={slice.percent >= 15 ? '12px' : '10px'}
                      fontWeight="bold"
                      className="pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] select-none"
                    >
                      {slice.percent}%
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Hover Tooltip Overlay in SVG */}
          {hoveredId && (() => {
            const active = slicesWithAngles.find((s) => s.id === hoveredId);
            if (!active) return null;

            return (
              <g className="pointer-events-none">
                {/* Floating Tooltip Box */}
                <rect
                  x="15"
                  y="12"
                  width="180"
                  height="58"
                  rx="10"
                  fill="#0f172a"
                  fillOpacity="0.92"
                  stroke="#334155"
                  strokeWidth="1"
                  filter="drop-shadow(0 4px 6px rgba(0,0,0,0.25))"
                />
                <circle cx="30" cy="30" r="5" fill={active.color} />
                <text x="42" y="34" fill="#ffffff" fontSize="12px" fontWeight="bold">
                  {active.name.length > 18 ? active.name.slice(0, 16) + '...' : active.name}
                </text>
                <text x="30" y="55" fill="#94a3b8" fontSize="11px">
                  পরিমাণ: <tspan fill="#38bdf8" fontWeight="bold">{valueFormatter(active.value)}</tspan> ({active.percent}%)
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Legend & Details Grid */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 px-1">
        {slicesWithAngles.map((slice) => {
          const isHovered = hoveredId === slice.id;
          return (
            <div
              key={`legend-${slice.id}`}
              onMouseEnter={() => setHoveredId(slice.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? 'bg-slate-100/90 border-slate-300 shadow-xs scale-[1.02]'
                  : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/60'
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: slice.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800 truncate" title={slice.name}>
                  {slice.name}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span className="font-mono text-slate-700 font-medium">
                    {valueFormatter(slice.value)}
                  </span>
                  <span className="font-bold text-brand-700">{slice.percent}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
