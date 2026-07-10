// Tab Sales: bảng nhân viên. Click 1 dòng xem sale bán đơn nào, khách nào, tiền.
import { getSales, getBookings, getTransactions } from '@/lib/queries';
import { monthPeriod } from '@/lib/report';
import { isRevenue, paid } from '@/lib/booking';
import { money } from '@/lib/format';
import { PageTitle } from '@/components/ui';
import { SalesTable, type SaleRow } from './SalesTable';

export default async function SalesPage() {
  const now = new Date();
  const period = monthPeriod(now.getFullYear(), now.getMonth());
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  const [sales, bookings, transactions] = await Promise.all([
    getSales(),
    getBookings(),
    getTransactions(period),
  ]);

  const inPeriod = (b: { checkin_date: string; checkout_date: string }) =>
    b.checkin_date <= period.to && b.checkout_date >= period.from;

  const paidBySale = new Set(
    transactions
      .filter((t) => t.type === 'expense' && t.category === 'commission' && t.note)
      .map((t) => t.note!.replace('Hoa hồng sale ', '').trim()),
  );

  const rows: SaleRow[] = sales.map((s) => {
    const mine = bookings
      .filter((b) => b.sale_id === s.id)
      .sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
    const monthRev = mine.filter((b) => isRevenue(b.status) && inPeriod(b));
    const revenue = monthRev.reduce((sum, b) => sum + Number(b.total_amount), 0);
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      commissionRate: Number(s.commission_rate),
      active: s.active,
      saleToken: s.sale_token,
      orders: monthRev.length,
      revenue,
      commission: Math.round(revenue * Number(s.commission_rate)),
      commissionPaid: paidBySale.has(s.id),
      allTimeConfirmed: mine.filter((b) => isRevenue(b.status)).length,
      holds: mine.filter((b) => b.status === 'pending').length,
      bookings: mine.map((b) => ({
        id: b.id,
        code: b.code,
        customerName: b.customer?.name ?? '—',
        unitName: b.unit?.name ?? '—',
        checkin: b.checkin_date,
        checkout: b.checkout_date,
        nights: b.nights,
        amount: Number(b.total_amount),
        status: b.status,
        paid: paid(b.transactions),
      })),
    };
  });

  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="fade-in space-y-4">
      <PageTitle
        title="Sales"
        sub={`${sales.length} nhân viên · hoa hồng tháng ${now.getMonth() + 1}: ${money(totalCommission)} ₫`}
      />
      <SalesTable rows={rows} siteUrl={siteUrl} />
    </div>
  );
}
