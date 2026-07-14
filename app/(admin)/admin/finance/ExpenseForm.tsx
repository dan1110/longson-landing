'use client';

// Form ghi khoản chi (mục 10). Danh mục + số tiền + ngày + ghi chú.
import { useState } from 'react';
import { addTransaction } from '../actions';
import { toISODate } from '@/lib/format';
import { CATEGORY_LABEL, METHOD_LABEL } from '@/lib/booking';

// Hạng mục chi — theo đúng bộ danh mục chủ home đang dùng thực tế.
const CATS = [
  'electricity', 'water', 'internet', 'cleaning', 'maintenance', 'supplies',
  'commission', 'marketing', 'rent', 'salary', 'other',
].map((v) => ({ v, l: CATEGORY_LABEL[v] }));

const inputCls =
  'w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] bg-white focus:outline-none focus:border-[var(--teal)]';
const labelCls =
  'block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-1.5';

export function ExpenseForm({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('electricity');
  const [paidAt, setPaidAt] = useState(toISODate(new Date()));
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('cash');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (amount <= 0) {
      setErr('Nhập số tiền lớn hơn 0.');
      return;
    }
    setLoading(true);
    const res = await addTransaction({
      type: 'expense',
      amount,
      category,
      method,
      paidAt,
      note: note || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Số tiền (₫)</label>
        <input type="number" min={0} step={10000} className={inputCls} value={amount} onChange={(e) => setAmount(+e.target.value)} inputMode="numeric" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Danh mục</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Hình thức</label>
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(METHOD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Ngày chi</label>
        <input type="date" className={inputCls} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Ghi chú</label>
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Tiền điện tháng 7" />
      </div>
      {err && <p className="text-[12px] text-[var(--tape-ink)] bg-[var(--tape)] rounded-lg px-3 py-2">{err}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-xl py-3.5 font-bold text-[15px] bg-[var(--brick)] text-white active:scale-[.98] disabled:opacity-60">
        {loading ? 'Đang lưu…' : 'Ghi khoản chi'}
      </button>
    </form>
  );
}
