import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import prisma from '../src/lib/prisma';
import { getDhakaDateString, parseDateOnly } from '../src/lib/date';
import { calculateEmployeeScore, daysInRange, postsTargetWithLimitFallback } from '../src/lib/scoring';

// Employee panel logic fixes: partial daily-entry saves, double clicks, undo, posts counting,
// range validation and lead rules. Runs against the in-memory store.

const mockSessionUser = {
  id: '',
  userId: '',
  name: 'Audit Employee',
  email: 'audit@test.com',
  role: 'EMPLOYEE' as 'ADMIN' | 'EMPLOYEE',
};

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => (mockSessionUser.userId ? { ...mockSessionUser } : null)),
}));

import { GET as dailyEntryGET, POST as dailyEntryPOST } from '../src/app/api/employee/daily-entry/route';
import { POST as markDone } from '../src/app/api/employee/work/[linkId]/done/route';
import { POST as undoLink } from '../src/app/api/employee/work/[linkId]/undo/route';
import { POST as extraWork } from '../src/app/api/employee/work/route';
import { GET as performanceGET } from '../src/app/api/employee/performance/route';
import { GET as leaderboardGET } from '../src/app/api/employee/leaderboard/route';
import { POST as createLead } from '../src/app/api/leads/route';
import { PUT as updateLead } from '../src/app/api/leads/[id]/route';

const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('Employee panel logic audit', () => {
  const runId = Math.random().toString(36).slice(2, 8);
  const today = getDhakaDateString();
  let emp: any;
  let section: any;
  let link: any;
  let product: any;

  beforeAll(async () => {
    await prisma.scoringSettings.upsert({
      where: { id: 'default' },
      update: { undo_enabled: true, employee_edit_window_days: 1 },
      create: { id: 'default', undo_enabled: true, employee_edit_window_days: 1, achievement_cap: 1, failing_threshold: 0.8 },
    });
    emp = await prisma.user.create({
      data: { name: `Audit ${runId}`, email: `audit_${runId}@test.com`, password_hash: 'x', role: 'EMPLOYEE' },
    });
    mockSessionUser.id = emp.id;
    mockSessionUser.userId = emp.id;
    section = await prisma.groupSection.create({ data: { name: `Audit section ${runId}` } });
    await prisma.assignment.create({ data: { employee_id: emp.id, section_id: section.id, assigned_by: emp.id } });
    link = await prisma.groupLink.create({
      data: { section_id: section.id, url: `https://facebook.com/groups/audit-${runId}`, title: 'Audit group' },
    });
    product = await prisma.product.create({
      data: { name_bn: 'মাশরুম', name_en: 'Mushroom', unit: 'kg', selling_price: 400 },
    });
  });

  describe('daily entry', () => {
    it('a My Work save (no main issue, no notes) keeps what the Daily Entry page saved', async () => {
      const full = await dailyEntryPOST(
        json('http://localhost/api/employee/daily-entry', {
          entry_date: today,
          metrics: { SALES_AMOUNT: 1000 },
          daily_text: { main_issue: 'Courier delay', next_priorities: 'Call buyers' },
          metric_notes: { SALES_AMOUNT: 'Two bulk orders' },
        })
      );
      expect(full.status).toBe(200);

      const partial = await dailyEntryPOST(
        json('http://localhost/api/employee/daily-entry', {
          entry_date: today,
          metrics: { SALES_AMOUNT: 1500 },
          daily_text: { next_priorities: 'Visit market' },
        })
      );
      expect(partial.status).toBe(200);

      const text = await prisma.dailyText.findUnique({
        where: { employee_id_entry_date: { employee_id: emp.id, entry_date: parseDateOnly(today) } },
      });
      expect(text.main_issue).toBe('Courier delay');
      expect(text.next_priorities).toBe('Visit market');

      const sales = await prisma.dailyEntry.findUnique({
        where: {
          employee_id_entry_date_metric_type: { employee_id: emp.id, entry_date: parseDateOnly(today), metric_type: 'SALES_AMOUNT' },
        },
      });
      expect(Number(sales.value)).toBe(1500);
      expect(sales.note).toBe('Two bulk orders');
    });

    it('adds duplicate product rows together instead of failing the save', async () => {
      const res = await dailyEntryPOST(
        json('http://localhost/api/employee/daily-entry', {
          entry_date: today,
          metrics: {},
          product_sales: [
            { product_id: product.id, quantity: 1, amount: 400 },
            { product_id: product.id, quantity: 2, amount: 800 },
          ],
        })
      );
      expect(res.status).toBe(200);
      const rows = await prisma.dailyProductSale.findMany({ where: { employee_id: emp.id, entry_date: parseDateOnly(today) } });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].quantity)).toBe(3);
      expect(Number(rows[0].amount)).toBe(1200);
    });

    it('rejects an unknown product and a malformed date', async () => {
      const unknown = await dailyEntryPOST(
        json('http://localhost/api/employee/daily-entry', {
          entry_date: today,
          metrics: {},
          product_sales: [{ product_id: 'no-such-product', quantity: 1, amount: 1 }],
        })
      );
      expect(unknown.status).toBe(400);

      const badDate = await dailyEntryGET(new NextRequest('http://localhost/api/employee/daily-entry?date=2026-13-99'));
      expect(badDate.status).toBe(400);
    });

    it('reports the live queue count next to the saved posts figure', async () => {
      const res = await dailyEntryGET(new NextRequest(`http://localhost/api/employee/daily-entry?date=${today}`));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(typeof data.queue_posts).toBe('number');
    });
  });

  describe('link completion', () => {
    it('records a double click only once', async () => {
      const req = () => new NextRequest(`http://localhost/api/employee/work/${link.id}/done`, { method: 'POST' });
      const ctx = { params: Promise.resolve({ linkId: link.id }) };
      const [a, b] = await Promise.all([markDone(req(), ctx), markDone(req(), ctx)]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      const active = await prisma.linkCompletion.count({
        where: { group_link_id: link.id, employee_id: emp.id, undone_at: null },
      });
      expect(active).toBe(1);
    });

    it('undo clears every active completion of the link, including an old duplicate', async () => {
      await prisma.linkCompletion.create({ data: { group_link_id: link.id, employee_id: emp.id } });
      const res = await undoLink(new NextRequest(`http://localhost/api/employee/work/${link.id}/undo`, { method: 'POST' }), {
        params: Promise.resolve({ linkId: link.id }),
      });
      expect(res.status).toBe(200);
      const active = await prisma.linkCompletion.count({
        where: { group_link_id: link.id, employee_id: emp.id, undone_at: null },
      });
      expect(active).toBe(0);
    });

    it('extra work: a double submit makes one link and one completion; bad URLs are refused', async () => {
      const body = { url: `https://facebook.com/groups/extra-${runId}`, title: 'Extra', section_id: section.id };
      const [a, b] = await Promise.all([
        extraWork(json('http://localhost/api/employee/work', body)),
        extraWork(json('http://localhost/api/employee/work', body)),
      ]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      const links = await prisma.groupLink.findMany({ where: { section_id: section.id, url: body.url } });
      expect(links).toHaveLength(1);
      const done = await prisma.linkCompletion.count({ where: { group_link_id: links[0].id, undone_at: null } });
      expect(done).toBe(1);

      const bad = await extraWork(json('http://localhost/api/employee/work', { ...body, url: 'javascript:alert(1)' }));
      expect(bad.status).toBe(400);
    });
  });

  describe('performance and leaderboard', () => {
    it('trend posts come from link completions, not a POSTS_DONE daily entry', async () => {
      await prisma.dailyEntry.upsert({
        where: {
          employee_id_entry_date_metric_type: { employee_id: emp.id, entry_date: parseDateOnly(today), metric_type: 'POSTS_DONE' },
        },
        update: { value: 99 },
        create: { employee_id: emp.id, entry_date: parseDateOnly(today), metric_type: 'POSTS_DONE', value: 99 },
      });
      const res = await performanceGET(new NextRequest('http://localhost/api/employee/performance?period=daily'));
      const data = await res.json();
      expect(res.status).toBe(200);
      const todayPoint = data.trend[data.trend.length - 1];
      const completions = await prisma.linkCompletion.count({
        where: { employee_id: emp.id, undone_at: null, completed_at: { gte: new Date(`${today}T00:00:00+06:00`) } },
      });
      expect(todayPoint.posts).toBe(completions);
      expect(todayPoint.posts).not.toBe(99);
      expect(data.score_result.metrics.POSTS_DONE.achieved).toBe(completions);
    });

    it('performance ignores a malformed date instead of failing', async () => {
      const res = await performanceGET(new NextRequest('http://localhost/api/employee/performance?period=weekly&date=garbage'));
      expect(res.status).toBe(200);
    });

    it('leaderboard accepts a reversed custom range', async () => {
      const res = await leaderboardGET(
        new NextRequest(`http://localhost/api/employee/leaderboard?period=custom&start_date=${today}&end_date=2020-01-01&format=object`)
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.start_date <= data.end_date).toBe(true);
    });
  });

  describe('leads', () => {
    it("counts a new lead under today's Dhaka date and blocks moving a lead onto another's number", async () => {
      const phoneA = `017${String(Date.now()).slice(-8)}`;
      const phoneB = `018${String(Date.now()).slice(-8)}`;
      const a = await createLead(json('http://localhost/api/leads', { name: 'Buyer A', phone: phoneA, source_channel: 'Facebook' }));
      expect(a.status).toBe(201);
      const b = await createLead(json('http://localhost/api/leads', { name: 'Buyer B', phone: phoneB, source_channel: 'Facebook' }));
      const leadB = (await b.json()).lead;

      const entry = await prisma.dailyEntry.findUnique({
        where: {
          employee_id_entry_date_metric_type: { employee_id: emp.id, entry_date: parseDateOnly(today), metric_type: 'NEW_CLIENTS' },
        },
      });
      expect(Number(entry?.value)).toBeGreaterThanOrEqual(2);

      const clash = await updateLead(
        new NextRequest(`http://localhost/api/leads/${leadB.id}`, { method: 'PUT', body: JSON.stringify({ phone: phoneA }) }),
        { params: Promise.resolve({ id: leadB.id }) }
      );
      expect(clash.status).toBe(400);

      const badDate = await createLead(
        json('http://localhost/api/leads', { name: 'Buyer C', phone: `019${String(Date.now()).slice(-8)}`, source_channel: 'FB', next_followup_date: 'soon' })
      );
      expect(badDate.status).toBe(400);
    });
  });

  describe('scoring guards', () => {
    it('never produces NaN from a bad weight or target', () => {
      const r = calculateEmployeeScore(
        { SALES_AMOUNT: { target: Number('abc'), achieved: 10 }, POSTS_DONE: { target: 10, achieved: 5 } },
        { sectionWeights: { SALES_PROFIT: 'x' as unknown as number } }
      );
      expect(Number.isFinite(r.totalScore)).toBe(true);
      expect(r.metrics.SALES_AMOUNT.isNA).toBe(true);
      expect(r.totalScore).toBe(50);
    });

    it('post limits stand in for a missing posts target, per day', () => {
      expect(postsTargetWithLimitFallback(0, [5, null, 3], 2)).toBe(16);
      expect(postsTargetWithLimitFallback(40, [5], 2)).toBe(40);
      expect(postsTargetWithLimitFallback(undefined, [], 7)).toBe(0);
      expect(daysInRange(parseDateOnly('2026-10-01'), parseDateOnly('2026-10-29'))).toBe(29);
    });
  });
});
