'use client';

// Hộp thoại responsive: mobile = trượt từ đáy (bottom sheet); desktop = modal
// canh giữa màn hình.
import { useEffect, type ReactNode } from 'react';

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-center items-end lg:items-center lg:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[520px] lg:max-w-[480px] bg-[var(--paper)] rounded-t-[20px] lg:rounded-2xl max-h-[90vh] lg:max-h-[85vh] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.2)] lg:shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
      >
        <div className="sticky top-0 bg-[var(--paper)] px-4 pt-3 pb-2 flex items-center justify-between border-b border-[var(--line)] z-10">
          <div className="lg:hidden w-9 h-1 rounded-full bg-[var(--lock-line)] absolute left-1/2 -translate-x-1/2 top-1.5" />
          <h3 className="text-[15px] font-extrabold mt-1 lg:mt-0">{title}</h3>
          <button
            onClick={onClose}
            className="mt-1 lg:mt-0 w-8 h-8 grid place-items-center rounded-full bg-white border border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
