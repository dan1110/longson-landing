'use client';

// Hệ thống thông báo dùng chung — thay cho alert()/confirm() của trình duyệt.
//  • toast.success / toast.error / toast.info  → thẻ nổi ở GIỮA MÀN HÌNH, tự tắt.
//  • confirmDialog({...})  → popup xác nhận (Promise<boolean>), thay confirm().
// API kiểu imperative (gọi trực tiếp như hàm) nên không cần bọc Provider hay
// truyền props qua từng component — chỉ cần <Toaster/> mount 1 lần ở layout gốc.
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ConfirmReq {
  id: number;
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}

let toastListeners: ((t: ToastItem) => void)[] = [];
let confirmListeners: ((c: ConfirmReq) => void)[] = [];
let counter = 1;
const nextId = () => counter++;

function emitToast(kind: ToastKind, message: string) {
  const item: ToastItem = { id: nextId(), kind, message };
  toastListeners.forEach((l) => l(item));
}

export const toast = {
  success: (m: string) => emitToast('success', m),
  error: (m: string) => emitToast('error', m),
  info: (m: string) => emitToast('info', m),
};

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** Popup xác nhận. `await confirmDialog({...})` → true nếu bấm đồng ý. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const req: ConfirmReq = {
      id: nextId(),
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText ?? 'Đồng ý',
      cancelText: opts.cancelText ?? 'Hủy',
      danger: opts.danger ?? false,
      resolve,
    };
    if (confirmListeners.length === 0) {
      // Chưa mount Toaster → fallback về confirm gốc để không kẹt luồng.
      resolve(window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title));
      return;
    }
    confirmListeners.forEach((l) => l(req));
  });
}

const TOAST_STYLE: Record<ToastKind, { icon: IconName; ring: string; chip: string }> = {
  success: { icon: 'check', ring: 'border-[#bfe4cd]', chip: 'bg-[#e0f0e5] text-[var(--teal-d)]' },
  error: { icon: 'x', ring: 'border-[var(--tape-line)]', chip: 'bg-[var(--tape)] text-[var(--tape-ink)]' },
  info: { icon: 'alert', ring: 'border-[var(--line)]', chip: 'bg-[var(--teal)]/10 text-[var(--teal)]' },
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    const onConfirm = (c: ConfirmReq) => setConfirmReq(c);
    toastListeners.push(onToast);
    confirmListeners.push(onConfirm);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== onToast);
      confirmListeners = confirmListeners.filter((l) => l !== onConfirm);
    };
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  function answer(v: boolean) {
    confirmReq?.resolve(v);
    setConfirmReq(null);
  }

  return (
    <>
      {/* Toast — nổi ở giữa trên màn hình, không chặn thao tác */}
      <div className="fixed inset-x-0 top-[18vh] z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.kind];
          return (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              className={`toast-in pointer-events-auto max-w-[92vw] sm:max-w-md w-fit cursor-pointer flex items-center gap-3 bg-white border ${s.ring} rounded-2xl px-4 py-3 shadow-[0_8px_28px_rgba(16,32,46,0.16)]`}
            >
              <span className={`grid place-items-center w-7 h-7 rounded-full flex-none ${s.chip}`}>
                <Icon name={s.icon} className="w-4 h-4" />
              </span>
              <span className="text-[13.5px] font-medium text-[var(--ink)] leading-snug">{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* Confirm — popup xác nhận ở chính giữa màn hình */}
      {confirmReq && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(16,32,46,0.42)] px-5 backdrop-blur-[1px]"
          onClick={() => answer(false)}
        >
          <div
            className="toast-in w-full max-w-sm bg-white rounded-2xl shadow-[0_20px_60px_rgba(16,32,46,0.28)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid place-items-center w-10 h-10 rounded-full flex-none ${
                  confirmReq.danger ? 'bg-[var(--tape)] text-[var(--tape-ink)]' : 'bg-[var(--teal)]/10 text-[var(--teal)]'
                }`}
              >
                <Icon name={confirmReq.danger ? 'trash' : 'alert'} className="w-5 h-5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-[16px] font-bold text-[var(--ink)] leading-snug">{confirmReq.title}</h3>
                {confirmReq.message && (
                  <p className="text-[13px] text-[var(--ink-3)] leading-relaxed mt-1">{confirmReq.message}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => answer(false)}
                className="flex-1 rounded-xl py-3 font-semibold text-[14px] text-[var(--ink-2)] bg-[var(--paper)] hover:bg-[var(--line)] active:scale-[.98] transition"
              >
                {confirmReq.cancelText}
              </button>
              <button
                onClick={() => answer(true)}
                className={`flex-1 rounded-xl py-3 font-bold text-[14px] text-white active:scale-[.98] transition ${
                  confirmReq.danger ? 'bg-[var(--brick)] hover:brightness-105' : 'bg-[var(--teal)] hover:bg-[var(--teal-d)]'
                }`}
              >
                {confirmReq.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
