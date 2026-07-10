'use client';

// Nút "Đánh dấu đã trả hoa hồng" cho 1 sale (mục 13).
import { useState, useTransition } from 'react';
import { payCommission } from '../actions';
import { money } from '@/lib/format';
import { Icon } from '@/components/Icon';

export function SalePayButton({
  saleId,
  amount,
  paid,
}: {
  saleId: string;
  amount: number;
  paid: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  if (paid) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--teal-d)] bg-[#e0f0e5] px-2.5 py-1.5 rounded-lg">
        <Icon name="check" className="w-3.5 h-3.5" /> Đã trả hoa hồng
      </span>
    );
  }
  if (amount <= 0) {
    return <span className="text-[12px] text-[var(--ink-3)]">Chưa có hoa hồng</span>;
  }

  return (
    <div>
      <button
        onClick={() => {
          setErr('');
          start(async () => {
            const res = await payCommission(saleId, amount);
            if (!res.ok) setErr(res.error);
          });
        }}
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-[var(--teal)] text-white hover:bg-[var(--teal-d)] transition-colors active:scale-95 disabled:opacity-50"
      >
        {pending ? '…' : `Trả ${money(amount)} ₫`}
      </button>
      {err && <p className="text-[10.5px] text-[var(--tape-ink)] mt-1">{err}</p>}
    </div>
  );
}
