'use server';

// Import dữ liệu cũ từ Excel (mục 15). Chạy 1 lần lúc đầu để không mất lịch sử.
// Bỏ qua / đánh dấu dòng lỗi thay vì dừng hết.
import { createClient } from '@/lib/supabase/server';
import { nightsBetween } from '@/lib/format';

export interface ImportRow {
  customerName?: string;
  customerPhone?: string;
  unitName?: string; // sẽ khớp với units.name
  homeName?: string; // để phân biệt unit trùng tên giữa các home
  checkin?: string; // 'YYYY-MM-DD'
  checkout?: string;
  guests?: number;
  pricePerNight?: number;
  deposit?: number; // tạo transaction income category='deposit'
  saleName?: string;
  source?: string;
}

export interface ImportResult {
  imported: number;
  skipped: { row: number; reason: string }[];
}

export async function importBookings(rows: ImportRow[]): Promise<ImportResult> {
  // Chỉ owner/manager (kiểm qua session RLS) mới được import.
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return { imported: 0, skipped: [{ row: 0, reason: 'Chưa đăng nhập' }] };
  const { data: me } = await authed
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!me || (me.role !== 'owner' && me.role !== 'manager')) {
    return { imported: 0, skipped: [{ row: 0, reason: 'Không có quyền' }] };
  }

  // Dùng chính client đã đăng nhập (RLS owner/manager cho phép ghi) — không cần service key.
  const db = authed;
  const [{ data: units }, { data: sales }] = await Promise.all([
    db.from('units').select('id, name, base_price, home:homes(name)'),
    db.from('profiles').select('id, name').eq('role', 'sale'),
  ]);

  const findUnit = (name?: string, home?: string) => {
    if (!name) return null;
    const norm = (s: string) => s.trim().toLowerCase();
    const matches = (units ?? []).filter((u: any) => norm(u.name) === norm(name));
    if (home) {
      const byHome = matches.find((u: any) => norm(u.home?.name ?? '') === norm(home));
      if (byHome) return byHome;
    }
    return matches[0] ?? null;
  };
  const findSale = (name?: string) => {
    if (!name) return null;
    return (sales ?? []).find(
      (s: any) => s.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  };

  const skipped: ImportResult['skipped'] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2; // dòng Excel (1 là tiêu đề)
    try {
      if (!r.customerName) throw new Error('Thiếu tên khách');
      const unit: any = findUnit(r.unitName, r.homeName);
      if (!unit) throw new Error(`Không khớp đơn vị "${r.unitName ?? ''}"`);
      if (!r.checkin || !r.checkout) throw new Error('Thiếu ngày nhận/trả');
      if (nightsBetween(r.checkin, r.checkout) <= 0) throw new Error('Ngày trả phải sau ngày nhận');

      const price = r.pricePerNight ?? unit.base_price;
      const sale = findSale(r.saleName);

      // Tạo khách
      const { data: customer, error: cErr } = await db
        .from('customers')
        .insert({ name: r.customerName, phone: r.customerPhone ?? null })
        .select('id')
        .single();
      if (cErr) throw new Error(cErr.message);

      // Tạo booking (đã confirmed vì là dữ liệu lịch sử)
      const { data: code } = await db.rpc('gen_booking_code', { p_when: r.checkin });
      const { data: booking, error: bErr } = await db
        .from('bookings')
        .insert({
          code,
          unit_id: unit.id,
          customer_id: customer.id,
          checkin_date: r.checkin,
          checkout_date: r.checkout,
          guests_adult: r.guests ?? 1,
          price_per_night: price,
          status: 'confirmed',
          source: r.source ?? null,
          sale_id: sale?.id ?? null,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (bErr) throw new Error(bErr.message);

      // Cọc → transaction income
      if (r.deposit && r.deposit > 0) {
        await db.from('transactions').insert({
          booking_id: booking.id,
          type: 'income',
          amount: r.deposit,
          category: 'deposit',
          method: 'transfer',
          paid_at: r.checkin,
          created_by: user.id,
        });
      }
      imported++;
    } catch (e: any) {
      skipped.push({ row: rowNo, reason: e.message ?? 'Lỗi không rõ' });
    }
  }

  return { imported, skipped };
}
