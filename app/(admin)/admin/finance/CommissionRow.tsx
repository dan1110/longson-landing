'use client';

// Một dòng hoa hồng sale + nút "Đánh dấu đã trả" (mục 13).
import { useState, useTransition } from 'react';
import { payCommission } from '../actions';
import { money } from '@/lib/format';

export function CommissionRow({
  saleId,
  name,
  bookingCount,
  revenue,
  commission,
  paid,
}: {
  saleId: string;
  name: string;
  bookingCount: number;
  revenue: number;
  commission: number;
  paid: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  function pay() {
    setErr('');
    start(async () => {
      const res = await payCommission(saleId, commission);
      if (!res.ok) setErr(res.error);
    });
  }

  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <b className="text-[13px]">{name}</b>
        <div className="text-[11px] text-[var(--ink-3)]">
          {bookingCount} đơn hoàn tất · doanh số {money(revenue)}
        </div>
        {err && <div className="text-[10px] text-[var(--tape-ink)]">{err}</div>}
      </div>
      <div className="text-right">
        <div className="mono text-[13px] font-bold text-[var(--teal-d)]">{money(commission)} ₫</div>
        {paid ? (
          <span className="text-[10.5px] font-bold text-[var(--teal-d)] bg-[var(--free)] px-2 py-0.5 rounded-full">đã trả</span>
        ) : commission > 0 ? (
          <button
            onClick={pay}
            disabled={pending}
            className="mt-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border-[1.5px] border-[var(--line)] active:scale-95 disabled:opacity-50"
          >
            {pending ? '…' : 'Đánh dấu đã trả'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
