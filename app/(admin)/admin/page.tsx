// Tab Tổng quan (mục 10). KPI + biểu đồ + công nợ.
import Link from 'next/link';
import { getBookings, getTransactions, getUnits, getSales } from '@/lib/queries';
import { buildReport, monthPeriod, yearPeriod, monthlySeries } from '@/lib/report';
import { remaining, isRevenue } from '@/lib/booking';
import { money, moneyShort, dm } from '@/lib/format';
import { Card, Kpi, PageTitle, Eyebrow } from '@/components/ui';
import { BarChart } from '@/components/BarChart';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isYear = view === 'year';
  const now = new Date();
  const year = now.getFullYear();
  const period = isYear ? yearPeriod(year) : monthPeriod(year, now.getMonth());

  const [bookings, transactions, units, sales] = await Promise.all([
    getBookings(),
    getTransactions(),
    getUnits(),
    getSales(),
  ]);

  const report = buildReport(bookings, transactions, units, period);
  const series = monthlySeries(bookings, transactions, units, year);

  // Nguồn khách trong kỳ: do sale mang về vs do chủ tư vấn + tổng hoa hồng sale.
  const inPer = (b: { checkin_date: string; checkout_date: string }) =>
    b.checkin_date <= period.to && b.checkout_date >= period.from;
  const revIn = bookings.filter((b) => isRevenue(b.status) && inPer(b));
  const saleRate = new Map(sales.map((s) => [s.id, Number(s.commission_rate)]));
  const bySale = revIn.filter((b) => b.sale_id);
  const byOwner = revIn.filter((b) => !b.sale_id);
  const custBySale = new Set(bySale.map((b) => b.customer_id)).size;
  const custByOwner = new Set(byOwner.map((b) => b.customer_id)).size;
  const saleCommission = bySale.reduce(
    (s, b) => s + Math.round(Number(b.total_amount) * (saleRate.get(b.sale_id!) ?? 0)),
    0,
  );

  // Công nợ: booking doanh thu còn thiếu tiền TRONG KỲ ĐANG XEM (trả phòng
  // trong kỳ), xếp theo ngày trả gần nhất. Danh sách cuộn được, không tràn.
  const debts = bookings
    .filter((b) => ['confirmed', 'staying', 'completed'].includes(b.status))
    .filter((b) => b.checkout_date >= period.from && b.checkout_date <= period.to)
    .map((b) => ({ b, owe: remaining(b, b.transactions) }))
    .filter((x) => x.owe > 0)
    .sort((a, z) => a.b.checkout_date.localeCompare(z.b.checkout_date));
  const oweTotal = debts.reduce((s, x) => s + x.owe, 0);

  const periodLabel = isYear ? `Cả năm ${year}` : `Tháng ${now.getMonth() + 1}/${year}`;

  return (
    <div className="fade-in space-y-4 lg:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <PageTitle title="Tổng quan" sub={`${periodLabel} · cập nhật thời gian thực`} />
        <div className="flex bg-white border border-[var(--line)] rounded-xl p-1 text-[12px] font-semibold shadow-[0_1px_2px_rgba(16,32,46,0.04)]">
          <Link
            href="/admin"
            className={`px-3 py-1.5 rounded-lg transition-colors ${!isYear ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`}
          >
            Tháng
          </Link>
          <Link
            href="/admin?view=year"
            className={`px-3 py-1.5 rounded-lg transition-colors ${isYear ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'}`}
          >
            Cả năm
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4">
        <Kpi label="Doanh thu" value={moneyShort(report.revenue)} sub={`${report.bookingCount} đơn`} icon="trendUp" />
        <Kpi
          label="Chi phí"
          value={moneyShort(report.expense)}
          sub={report.revenue ? `${Math.round((report.expense / report.revenue) * 100)}% doanh thu` : '—'}
          tone="warn"
          icon="trendDown"
        />
        <Kpi
          label="Lãi"
          value={moneyShort(report.profit)}
          sub={`biên ${Math.round(report.margin)}%`}
          tone="hero"
          icon="coins"
        />
        <Kpi
          label="Công suất"
          value={`${Math.round(report.occupancy)}%`}
          sub={`${report.roomNightsSold}/${report.roomNightsAvailable} đêm-phòng`}
          icon="gauge"
        />
      </div>

      {/* Nguồn khách + hoa hồng sale */}
      <Card>
        <Eyebrow>Nguồn khách {periodLabel.toLowerCase()}</Eyebrow>
        <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
          <div>
            <div className="mono text-[19px] font-bold text-[var(--teal-d)]">{custBySale}</div>
            <div className="text-[11px] text-[var(--ink-3)] mt-0.5">Khách do sale</div>
          </div>
          <div>
            <div className="mono text-[19px] font-bold">{custByOwner}</div>
            <div className="text-[11px] text-[var(--ink-3)] mt-0.5">Khách do chủ</div>
          </div>
          <div>
            <div className="mono text-[19px] font-bold text-[var(--brick)]">{moneyShort(saleCommission)}</div>
            <div className="text-[11px] text-[var(--ink-3)] mt-0.5">Hoa hồng sale</div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4 lg:items-start">
      <Card>
        <Eyebrow>Doanh thu / chi phí theo tháng · {year}</Eyebrow>
        <div className="mt-2">
          <BarChart data={series} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div>
            <Eyebrow>Công nợ cần thu</Eyebrow>
            <div className="text-[11px] text-[var(--ink-3)] mt-0.5">
              {periodLabel} · {debts.length} khách
            </div>
          </div>
          <span className="mono text-xs font-bold text-[var(--tape-ink)]">{money(oweTotal)} ₫</span>
        </div>
        {debts.length === 0 ? (
          <p className="text-xs text-[var(--ink-3)] py-1">Không có công nợ trong kỳ này. 🎉</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto -mr-1 pr-1 divide-y divide-[var(--line)]">
            {debts.map(({ b, owe }) => (
              <div key={b.id} className="flex items-center justify-between py-2">
                <div className="text-[13px]">
                  {b.customer?.name}
                  <div className="text-[11px] text-[var(--ink-3)]">
                    {b.unit?.name} · trả {dm(b.checkout_date)}
                  </div>
                </div>
                <div className="mono text-[13px] font-bold text-[var(--tape-ink)]">{money(owe)} ₫</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
