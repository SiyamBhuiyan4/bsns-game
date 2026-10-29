'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

/**
 * In-page replacement for window.confirm: centred, scroll-locked (via
 * .modal-backdrop), closes on Escape or a click outside, focuses Cancel first
 * so Enter never confirms by accident.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** danger = red confirm button, warning = amber icon with the primary button. */
  tone?: 'danger' | 'warning';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { L } = useLanguage();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Latest callbacks in a ref, so an inline onCancel does not re-run the effect (and steal focus) each render.
  const latest = useRef({ busy, onCancel });
  latest.current = { busy, onCancel };

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !latest.current.busy) latest.current.onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="modal-panel sm:max-w-md"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-message' : undefined}
      >
        <div className="card-body flex items-start gap-3">
          <span className={`icon-tile ${tone === 'danger' ? 'icon-tile-rose' : 'icon-tile-amber'}`}>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="card-title">
              {title}
            </h3>
            {message && (
              <div id="confirm-dialog-message" className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {message}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="btn btn-secondary min-h-10">
            {cancelLabel ?? L('বাতিল', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`btn min-h-10 ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{confirmLabel ?? L('নিশ্চিত করুন', 'Confirm')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
