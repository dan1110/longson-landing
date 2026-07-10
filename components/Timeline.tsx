'use client';

// Lịch timeline ngang (mục 10). Mỗi đơn vị 1 dòng, các cột ngày trong tháng.
// Thanh booking vẽ từ giữa ô ngày nhận đến giữa ô ngày trả.
import { useMemo } from 'react';
import type { BookingFull, Unit } from '@/lib/database.types';
import { parseDate, toISODate } from '@/lib/format';

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const CELL = 32;

export interface TimelineProps {
  units: (Unit & { home?: { name: string } })[];
  bookings: BookingFull[];
  year: number;
  month0: number; // 0-11
  /** Booking nào là "của mình" (tô hồng). Với sale = booking của sale đó. */
  mineSaleId?: string;
  /** admin thấy tên khách trên mọi thanh; sale chỉ thấy tên trên thanh của mình. */
  showAllNames?: boolean;
  onPickCell?: (unitId: string, date: string) => void;
  onPickBooking?: (booking: BookingFull) => void;
}

export function Timeline({
  units,
  bookings,
  year,
  month0,
  mineSaleId,
  showAllNames = true,
  onPickCell,
  onPickBooking,
}: TimelineProps) {
  const days = useMemo(() => {
    const n = new Date(year, month0 + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(year, month0, i + 1);
      return { day: i + 1, dow: d.getDay(), iso: toISODate(d) };
    });
  }, [year, month0]);

  const todayIso = useMemo(() => toISODate(new Date()), []);
  const monthStart = useMemo(() => new Date(year, month0, 1).getTime(), [year, month0]);

  function dayIndex(iso: string): number {
    return Math.round((parseDate(iso).getTime() - monthStart) / 86_400_000);
  }

  return (
    <div className="bg-white border border-[var(--line)] rounded-[12px] overflow-hidden">
      <div className="overflow-x-auto no-scrollbar">
        <div className="w-max min-w-full">
          {/* Header ngày */}
          <div className="flex sticky top-0 z-[3] bg-[var(--ink)] text-white">
            <div className="w-[74px] flex-none sticky left-0 z-[4] bg-[var(--ink)] text-[9px] flex items-center pl-2 uppercase tracking-wide text-[#8496a8]">
              Phòng
            </div>
            {days.map((d) => {
              const we = d.dow === 0 || d.dow === 6;
              const td = d.iso === todayIso;
              return (
                <div
                  key={d.day}
                  className={`w-8 flex-none text-center py-1 text-[9px] leading-tight border-l border-white/10 ${
                    td ? 'bg-[var(--teal)]' : we ? 'bg-[var(--brick)]' : ''
                  }`}
                >
                  {DOW[d.dow]}
                  <b className="block text-[11px]">{d.day}</b>
                </div>
              );
            })}
          </div>

          {/* Mỗi unit 1 dòng */}
          {units.map((u) => {
            const rowBookings = bookings.filter(
              (b) =>
                b.unit_id === u.id &&
                b.status !== 'rejected' &&
                b.status !== 'cancelled',
            );
            return (
              <div
                key={u.id}
                className="flex relative h-11 border-t border-[var(--line)]"
              >
                <div
                  className={`w-[74px] flex-none sticky left-0 z-[2] bg-white text-[11px] font-semibold flex flex-col justify-center px-2 border-r border-[var(--line)] ${
                    u.parent_unit_id ? 'pl-3.5' : ''
                  }`}
                >
                  <span className="leading-none">{u.name}</span>
                  <small className="text-[8.5px] text-[var(--ink-3)] font-normal truncate">
                    {u.home?.name}
                  </small>
                </div>

                {/* Ô ngày trống (bấm để tạo) */}
                <div className="flex relative">
                  {days.map((d) => {
                    const we = d.dow === 0 || d.dow === 6;
                    return (
                      <button
                        key={d.day}
                        onClick={() => onPickCell?.(u.id, d.iso)}
                        className={`w-8 h-11 flex-none border-l border-[var(--line)] ${
                          we ? 'bg-[#F7F9FA]' : ''
                        } active:bg-[var(--free)]`}
                        aria-label={`Tạo đơn ${u.name} ngày ${d.day}`}
                      />
                    );
                  })}

                  {/* Thanh booking */}
                  {rowBookings.map((b) => {
                    const ci = dayIndex(b.checkin_date);
                    const co = dayIndex(b.checkout_date);
                    // Cắt trong phạm vi tháng hiển thị
                    const left = Math.max(ci, 0) * CELL + CELL / 2;
                    const right = Math.min(co, days.length) * CELL + CELL / 2;
                    const width = Math.max(CELL, right - left);
                    const mine = mineSaleId && b.sale_id === mineSaleId;
                    const pend = b.status === 'pending';
                    let cls = '';
                    if (pend) cls = 'stripe-pend text-[var(--pend-ink)] border-[var(--pend-line)]';
                    else if (mine || showAllNames)
                      cls = 'bg-[var(--tape)] text-[var(--tape-ink)] border-[var(--tape-line)]';
                    else cls = 'bg-[var(--lock)] text-[var(--lock-ink)] border-[var(--lock-line)]';

                    const label =
                      showAllNames || mine
                        ? (b.customer?.name ?? b.code ?? 'Đơn')
                        : '🔒 Đã đặt';
                    return (
                      <button
                        key={b.id}
                        onClick={() => onPickBooking?.(b)}
                        className={`absolute top-1.5 h-8 rounded-md border text-[10px] font-semibold px-1.5 flex items-center overflow-hidden whitespace-nowrap ${cls}`}
                        style={{ left, width }}
                      >
                        {pend ? '⏳ ' : ''}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
