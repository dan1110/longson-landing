// Tab Khách: bảng CRUD + tìm kiếm + theo dõi khách quay lại / giới thiệu.
import { getCustomers, getBookings } from '@/lib/queries';
import { isRevenue } from '@/lib/booking';
import { PageTitle } from '@/components/ui';
import { CustomersTable, type CustomerRow } from './CustomersTable';

export default async function CustomersPage() {
  const [customers, bookings] = await Promise.all([getCustomers(), getBookings()]);
  const byId = new Map(customers.map((c) => [c.id, c]));

  const stats = new Map<string, { stays: number; spend: number }>();
  for (const b of bookings) {
    if (!isRevenue(b.status) || !b.customer_id) continue;
    const s = stats.get(b.customer_id) ?? { stays: 0, spend: 0 };
    s.stays += 1;
    s.spend += Number(b.total_amount);
    stats.set(b.customer_id, s);
  }
  const referredCount = new Map<string, number>();
  for (const c of customers) {
    if (c.referred_by) referredCount.set(c.referred_by, (referredCount.get(c.referred_by) ?? 0) + 1);
  }

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    zalo: c.zalo,
    note: c.note,
    stays: stats.get(c.id)?.stays ?? 0,
    spend: stats.get(c.id)?.spend ?? 0,
    referred: referredCount.get(c.id) ?? 0,
    referrerName: c.referred_by ? byId.get(c.referred_by)?.name ?? null : null,
  }));

  const returning = rows.filter((r) => r.stays > 1).length;
  const referrers = rows.filter((r) => r.referred > 0).length;

  return (
    <div className="fade-in space-y-4">
      <PageTitle
        title="Khách hàng"
        sub={`${rows.length} khách · ${returning} khách quay lại · ${referrers} khách có giới thiệu`}
      />
      <CustomersTable rows={rows} />
    </div>
  );
}
