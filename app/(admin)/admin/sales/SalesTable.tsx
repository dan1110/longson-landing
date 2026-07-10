'use client';

// Bảng Sales CRUD + click 1 dòng để xem chi tiết: sale bán đơn nào, ngày nào,
// khách nào, bao nhiêu tiền. Desktop = bảng, mobile = thẻ.
import { useMemo, useState, useTransition } from 'react';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { RowMenu } from '@/components/RowMenu';
import { money, moneyShort, dm } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/booking';
import type { BookingStatus } from '@/lib/database.types';
import { SaleForm } from './SaleFormSheet';
import { rotateSaleToken, payCommission } from '../actions';

export interface SaleBookingLite {
  id: string;
  code: string | null;
  customerName: string;
  unitName: string;
  checkin: string;
  checkout: string;
  nights: number;
  amount: number;
  status: BookingStatus;
  paid: number;
}

export interface SaleRow {
  id: string;
  name: string;
  phone: string | null;
  commissionRate: number;
  active: boolean;
  saleToken: string | null;
  orders: number; // đơn tháng
  revenue: number; // doanh số tháng
  commission: number; // hoa hồng tháng
  commissionPaid: boolean;
  allTimeConfirmed: number;
  holds: number;
  bookings: SaleBookingLite[];
}

export function SalesTable({ rows, siteUrl }: { rows: SaleRow[]; siteUrl: string }) {
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editSale, setEditSale] = useState<SaleRow | null>(null);
  const [detail, setDetail] = useState<SaleRow | null>(null);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(kw) || (r.phone ?? '').includes(kw));
  }, [rows, q]);

  function menuFor(r: SaleRow) {
    return [
      { label: 'Xem chi tiết', icon: 'search' as const, onClick: () => setDetail(r) },
      { label: 'Sửa', icon: 'edit' as const, onClick: () => setEditSale(r) },
      {
        label: 'Đổi link',
        icon: 'share' as const,
        onClick: () => {
          if (confirm(`Đổi link của ${r.name}? Link cũ ngừng hoạt động ngay.`)) rotateSaleToken(r.id);
        },
      },
      {
        label: 'Copy link',
        icon: 'copy' as const,
        onClick: () => r.saleToken && navigator.clipboard.writeText(`${siteUrl}/s/${r.saleToken}`),
      },
    ];
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm nhân viên…"
            className="w-full pl-9 pr-3 py-2.5 border border-[var(--line)] rounded-xl text-[14px] bg-white focus:outline-none focus:border-[var(--teal)]"
          />
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center gap-1.5 flex-none"
        >
          <Icon name="plus" className="w-4 h-4" /> Thêm sale
        </button>
      </div>

      {/* Desktop bảng */}
      <div className="hidden lg:block bg-white border border-[var(--line)] rounded-2xl shadow-[0_1px_2px_rgba(16,32,46,0.04)] [&_thead_th:first-child]:rounded-tl-2xl [&_thead_th:last-child]:rounded-tr-2xl [&_tbody_tr:last-child_td:first-child]:rounded-bl-2xl [&_tbody_tr:last-child_td:last-child]:rounded-br-2xl">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-[var(--paper)] text-[var(--ink-3)] text-[11px] uppercase tracking-wide">
              <th className="text-left font-semibold px-4 py-2.5">Nhân viên</th>
              <th className="text-left font-semibold px-4 py-2.5">SĐT</th>
              <th className="text-right font-semibold px-4 py-2.5">HH%</th>
              <th className="text-right font-semibold px-4 py-2.5">Đơn tháng</th>
              <th className="text-right font-semibold px-4 py-2.5">Doanh số</th>
              <th className="text-right font-semibold px-4 py-2.5">Hoa hồng</th>
              <th className="px-4 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr
                key={r.id}
                onClick={() => setDetail(r)}
                className="border-t border-[var(--line)] hover:bg-[var(--paper)] transition-colors cursor-pointer"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[var(--teal)]/10 text-[var(--teal)] grid place-items-center font-bold text-[13px] flex-none">
                      {r.name.replace(/^Ms\.?\s*/i, '').charAt(0) || 'S'}
                    </span>
                    <span className="font-semibold">{r.name}</span>
                    {!r.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--paper)] text-[var(--ink-3)]">khóa</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5 mono text-[var(--ink-2)]">{r.phone ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">{Math.round(r.commissionRate * 100)}%</td>
                <td className="px-4 py-2.5 text-right mono font-semibold">{r.orders}</td>
                <td className="px-4 py-2.5 text-right mono">{money(r.revenue)}</td>
                <td className="px-4 py-2.5 text-right mono font-semibold text-[var(--teal-d)]">{money(r.commission)}</td>
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <RowMenu items={menuFor(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile thẻ */}
      <div className="lg:hidden space-y-2.5">
        {view.map((r) => (
          <button
            key={r.id}
            onClick={() => setDetail(r)}
            className="w-full text-left bg-white border border-[var(--line)] rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(16,32,46,0.04)]"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[var(--teal)]/10 text-[var(--teal)] grid place-items-center font-bold flex-none">
                {r.name.replace(/^Ms\.?\s*/i, '').charAt(0) || 'S'}
              </span>
              <div className="flex-1 min-w-0">
                <b className="text-[14px]">{r.name}</b>
                <div className="text-[11.5px] text-[var(--ink-3)]">{r.orders} đơn · doanh số {moneyShort(r.revenue)}</div>
              </div>
              <div className="text-right">
                <div className="mono text-[13px] font-bold text-[var(--teal-d)]">{moneyShort(r.commission)}</div>
                <div className="text-[9.5px] text-[var(--ink-3)]">hoa hồng</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Sheets */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Thêm nhân viên sale">
        <SaleForm onDone={() => setAddOpen(false)} />
      </Sheet>
      <Sheet open={!!editSale} onClose={() => setEditSale(null)} title={`Sửa ${editSale?.name ?? ''}`}>
        {editSale && (
          <SaleForm
            sale={{
              id: editSale.id,
              name: editSale.name,
              phone: editSale.phone,
              role: 'sale',
              commission_rate: editSale.commissionRate,
              sale_token: editSale.saleToken,
              active: editSale.active,
              created_at: '',
            }}
            onDone={() => setEditSale(null)}
          />
        )}
      </Sheet>
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? 'Chi tiết sale'}>
        {detail && <SaleDetail row={detail} siteUrl={siteUrl} />}
      </Sheet>
    </>
  );
}

function SaleDetail({ row, siteUrl }: { row: SaleRow; siteUrl: string }) {
  const [paying, startPay] = useTransition();
  const [copied, setCopied] = useState(false);
  const link = row.saleToken ? `${siteUrl}/s/${row.saleToken}` : '';

  return (
    <div className="space-y-3">
      {/* Số liệu tháng */}
      <div className="grid grid-cols-3 gap-2 bg-[var(--paper)] rounded-xl p-3 text-center">
        <div>
          <div className="mono text-[16px] font-bold">{row.orders}</div>
          <div className="text-[10.5px] text-[var(--ink-3)]">Đơn tháng này</div>
        </div>
        <div>
          <div className="mono text-[16px] font-bold">{moneyShort(row.revenue)}</div>
          <div className="text-[10.5px] text-[var(--ink-3)]">Doanh số</div>
        </div>
        <div>
          <div className="mono text-[16px] font-bold text-[var(--teal-d)]">{moneyShort(row.commission)}</div>
          <div className="text-[10.5px] text-[var(--ink-3)]">Hoa hồng</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] text-[var(--ink-3)]">
        <span>{row.allTimeConfirmed} đơn đã chốt · hoa hồng {Math.round(row.commissionRate * 100)}%</span>
        {row.commissionPaid ? (
          <span className="font-semibold text-[var(--teal-d)]">✓ đã trả HH tháng</span>
        ) : row.commission > 0 ? (
          <button
            onClick={() => startPay(() => payCommission(row.id, row.commission).then(() => {}))}
            disabled={paying}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-[var(--teal)] text-white hover:bg-[var(--teal-d)] disabled:opacity-50"
          >
            {paying ? '…' : `Trả ${money(row.commission)} ₫`}
          </button>
        ) : null}
      </div>

      {/* Link riêng */}
      {link && (
        <div className="flex items-center gap-2">
          <input readOnly value={link} className="flex-1 text-[11px] p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg mono" />
          <button
            onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-[12px] font-bold px-3 py-2 rounded-lg bg-[var(--teal)] text-white"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      )}

      {/* Danh sách đơn của sale */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-1.5">
          Các đơn đã bán ({row.bookings.length})
        </div>
        {row.bookings.length === 0 ? (
          <p className="text-[12px] text-[var(--ink-3)]">Chưa có đơn nào.</p>
        ) : (
          <div className="space-y-2">
            {row.bookings.map((b) => {
              const owe = b.amount - b.paid;
              return (
                <div key={b.id} className="bg-white border border-[var(--line)] rounded-xl p-2.5">
                  <div className="flex items-center justify-between">
                    <b className="text-[13px]">{b.customerName}</b>
                    <span className="mono text-[13px] font-bold">{money(b.amount)} ₫</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-[var(--ink-3)] mt-0.5">
                    <span>{b.unitName} · {dm(b.checkin)}→{dm(b.checkout)} · {b.nights} đêm</span>
                    <span className={owe > 0 ? 'text-[var(--tape-ink)] font-semibold' : 'text-[var(--teal-d)] font-semibold'}>
                      {b.status === 'pending' ? STATUS_LABEL[b.status] : owe > 0 ? `còn ${money(owe)}` : 'đủ'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
