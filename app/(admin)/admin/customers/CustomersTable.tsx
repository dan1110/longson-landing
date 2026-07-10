'use client';

// Bảng khách CRUD + tìm kiếm. Desktop = bảng, mobile = thẻ. Sắp xếp theo cột.
import { useMemo, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { RowMenu } from '@/components/RowMenu';
import { money } from '@/lib/format';
import { createCustomer, updateCustomer, deleteCustomer } from '../actions';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  zalo: string | null;
  note: string | null;
  stays: number;
  spend: number;
  referred: number;
  referrerName: string | null;
}

type SortKey = 'name' | 'stays' | 'spend';

const inputCls =
  'w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] bg-white focus:outline-none focus:border-[var(--teal)]';
const labelCls =
  'block text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-1.5';

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('stays');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<CustomerRow | null>(null);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = rows;
    if (kw) {
      list = rows.filter(
        (r) => r.name.toLowerCase().includes(kw) || (r.phone ?? '').includes(kw),
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sort === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = (a[sort] as number) - (b[sort] as number);
      return cmp * dir;
    });
  }, [rows, q, sort, dir]);

  function toggleSort(k: SortKey) {
    if (sort === k) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(k === 'name' ? 1 : -1);
    }
  }

  const Arrow = ({ k }: { k: SortKey }) =>
    sort === k ? <span className="text-[var(--teal)]">{dir === 1 ? '↑' : '↓'}</span> : null;

  return (
    <>
      {/* Thanh công cụ */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc SĐT…"
            className="w-full pl-9 pr-3 py-2.5 border border-[var(--line)] rounded-xl text-[14px] bg-white focus:outline-none focus:border-[var(--teal)]"
            inputMode="search"
          />
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center gap-1.5 flex-none"
        >
          <Icon name="plus" className="w-4 h-4" /> Thêm khách
        </button>
      </div>

      {view.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)] text-center py-10">
          {q ? 'Không tìm thấy khách phù hợp.' : 'Chưa có khách nào.'}
        </p>
      ) : (
        <>
          {/* Desktop: bảng */}
          <div className="hidden lg:block bg-white border border-[var(--line)] rounded-2xl shadow-[0_1px_2px_rgba(16,32,46,0.04)] [&_thead_th:first-child]:rounded-tl-2xl [&_thead_th:last-child]:rounded-tr-2xl [&_tbody_tr:last-child_td:first-child]:rounded-bl-2xl [&_tbody_tr:last-child_td:last-child]:rounded-br-2xl">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-[var(--paper)] text-[var(--ink-3)] text-[11px] uppercase tracking-wide">
                  <th className="text-left font-semibold px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('name')}>
                    Khách <Arrow k="name" />
                  </th>
                  <th className="text-left font-semibold px-4 py-2.5">SĐT</th>
                  <th className="text-right font-semibold px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('stays')}>
                    Số lần ở <Arrow k="stays" />
                  </th>
                  <th className="text-right font-semibold px-4 py-2.5 cursor-pointer" onClick={() => toggleSort('spend')}>
                    Tổng chi <Arrow k="spend" />
                  </th>
                  <th className="text-left font-semibold px-4 py-2.5">Giới thiệu</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)] hover:bg-[var(--paper)] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-[var(--teal)]/10 text-[var(--teal)] grid place-items-center font-bold text-[13px] flex-none">
                          {r.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold">{r.name}</span>
                        {r.stays > 1 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--teal)]/10 text-[var(--teal-d)]">quay lại</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 mono text-[var(--ink-2)]">{r.phone ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right mono font-semibold">{r.stays}</td>
                    <td className="px-4 py-2.5 text-right mono">{money(r.spend)} ₫</td>
                    <td className="px-4 py-2.5 text-[12.5px] text-[var(--ink-3)]">
                      {r.referred > 0 && <span className="text-[var(--teal-d)] font-semibold">+{r.referred} khách</span>}
                      {r.referrerName && <span> · do {r.referrerName}</span>}
                      {r.referred === 0 && !r.referrerName && '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <RowActions row={r} onEdit={() => setEditRow(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: thẻ */}
          <div className="lg:hidden space-y-2.5">
            {view.map((r) => (
              <div key={r.id} className="bg-white border border-[var(--line)] rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_1px_2px_rgba(16,32,46,0.04)]">
                <span className="w-11 h-11 rounded-full bg-[var(--teal)]/10 text-[var(--teal)] grid place-items-center font-bold flex-none">
                  {r.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <b className="text-[14px] truncate">{r.name}</b>
                    {r.stays > 1 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--teal)]/10 text-[var(--teal-d)] flex-none">quay lại ×{r.stays}</span>}
                  </div>
                  <div className="text-[11.5px] text-[var(--ink-3)] mt-0.5 flex flex-wrap gap-x-2">
                    {r.phone && <span className="mono">{r.phone}</span>}
                    <span>· {money(r.spend)} ₫</span>
                    {r.referred > 0 && <span className="text-[var(--teal-d)] font-semibold">· giới thiệu {r.referred}</span>}
                  </div>
                </div>
                <RowActions row={r} onEdit={() => setEditRow(r)} />
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Thêm khách">
        <CustomerForm onDone={() => setAddOpen(false)} />
      </Sheet>
      <Sheet open={!!editRow} onClose={() => setEditRow(null)} title={`Sửa ${editRow?.name ?? ''}`}>
        {editRow && <CustomerForm row={editRow} onDone={() => setEditRow(null)} />}
      </Sheet>
    </>
  );
}

function RowActions({ row, onEdit }: { row: CustomerRow; onEdit: () => void }) {
  async function remove() {
    if (!confirm(`Xóa khách ${row.name}?`)) return;
    const res = await deleteCustomer(row.id);
    if (!res.ok) alert(res.error);
  }
  return (
    <RowMenu
      items={[
        { label: 'Sửa', icon: 'edit', onClick: onEdit },
        { label: 'Xóa', icon: 'trash', danger: true, onClick: remove },
      ]}
    />
  );
}

function CustomerForm({ row, onDone }: { row?: CustomerRow; onDone: () => void }) {
  const editing = !!row;
  const [name, setName] = useState(row?.name ?? '');
  const [phone, setPhone] = useState(row?.phone ?? '');
  const [zalo, setZalo] = useState(row?.zalo ?? '');
  const [note, setNote] = useState(row?.note ?? '');
  const [referrerPhone, setReferrerPhone] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = editing
      ? await updateCustomer({ id: row!.id, name, phone, zalo, note })
      : await createCustomer({ name, phone, zalo, note, referrerPhone });
    setLoading(false);
    if (!res.ok) return setErr(res.error);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Tên khách</label>
        <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>SĐT</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div>
          <label className={labelCls}>Zalo</label>
          <input className={inputCls} value={zalo} onChange={(e) => setZalo(e.target.value)} inputMode="tel" />
        </div>
      </div>
      {!editing && (
        <div>
          <label className={labelCls}>SĐT người giới thiệu (nếu có)</label>
          <input className={inputCls} value={referrerPhone} onChange={(e) => setReferrerPhone(e.target.value)} inputMode="tel" placeholder="Khách cũ đã giới thiệu khách này" />
        </div>
      )}
      <div>
        <label className={labelCls}>Ghi chú</label>
        <textarea className={`${inputCls} min-h-[64px]`} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {err && <p className="text-[12px] text-[var(--tape-ink)] bg-[var(--tape)] rounded-lg px-3 py-2">{err}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-xl py-3.5 font-bold text-[15px] bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors disabled:opacity-60">
        {loading ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm khách'}
      </button>
    </form>
  );
}
