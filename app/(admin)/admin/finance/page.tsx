// Tab Thu chi: KPI + bảng giao dịch CRUD (thêm/sửa/xóa) + lọc + tìm kiếm.
import { getBookings, getTransactions } from '@/lib/queries';
import { monthPeriod } from '@/lib/report';
import { moneyShort } from '@/lib/format';
import { Kpi, PageTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FinanceTable, type TxnRow } from './FinanceTable';

export default async function FinancePage() {
  const now = new Date();
  const period = monthPeriod(now.getFullYear(), now.getMonth());

  const [transactions, bookings] = await Promise.all([
    getTransactions(period),
    getBookings(),
  ]);

  const custByBooking = new Map(bookings.map((b) => [b.id, b.customer?.name ?? null]));

  const totalIn = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const rows: TxnRow[] = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    method: t.method,
    category: t.category,
    paid_at: t.paid_at,
    note: t.note,
    bookingCustomer: t.booking_id ? custByBooking.get(t.booking_id) ?? null : null,
  }));

  return (
    <div className="fade-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <PageTitle title="Thu chi" sub={`Tháng ${now.getMonth() + 1}/${now.getFullYear()} · ${transactions.length} giao dịch`} />
        <a
          href={`/api/export?year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
          className="rounded-xl px-3 py-2.5 text-[13px] font-semibold bg-white border border-[var(--line)] active:scale-[.98] hover:bg-[var(--paper)] transition-colors flex items-center gap-1.5 flex-none"
        >
          <Icon name="download" className="w-4 h-4" /> Excel
        </a>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:gap-4">
        <Kpi label="Đã thu" value={moneyShort(totalIn)} icon="trendUp" />
        <Kpi label="Đã chi" value={moneyShort(totalOut)} tone="warn" icon="trendDown" />
        <Kpi label="Dòng tiền" value={moneyShort(totalIn - totalOut)} tone="hero" icon="coins" />
      </div>

      <FinanceTable rows={rows} />
    </div>
  );
}
