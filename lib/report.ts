// Công thức báo cáo (mục 14) — làm cho đúng, không gộp nhầm.
import { parseDate, toISODate, nightsBetween } from './format';
import { isRevenue } from './booking';
import type { BookingFull, Transaction, Unit } from './database.types';

export interface Period {
  from: string; // 'YYYY-MM-DD' đầu kỳ (bao gồm)
  to: string; // 'YYYY-MM-DD' cuối kỳ (bao gồm)
  days: number;
}

/** Kỳ = 1 tháng. monthIndex 0-11. */
export function monthPeriod(year: number, month0: number): Period {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
  return {
    from: toISODate(first),
    to: toISODate(last),
    days: last.getDate(),
  };
}

/** Kỳ = cả năm. */
export function yearPeriod(year: number): Period {
  const first = new Date(year, 0, 1);
  const last = new Date(year, 11, 31);
  const days = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
  return { from: toISODate(first), to: toISODate(last), days };
}

/**
 * Trọng số đêm-phòng của 1 unit (mục 14):
 * nguyên căn có N phòng con = N đêm-phòng; đơn vị lẻ = 1.
 */
export function unitWeight(unit: Unit, allUnits: Unit[]): number {
  const children = allUnits.filter((u) => u.parent_unit_id === unit.id);
  return children.length || 1;
}

/** Số đơn vị "bán lẻ được" = các unit lá (không có con). */
export function sellableUnits(allUnits: Unit[]): Unit[] {
  const parentIds = new Set(
    allUnits.filter((u) => u.parent_unit_id).map((u) => u.parent_unit_id),
  );
  return allUnits.filter((u) => !parentIds.has(u.id));
}

function overlapNights(bkFrom: string, bkTo: string, p: Period): number {
  const s = Math.max(parseDate(bkFrom).getTime(), parseDate(p.from).getTime());
  // checkout là nửa mở; kỳ tính đến hết ngày p.to → +1 ngày
  const pEndExclusive = parseDate(p.to).getTime() + 86_400_000;
  const e = Math.min(parseDate(bkTo).getTime(), pEndExclusive);
  return Math.max(0, Math.round((e - s) / 86_400_000));
}

export interface ReportSummary {
  revenue: number; // doanh thu (ghi nhận theo giá trị booking)
  collected: number; // tiền thực thu
  debt: number; // công nợ = revenue - collected
  expense: number; // tổng chi (gồm hoa hồng)
  profit: number; // lãi = revenue - expense
  margin: number; // biên lãi %
  bookingCount: number;
  roomNightsSold: number;
  roomNightsAvailable: number;
  occupancy: number; // %
}

export function buildReport(
  bookings: BookingFull[],
  transactions: Transaction[],
  units: Unit[],
  period: Period,
): ReportSummary {
  // Doanh thu: booking CONFIRMED+ có đêm rơi vào kỳ → cộng full total_amount.
  const revBookings = bookings.filter(
    (b) =>
      isRevenue(b.status) && overlapNights(b.checkin_date, b.checkout_date, period) > 0,
  );
  const revenue = revBookings.reduce((s, b) => s + Number(b.total_amount), 0);

  // Tiền thực thu & chi: theo paid_at trong kỳ.
  const inPeriod = (d: string) => d >= period.from && d <= period.to;
  const collected = transactions
    .filter((t) => t.type === 'income' && inPeriod(t.paid_at))
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions
    .filter((t) => t.type === 'expense' && inPeriod(t.paid_at))
    .reduce((s, t) => s + Number(t.amount), 0);

  // Công suất theo đêm-phòng.
  const unitById = new Map(units.map((u) => [u.id, u]));
  let roomNightsSold = 0;
  for (const b of revBookings) {
    const u = unitById.get(b.unit_id);
    if (!u) continue;
    const nights = overlapNights(b.checkin_date, b.checkout_date, period);
    roomNightsSold += nights * unitWeight(u, units);
  }
  const roomNightsAvailable = sellableUnits(units).length * period.days;

  const debt = revenue - collected;
  const profit = revenue - expense;
  return {
    revenue,
    collected,
    debt,
    expense,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    bookingCount: revBookings.length,
    roomNightsSold,
    roomNightsAvailable,
    occupancy:
      roomNightsAvailable > 0 ? (roomNightsSold / roomNightsAvailable) * 100 : 0,
  };
}

/** Doanh thu/chi phí theo từng tháng trong năm — cho biểu đồ cột. */
export function monthlySeries(
  bookings: BookingFull[],
  transactions: Transaction[],
  units: Unit[],
  year: number,
): { month: number; revenue: number; expense: number }[] {
  const out = [];
  for (let m = 0; m < 12; m++) {
    const p = monthPeriod(year, m);
    const r = buildReport(bookings, transactions, units, p);
    out.push({ month: m + 1, revenue: r.revenue, expense: r.expense });
  }
  return out;
}
