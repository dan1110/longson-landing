// Export báo cáo tháng ra .xlsx (mục 15) — bookings + transactions.
// Chủ vẫn cầm được file, không khóa dữ liệu vào app.
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABEL, SOURCE_LABEL, CATEGORY_LABEL } from '@/lib/booking';
import { dmy } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get('year') ?? now.getFullYear());
  const month = Number(url.searchParams.get('month') ?? now.getMonth() + 1); // 1-12
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  // RLS đảm bảo chỉ owner/manager gọi được mới lấy đủ dữ liệu.
  const [{ data: bookings }, { data: txns }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, unit:units(name), customer:customers(name,phone), sale:profiles!bookings_sale_id_fkey(name)')
      .lte('checkin_date', to)
      .gte('checkout_date', from)
      .order('checkin_date'),
    supabase.from('transactions').select('*').gte('paid_at', from).lte('paid_at', to),
  ]);

  const bookingRows = (bookings ?? []).map((b: any) => ({
    'Mã đơn': b.code ?? '',
    Khách: b.customer?.name ?? '',
    SĐT: b.customer?.phone ?? '',
    'Đơn vị': b.unit?.name ?? '',
    'Nhận phòng': dmy(b.checkin_date),
    'Trả phòng': dmy(b.checkout_date),
    'Số đêm': b.nights,
    'Số khách': b.guests_adult + b.guests_child,
    'Giá/đêm': b.price_per_night,
    'Tổng tiền': b.total_amount,
    'Trạng thái': STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status,
    Nguồn: SOURCE_LABEL[b.source] ?? b.source ?? '',
    Sale: b.sale?.name ?? '',
  }));

  const txnRows = (txns ?? []).map((t: any) => ({
    Ngày: dmy(t.paid_at),
    Loại: t.type === 'income' ? 'Thu' : 'Chi',
    'Số tiền': t.amount,
    'Danh mục': CATEGORY_LABEL[t.category] ?? t.category ?? '',
    'Hình thức': t.method === 'cash' ? 'Tiền mặt' : t.method === 'transfer' ? 'Chuyển khoản' : '',
    'Ghi chú': t.note ?? '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bookingRows), 'Đặt phòng');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), 'Thu chi');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="long-son-${year}-${String(month).padStart(2, '0')}.xlsx"`,
    },
  });
}
