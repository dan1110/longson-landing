'use client';

// Lịch tháng dạng lưới (như Apple Calendar): chuyển tháng ‹ › Hôm nay,
// chọn phòng, chọn KHOẢNG NGÀY tùy ý (2 lần chạm) để đặt — kể cả tháng sau.
import { useMemo, useState } from 'react';
import type { BookingFull, Unit } from '@/lib/database.types';
import { parseDate, toISODate, dm } from '@/lib/format';
import { Icon } from './Icon';

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
  dow: number; // 0=CN..6=T7
}

export function MonthCalendar({
  units,
  bookings,
  initialYear,
  initialMonth0,
  onPickBooking,
  onCreateRange,
  hideNames = false,
}: {
  units: (Unit & { home?: { name: string } })[];
  bookings: BookingFull[];
  initialYear: number;
  initialMonth0: number;
  onPickBooking?: (b: BookingFull) => void;
  onCreateRange?: (unitId: string, checkin: string, checkout: string) => void;
  hideNames?: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [month0, setMonth0] = useState(initialMonth0);
  const [unitId, setUnitId] = useState<string>(units[0]?.id ?? 'all');
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const todayIso = useMemo(() => toISODate(new Date()), []);

  // 6 tuần (42 ô), bắt đầu từ Thứ 2 của tuần chứa ngày 1.
  const cells = useMemo<Cell[]>(() => {
    const first = new Date(year, month0, 1);
    const offset = (first.getDay() + 6) % 7; // 0 nếu là Thứ 2
    const start = new Date(year, month0, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return {
        iso: toISODate(d),
        day: d.getDate(),
        inMonth: d.getMonth() === month0,
        dow: d.getDay(),
      };
    });
  }, [year, month0]);

  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status !== 'rejected' &&
          b.status !== 'cancelled' &&
          (unitId === 'all' || b.unit_id === unitId),
      ),
    [bookings, unitId],
  );

  function bookingsOn(iso: string): BookingFull[] {
    return activeBookings.filter((b) => b.checkin_date <= iso && b.checkout_date > iso);
  }

  function prevMonth() {
    const d = new Date(year, month0 - 1, 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  }
  function nextMonth() {
    const d = new Date(year, month0 + 1, 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  }
  function goToday() {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  }

  // Ngày đã bận (chỉ xét khi đang xem 1 phòng cụ thể) → không cho chọn.
  const dayBusy = (iso: string) => unitId !== 'all' && bookingsOn(iso).length > 0;
  const anyBusyInRange = (a: string, b: string) => {
    let d = parseDate(a);
    const end = parseDate(b);
    while (d < end) {
      if (dayBusy(toISODate(d))) return true;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return false;
  };

  // Chọn khoảng: chạm 1 = nhận, chạm 2 = trả.
  function onDayClick(iso: string) {
    if (!onCreateRange) return;
    if (dayBusy(iso)) return; // ô đã có khách/đang đặt → chặn
    if (!rangeStart) {
      setRangeStart(iso);
      setHover(iso);
      return;
    }
    let checkin = rangeStart;
    let checkout = iso;
    if (checkout <= checkin) {
      // chạm cùng ngày hoặc trước → 1 đêm
      checkin = iso <= rangeStart ? iso : rangeStart;
      const c = parseDate(checkin);
      checkout = toISODate(new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1));
    }
    if (anyBusyInRange(checkin, checkout)) {
      alert('Khoảng ngày này có ngày đã được đặt. Chọn khoảng khác nhé.');
      setRangeStart(null);
      setHover(null);
      return;
    }
    const unit = unitId === 'all' ? '' : unitId;
    setRangeStart(null);
    setHover(null);
    onCreateRange(unit, checkin, checkout);
  }

  function inSelRange(iso: string): boolean {
    if (!rangeStart || !hover) return false;
    const [a, b] = rangeStart <= hover ? [rangeStart, hover] : [hover, rangeStart];
    return iso >= a && iso <= b;
  }

  return (
    <div className="bg-white border border-[var(--line)] rounded-2xl shadow-[0_1px_2px_rgba(16,32,46,0.04)] overflow-hidden">
      {/* Thanh điều khiển */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--line)] flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[var(--paper)] text-[var(--ink-2)]" aria-label="Tháng trước">
            <Icon name="chevronRight" className="w-4 h-4 rotate-180" />
          </button>
          <button onClick={goToday} className="px-3 h-8 rounded-lg text-[12px] font-semibold hover:bg-[var(--paper)] text-[var(--ink-2)]">
            Hôm nay
          </button>
          <button onClick={nextMonth} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[var(--paper)] text-[var(--ink-2)]" aria-label="Tháng sau">
            <Icon name="chevronRight" className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[16px] font-extrabold tracking-tight flex-1">
          {MONTHS[month0]} <span className="text-[var(--ink-3)] font-bold">{year}</span>
        </div>
        <select
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          className="text-[13px] font-semibold border border-[var(--line)] rounded-lg px-2.5 h-9 bg-white focus:outline-none focus:border-[var(--teal)]"
        >
          <option value="all">Tất cả phòng</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.home?.name} · {u.name}
            </option>
          ))}
        </select>
      </div>

      {rangeStart && (
        <div className="px-3 py-2 bg-[#e6f4ec] text-[12px] font-semibold text-[var(--teal-d)] flex items-center justify-between">
          <span>Nhận {dm(rangeStart)} — chạm ngày trả phòng…</span>
          <button onClick={() => { setRangeStart(null); setHover(null); }} className="text-[var(--ink-3)] underline">Hủy</button>
        </div>
      )}

      {/* Tiêu đề thứ */}
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[var(--ink-3)] border-b border-[var(--line)]">
        {DOW.map((d, i) => (
          <div key={d} className={`py-2 ${i >= 5 ? 'text-[var(--brick)]' : ''}`}>{d}</div>
        ))}
      </div>

      {/* Lưới ngày */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const dayBookings = bookingsOn(c.iso);
          const isToday = c.iso === todayIso;
          const selecting = inSelRange(c.iso);
          const blocked = !!onCreateRange && dayBusy(c.iso);
          return (
            <button
              key={c.iso}
              onClick={() => onDayClick(c.iso)}
              onMouseEnter={() => rangeStart && setHover(c.iso)}
              disabled={blocked}
              className={`text-left min-h-[76px] lg:min-h-[92px] p-1.5 border-b border-r border-[var(--line)] align-top transition-colors ${
                i % 7 === 6 ? 'border-r-0' : ''
              } ${
                blocked
                  ? 'bg-[#f2f4f6] cursor-not-allowed'
                  : c.inMonth
                    ? 'bg-white'
                    : 'bg-[#fafbfc]'
              } ${selecting ? '!bg-[#e6f4ec]' : blocked ? '' : 'hover:bg-[var(--paper)]'}`}
            >
              <div className="flex justify-end">
                <span
                  className={`inline-grid place-items-center w-6 h-6 rounded-full text-[12px] font-semibold ${
                    isToday
                      ? 'bg-[var(--brick)] text-white'
                      : c.inMonth
                        ? c.dow === 0 || c.dow === 6
                          ? 'text-[var(--brick)]'
                          : 'text-[var(--ink)]'
                        : 'text-[var(--lock-line)]'
                  }`}
                >
                  {c.day}
                </span>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {dayBookings.slice(0, 3).map((b) => {
                  const pend = b.status === 'pending';
                  const u = units.find((x) => x.id === b.unit_id);
                  const who = pend
                    ? 'Đang có khách đặt'
                    : hideNames
                      ? 'Đã đặt'
                      : b.customer?.name ?? b.code ?? 'Đơn';
                  const label = unitId === 'all' ? `${who} · ${u?.name ?? ''}` : who;
                  return (
                    <span
                      key={b.id}
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickBooking?.(b);
                      }}
                      className={`block text-[10px] leading-tight font-medium px-1.5 py-0.5 rounded-md truncate cursor-pointer ${
                        pend
                          ? 'bg-[var(--pend)] text-[var(--pend-ink)] border border-[var(--pend-line)]'
                          : 'bg-[var(--tape)] text-[var(--tape-ink)]'
                      }`}
                      title={label}
                    >
                      {pend ? '⏳ ' : ''}{label}
                    </span>
                  );
                })}
                {dayBookings.length > 3 && (
                  <span className="block text-[9.5px] text-[var(--ink-3)] pl-1">+{dayBookings.length - 3} nữa</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
