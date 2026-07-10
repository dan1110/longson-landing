'use client';

// Bảng Thu chi CRUD + lọc Thu/Chi + tìm kiếm. Desktop = bảng, mobile = thẻ.
import { useMemo, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { RowMenu } from '@/components/RowMenu';
import { MoneyInput } from '@/components/MoneyInput';
import { money, dmy, toISODate } from '@/lib/format';
import { CATEGORY_LABEL } from '@/lib/booking';
import { addTransaction, updateTransaction, deleteTransaction } from '../actions';

export interface TxnRow {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  method: string | null;
  category: string | null;
  paid_at: string;
  note: string | null;
  bookingCustomer: string | null; // tên khách nếu gắn với 1 đơn
}

const EXPENSE_CATS = ['electricity', 'water', 'cleaning', 'supplies', 'maintenance', 'commission', 'other'];
const INCOME_CATS = ['deposit', 'balance', 'other'];

const inputCls =
  'w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] bg-white focus:outline-none focus:border-[var(--teal)]';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-1.5';

export function FinanceTable({ rows }: { rows: TxnRow[] }) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<TxnRow | null>(null);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false;
      if (!kw) return true;
      const hay = `${CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? ''} ${r.note ?? ''} ${r.bookingCustomer ?? ''}`.toLowerCase();
      return hay.includes(kw);
    });
  }, [rows, filter, q]);

  return (
    <>
      {/* Lọc + tìm + thêm */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-white border border-[var(--line)] rounded-xl p-1 text-[12px] font-semibold">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filter === f ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`}
            >
              {f === 'all' ? 'Tất cả' : f === 'income' ? 'Thu' : 'Chi'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"><Icon name="search" className="w-4 h-4" /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm danh mục / ghi chú…" className="w-full pl-9 pr-3 py-2.5 border border-[var(--line)] rounded-xl text-[14px] bg-white focus:outline-none focus:border-[var(--teal)]" />
        </div>
        <button onClick={() => setAddOpen(true)} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center gap-1.5 flex-none">
          <Icon name="plus" className="w-4 h-4" /> Ghi giao dịch
        </button>
      </div>

      {view.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)] text-center py-10">Chưa có giao dịch nào.</p>
      ) : (
        <>
          {/* Desktop bảng */}
          <div className="hidden lg:block bg-white border border-[var(--line)] rounded-2xl shadow-[0_1px_2px_rgba(16,32,46,0.04)] [&_thead_th:first-child]:rounded-tl-2xl [&_thead_th:last-child]:rounded-tr-2xl [&_tbody_tr:last-child_td:first-child]:rounded-bl-2xl [&_tbody_tr:last-child_td:last-child]:rounded-br-2xl">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-[var(--paper)] text-[var(--ink-3)] text-[11px] uppercase tracking-wide">
                  <th className="text-left font-semibold px-4 py-2.5">Ngày</th>
                  <th className="text-left font-semibold px-4 py-2.5">Loại</th>
                  <th className="text-left font-semibold px-4 py-2.5">Danh mục</th>
                  <th className="text-left font-semibold px-4 py-2.5">Ghi chú</th>
                  <th className="text-right font-semibold px-4 py-2.5">Số tiền</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)] hover:bg-[var(--paper)] transition-colors">
                    <td className="px-4 py-2.5 mono text-[var(--ink-2)]">{dmy(r.paid_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.type === 'income' ? 'bg-[#e0f0e5] text-[var(--teal-d)]' : 'bg-[#fbe0dc] text-[var(--tape-ink)]'}`}>
                        {r.type === 'income' ? 'Thu' : 'Chi'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-3)] text-[12.5px]">{r.note ?? r.bookingCustomer ?? '—'}</td>
                    <td className={`px-4 py-2.5 text-right mono font-semibold ${r.type === 'income' ? 'text-[var(--teal-d)]' : 'text-[var(--tape-ink)]'}`}>
                      {r.type === 'income' ? '+' : '−'}{money(r.amount)}
                    </td>
                    <td className="px-4 py-2.5"><TxnMenu row={r} onEdit={() => setEditRow(r)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile thẻ */}
          <div className="lg:hidden space-y-2">
            {view.map((r) => (
              <div key={r.id} className="bg-white border border-[var(--line)] rounded-xl p-3 flex items-center gap-3 shadow-[0_1px_2px_rgba(16,32,46,0.04)]">
                <span className={`w-9 h-9 rounded-full grid place-items-center flex-none ${r.type === 'income' ? 'bg-[#e0f0e5] text-[var(--teal-d)]' : 'bg-[#fbe0dc] text-[var(--tape-ink)]'}`}>
                  <Icon name={r.type === 'income' ? 'trendUp' : 'trendDown'} className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <b className="text-[13.5px]">{CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? (r.type === 'income' ? 'Thu' : 'Chi')}</b>
                  <div className="text-[11px] text-[var(--ink-3)] truncate">{dmy(r.paid_at)}{r.note ? ` · ${r.note}` : r.bookingCustomer ? ` · ${r.bookingCustomer}` : ''}</div>
                </div>
                <div className={`mono text-[13.5px] font-bold ${r.type === 'income' ? 'text-[var(--teal-d)]' : 'text-[var(--tape-ink)]'}`}>
                  {r.type === 'income' ? '+' : '−'}{money(r.amount)}
                </div>
                <TxnMenu row={r} onEdit={() => setEditRow(r)} />
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Ghi giao dịch">
        <TxnForm onDone={() => setAddOpen(false)} />
      </Sheet>
      <Sheet open={!!editRow} onClose={() => setEditRow(null)} title="Sửa giao dịch">
        {editRow && <TxnForm row={editRow} onDone={() => setEditRow(null)} />}
      </Sheet>
    </>
  );
}

function TxnMenu({ row, onEdit }: { row: TxnRow; onEdit: () => void }) {
  async function remove() {
    if (!confirm('Xóa giao dịch này?')) return;
    const res = await deleteTransaction(row.id);
    if (!res.ok) alert(res.error);
  }
  return <RowMenu items={[{ label: 'Sửa', icon: 'edit', onClick: onEdit }, { label: 'Xóa', icon: 'trash', danger: true, onClick: remove }]} />;
}

function TxnForm({ row, onDone }: { row?: TxnRow; onDone: () => void }) {
  const editing = !!row;
  const [type, setType] = useState<'income' | 'expense'>(row?.type ?? 'expense');
  const [amount, setAmount] = useState(row?.amount ?? 0);
  const [category, setCategory] = useState(row?.category ?? 'electricity');
  const [method, setMethod] = useState(row?.method ?? 'cash');
  const [paidAt, setPaidAt] = useState(row?.paid_at ?? toISODate(new Date()));
  const [note, setNote] = useState(row?.note ?? '');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (amount <= 0) return setErr('Nhập số tiền lớn hơn 0.');
    setLoading(true);
    const res = editing
      ? await updateTransaction({ id: row!.id, type, amount, category, method, paidAt, note })
      : await addTransaction({ type, amount, category, method, paidAt, note });
    setLoading(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex bg-[var(--paper)] rounded-xl p-1 text-[13px] font-semibold">
        <button type="button" onClick={() => { setType('expense'); setCategory('electricity'); }} className={`flex-1 py-2 rounded-lg transition-colors ${type === 'expense' ? 'bg-[var(--brick)] text-white' : 'text-[var(--ink-3)]'}`}>Chi</button>
        <button type="button" onClick={() => { setType('income'); setCategory('deposit'); }} className={`flex-1 py-2 rounded-lg transition-colors ${type === 'income' ? 'bg-[var(--teal)] text-white' : 'text-[var(--ink-3)]'}`}>Thu</button>
      </div>
      <div>
        <label className={labelCls}>Số tiền</label>
        <MoneyInput value={amount} onChange={setAmount} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Danh mục</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Hình thức</label>
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Ngày</label>
        <input type="date" className={inputCls} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Ghi chú</label>
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: tiền điện tháng 7" />
      </div>
      {err && <p className="text-[12px] text-[var(--tape-ink)] bg-[var(--tape)] rounded-lg px-3 py-2">{err}</p>}
      <button type="submit" disabled={loading} className={`w-full rounded-xl py-3.5 font-bold text-[15px] text-white active:scale-[.98] disabled:opacity-60 transition ${type === 'income' ? 'bg-[var(--teal)] hover:bg-[var(--teal-d)]' : 'bg-[var(--brick)] hover:brightness-105'}`}>
        {loading ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : type === 'income' ? 'Ghi khoản thu' : 'Ghi khoản chi'}
      </button>
    </form>
  );
}
