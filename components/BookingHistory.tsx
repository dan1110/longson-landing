'use client';

// Lịch sử sửa đơn: ai đổi gì, lúc nào. Đọc từ bảng booking_audit (ghi bằng
// trigger ở DB nên bắt được cả sửa từ app lẫn sửa tay trong SQL editor).
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BookingAudit } from '@/lib/database.types';
import { STATUS_LABEL } from '@/lib/booking';
import { money } from '@/lib/format';
import { Icon } from './Icon';

const FIELD_LABEL: Record<string, string> = {
  checkin_date: 'Ngày nhận',
  checkout_date: 'Ngày trả',
  price_per_night: 'Giá/đêm',
  deposit_amount: 'Tiền cọc',
  guests_adult: 'Người lớn',
  guests_child: 'Trẻ em',
  status: 'Trạng thái',
  unit_id: 'Đơn vị',
  customer_id: 'Khách',
  sale_id: 'Sale',
  note: 'Ghi chú',
  code: 'Mã đơn',
};

const MONEY_FIELDS = new Set(['price_per_night', 'deposit_amount']);

/** Hiển thị giá trị cũ/mới cho dễ đọc thay vì in thô. */
function fmt(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (field === 'status') return STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? String(v);
  if (MONEY_FIELDS.has(field)) return `${money(Number(v))} đ`;
  if (field === 'checkin_date' || field === 'checkout_date') {
    const [y, m, d] = String(v).split('-');
    return `${d}/${m}/${y}`;
  }
  // unit_id / customer_id / sale_id là uuid — rút gọn cho đỡ rối.
  if (field.endsWith('_id')) return `${String(v).slice(0, 8)}…`;
  return String(v);
}

function when(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function BookingHistory({ bookingId }: { bookingId: string }) {
  const [rows, setRows] = useState<BookingAudit[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || rows) return;
    let alive = true;
    createClient()
      .from('booking_audit')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (alive) setRows((data as BookingAudit[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [open, rows, bookingId]);

  return (
    <div className="bg-white border border-[var(--line)] rounded-[12px] p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="calendar" className="w-3.5 h-3.5" /> Lịch sử sửa đơn
        </span>
        <Icon name="chevronRight" className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="mt-2">
          {rows === null ? (
            <p className="text-[12px] text-[var(--ink-3)]">Đang tải…</p>
          ) : rows.length === 0 ? (
            <p className="text-[12px] text-[var(--ink-3)]">
              Chưa có thay đổi nào được ghi lại. Đơn tạo trước khi bật tính năng này thì
              không có lịch sử.
            </p>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {rows.map((r) => (
                <div key={r.id} className="py-2 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <b className="text-[var(--ink-2)]">
                      {r.action === 'created'
                        ? 'Tạo đơn'
                        : r.action === 'deleted'
                          ? 'Xóa đơn'
                          : 'Sửa đơn'}
                    </b>
                    <span className="text-[var(--ink-3)] mono text-[11px]">{when(r.created_at)}</span>
                  </div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">
                    bởi {r.actor_name ?? 'Không rõ'}
                  </div>
                  {r.action === 'updated' && (
                    <ul className="mt-1 space-y-0.5">
                      {Object.entries(r.changes).map(([field, pair]) => {
                        const [from, to] = Array.isArray(pair) ? pair : [null, null];
                        return (
                          <li key={field} className="text-[11.5px]">
                            <span className="text-[var(--ink-3)]">
                              {FIELD_LABEL[field] ?? field}:
                            </span>{' '}
                            <span className="line-through text-[var(--ink-3)]">
                              {fmt(field, from)}
                            </span>{' '}
                            → <b>{fmt(field, to)}</b>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
