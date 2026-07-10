'use client';

// Thêm / sửa / xóa nhân viên sale.
import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { RowMenu } from '@/components/RowMenu';
import { createSale, updateSale, deleteSale } from '../actions';
import { confirmDialog } from '@/components/Toast';
import type { Profile } from '@/lib/database.types';

const inputCls =
  'w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] bg-white focus:outline-none focus:border-[var(--teal)]';
const labelCls =
  'block text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-1.5';

export function AddSaleButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center gap-1.5 flex-none"
      >
        <Icon name="plus" className="w-4 h-4" /> Thêm sale
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Thêm nhân viên sale">
        <SaleForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function SaleCardActions({ sale }: { sale: Profile }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !(await confirmDialog({
        title: `Xóa/khóa nhân viên ${sale.name}?`,
        message: 'Nếu đã có đơn, tài khoản sẽ bị khóa để giữ lịch sử.',
        confirmText: 'Xóa/khóa',
        danger: true,
      }))
    )
      return;
    setBusy(true);
    await deleteSale(sale.id);
    setBusy(false);
  }

  return (
    <>
      <RowMenu
        items={[
          { label: 'Sửa', icon: 'edit', onClick: () => setOpen(true) },
          { label: 'Xóa / khóa', icon: 'trash', danger: true, onClick: remove },
        ]}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={`Sửa ${sale.name}`}>
        <SaleForm sale={sale} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function SaleForm({ sale, onDone }: { sale?: Profile; onDone: () => void }) {
  const editing = !!sale;
  const [name, setName] = useState(sale?.name ?? '');
  const [phone, setPhone] = useState(sale?.phone ?? '');
  const [rate, setRate] = useState(Math.round((Number(sale?.commission_rate) || 0.1) * 100));
  const [active, setActive] = useState(sale?.active ?? true);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = editing
      ? await updateSale({ id: sale!.id, name, phone, commissionRate: rate / 100, active })
      : await createSale({ name, phone: phone || undefined, commissionRate: rate / 100 });
    setLoading(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Tên nhân viên</label>
        <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Ms. Hạnh" />
      </div>
      <div>
        <label className={labelCls}>SĐT</label>
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </div>
      <div>
        <label className={labelCls}>Hoa hồng (%)</label>
        <input type="number" min={0} max={100} className={inputCls} value={rate} onChange={(e) => setRate(+e.target.value)} inputMode="numeric" />
      </div>
      {editing && (
        <label className="flex items-center gap-2.5 text-[14px] font-medium cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-[var(--teal)]" />
          Đang hoạt động (bỏ chọn để tạm khóa)
        </label>
      )}
      {err && <p className="text-[12px] text-[var(--tape-ink)] bg-[var(--tape)] rounded-lg px-3 py-2">{err}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-3.5 font-bold text-[15px] bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors disabled:opacity-60"
      >
        {loading ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo nhân viên & link'}
      </button>
    </form>
  );
}
