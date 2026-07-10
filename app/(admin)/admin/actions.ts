'use server';

// Server Actions cho trang admin. Mọi thao tác chạy dưới session owner/manager
// → RLS ở database vẫn là chốt chặn cuối (mục 2, 8).
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { upsertCustomer } from '@/lib/customers';
import { toISODate } from '@/lib/format';

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult =
  | { ok: true; id: string; code: string | null }
  | { ok: false; error: string };

/** Dịch lỗi Postgres sang thông báo tiếng Việt thân thiện. */
function friendlyError(message: string): string {
  if (message.includes('TRUNG_LICH') || message.includes('no_overlap')) {
    return 'Trùng lịch: đơn vị này (hoặc căn/phòng liên quan) đã có khách trong khoảng ngày đó.';
  }
  if (message.includes('chk_dates')) {
    return 'Ngày trả phải sau ngày nhận.';
  }
  return message;
}

// ── Duyệt booking → confirmed + sinh mã LS… (mục 7) ────────────────
export async function approveBooking(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const today = toISODate(new Date());
  const { data: code, error: codeErr } = await supabase.rpc('gen_booking_code', {
    p_when: today,
  });
  if (codeErr) return { ok: false, error: friendlyError(codeErr.message) };

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', code })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Từ chối booking → rejected (nhả ngày) ──────────────────────────
export async function rejectBooking(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'rejected' })
    .eq('id', id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Đổi trạng thái (nhận phòng / trả phòng / hủy) ──────────────────
export async function setBookingStatus(
  id: string,
  status: 'staying' | 'completed' | 'cancelled',
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Tạo booking (admin tạo vào thẳng confirmed) (mục 7) ────────────
export interface CreateBookingInput {
  customerName: string;
  customerPhone?: string;
  unitId: string;
  checkin: string;
  checkout: string;
  guestsAdult: number;
  guestsChild?: number;
  pricePerNight: number;
  source?: string;
  saleId?: string;
  note?: string;
  referrerPhone?: string; // SĐT người giới thiệu (nếu nguồn = giới thiệu)
}

export async function createBooking(input: CreateBookingInput): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Gộp/khởi tạo khách theo SĐT (khách quay lại + người giới thiệu)
  let customerId: string;
  try {
    customerId = await upsertCustomer(supabase, {
      name: input.customerName,
      phone: input.customerPhone,
      referrerPhone: input.source === 'referral' ? input.referrerPhone : undefined,
    });
  } catch (e) {
    return { ok: false, error: friendlyError((e as Error).message) };
  }

  // 2. Sinh mã ngay (admin tạo → confirmed)
  const { data: code } = await supabase.rpc('gen_booking_code', {
    p_when: toISODate(new Date()),
  });

  // 3. Tạo booking confirmed
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .insert({
      code,
      unit_id: input.unitId,
      customer_id: customerId,
      checkin_date: input.checkin,
      checkout_date: input.checkout,
      guests_adult: input.guestsAdult,
      guests_child: input.guestsChild ?? 0,
      price_per_night: input.pricePerNight,
      status: 'confirmed',
      source: input.source ?? null,
      sale_id: input.saleId ?? null,
      note: input.note ?? null,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();
  if (bErr) return { ok: false, error: friendlyError(bErr.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true, id: booking.id as string, code: (code as string) ?? null };
}

// ── Tra khách theo SĐT: cũ hay mới? (dùng khi tạo đơn) ─────────────
export type CustomerLookup =
  | { found: false }
  | {
      found: true;
      id: string;
      name: string;
      timesStayed: number;
      referrerName: string | null;
    };

export async function lookupCustomerByPhone(phone: string): Promise<CustomerLookup> {
  const p = phone.trim();
  if (p.length < 6) return { found: false };
  const supabase = await createClient();
  const { data: c } = await supabase
    .from('customers')
    .select('id, name, referred_by')
    .eq('phone', p)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!c) return { found: false };

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', c.id)
    .in('status', ['confirmed', 'staying', 'completed']);

  let referrerName: string | null = null;
  if (c.referred_by) {
    const { data: ref } = await supabase
      .from('customers')
      .select('name')
      .eq('id', c.referred_by)
      .maybeSingle();
    referrerName = ref?.name ?? null;
  }

  return { found: true, id: c.id, name: c.name, timesStayed: count ?? 0, referrerName };
}

// ── Sửa đơn (CRUD): ngày, đơn vị, giá, số khách, ghi chú ───────────
export interface UpdateBookingInput {
  id: string;
  unitId?: string;
  checkin?: string;
  checkout?: string;
  guestsAdult?: number;
  guestsChild?: number;
  pricePerNight?: number;
  source?: string;
  note?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
}

export async function updateBooking(input: UpdateBookingInput): Promise<ActionResult> {
  const supabase = await createClient();

  // Cập nhật thông tin khách nếu có
  if (input.customerId && (input.customerName || input.customerPhone)) {
    await supabase
      .from('customers')
      .update({
        ...(input.customerName ? { name: input.customerName } : {}),
        ...(input.customerPhone ? { phone: input.customerPhone } : {}),
      })
      .eq('id', input.customerId);
  }

  const patch: Record<string, unknown> = {};
  if (input.unitId) patch.unit_id = input.unitId;
  if (input.checkin) patch.checkin_date = input.checkin;
  if (input.checkout) patch.checkout_date = input.checkout;
  if (input.guestsAdult != null) patch.guests_adult = input.guestsAdult;
  if (input.guestsChild != null) patch.guests_child = input.guestsChild;
  if (input.pricePerNight != null) patch.price_per_night = input.pricePerNight;
  if (input.source !== undefined) patch.source = input.source;
  if (input.note !== undefined) patch.note = input.note;

  const { error } = await supabase.from('bookings').update(patch).eq('id', input.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── GIỮ CHỖ TỨC THÌ (hold-on-tap) ──────────────────────────────────
// Vừa bấm chọn ngày là tạo 1 "giữ chỗ" → khóa ô đó ngay (người khác thấy
// "đang có khách đặt"). Hết 10' không chốt thì cron tự nhả.
export async function createHold(
  unitId: string,
  checkin: string,
  checkout: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: unit } = await supabase
    .from('units')
    .select('base_price')
    .eq('id', unitId)
    .single();

  const holdExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      unit_id: unitId,
      checkin_date: checkin,
      checkout_date: checkout,
      price_per_night: unit?.base_price ?? 0,
      status: 'pending',
      hold_expires_at: holdExpires,
      created_by: user?.id ?? null,
      sale_id: user?.id ?? null,
    })
    .select('id')
    .single();
  if (error) {
    if (error.message.includes('TRUNG_LICH') || error.message.includes('no_overlap')) {
      return { ok: false, error: 'Ngày này vừa có người đặt. Chọn ngày khác nhé.' };
    }
    return { ok: false, error: friendlyError(error.message) };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, id: data.id as string };
}

// Nhả giữ chỗ (khi hủy form). Chỉ xóa nếu còn là pending (giữ chỗ).
export async function releaseHold(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('bookings').delete().eq('id', id).eq('status', 'pending');
  revalidatePath('/admin', 'layout');
}

// Chốt giữ chỗ thành đơn chính thức (khi lưu form).
export async function confirmHold(
  holdId: string,
  input: CreateBookingInput,
): Promise<CreateResult> {
  const supabase = await createClient();
  let customerId: string;
  try {
    customerId = await upsertCustomer(supabase, {
      name: input.customerName,
      phone: input.customerPhone,
      referrerPhone: input.source === 'referral' ? input.referrerPhone : undefined,
    });
  } catch (e) {
    return { ok: false, error: friendlyError((e as Error).message) };
  }
  const { data: code } = await supabase.rpc('gen_booking_code', {
    p_when: toISODate(new Date()),
  });
  const { error } = await supabase
    .from('bookings')
    .update({
      code,
      customer_id: customerId,
      unit_id: input.unitId,
      checkin_date: input.checkin,
      checkout_date: input.checkout,
      guests_adult: input.guestsAdult,
      guests_child: input.guestsChild ?? 0,
      price_per_night: input.pricePerNight,
      status: 'confirmed',
      source: input.source ?? null,
      sale_id: input.saleId ?? null,
      note: input.note ?? null,
      hold_expires_at: null,
    })
    .eq('id', holdId);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true, id: holdId, code: (code as string) ?? null };
}

// ── Ghi chú nhanh cho đơn ──────────────────────────────────────────
export async function updateBookingNote(id: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('bookings').update({ note }).eq('id', id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Xóa đơn (nhả ngày) ─────────────────────────────────────────────
export async function deleteBooking(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Ghi khoản thu / chi (mục 10 tab Sổ thu chi) ────────────────────
export interface TxnInput {
  bookingId?: string;
  type: 'income' | 'expense';
  amount: number;
  method?: string;
  category?: string;
  paidAt?: string;
  note?: string;
  receiptUrl?: string;
}

export async function addTransaction(input: TxnInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('transactions').insert({
    booking_id: input.bookingId ?? null,
    type: input.type,
    amount: input.amount,
    method: input.method ?? null,
    category: input.category ?? null,
    paid_at: input.paidAt ?? toISODate(new Date()),
    note: input.note ?? null,
    receipt_url: input.receiptUrl ?? null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function updateTransaction(input: {
  id: string;
  type?: 'income' | 'expense';
  amount?: number;
  method?: string;
  category?: string;
  paidAt?: string;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.type) patch.type = input.type;
  if (input.amount != null) patch.amount = input.amount;
  if (input.method !== undefined) patch.method = input.method || null;
  if (input.category !== undefined) patch.category = input.category || null;
  if (input.paidAt) patch.paid_at = input.paidAt;
  if (input.note !== undefined) patch.note = input.note || null;
  const { error } = await supabase.from('transactions').update(patch).eq('id', input.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Đánh dấu đã trả hoa hồng → sinh expense category='commission' (mục 13) ──
export async function payCommission(
  saleId: string,
  amount: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('transactions').insert({
    type: 'expense',
    amount,
    category: 'commission',
    method: 'transfer',
    paid_at: toISODate(new Date()),
    note: `Hoa hồng sale ${saleId}`,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Đổi token sale → thu hồi link cũ ngay (mục 9) ──────────────────
export async function rotateSaleToken(saleId: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Token mới ngẫu nhiên. Chỉ owner/manager mới update được (RLS).
  const token = `sale-${crypto.randomUUID()}`;
  const { error } = await supabase
    .from('profiles')
    .update({ sale_token: token })
    .eq('id', saleId)
    .eq('role', 'sale');
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── CRUD KHÁCH HÀNG ────────────────────────────────────────────────
export async function createCustomer(input: {
  name: string;
  phone?: string;
  zalo?: string;
  note?: string;
  referrerPhone?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  let referredBy: string | null = null;
  if (input.referrerPhone?.trim()) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', input.referrerPhone.trim())
      .maybeSingle();
    referredBy = data?.id ?? null;
  }
  const { error } = await supabase.from('customers').insert({
    name: input.name,
    phone: input.phone?.trim() || null,
    zalo: input.zalo?.trim() || null,
    note: input.note?.trim() || null,
    referred_by: referredBy,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function updateCustomer(input: {
  id: string;
  name?: string;
  phone?: string;
  zalo?: string;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name != null) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.zalo !== undefined) patch.zalo = input.zalo.trim() || null;
  if (input.note !== undefined) patch.note = input.note.trim() || null;
  const { error } = await supabase.from('customers').update(patch).eq('id', input.id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'Khách này đã có đơn — không xóa được (để giữ lịch sử). Có thể sửa thông tin thay vì xóa.',
    };
  }
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── CRUD nhân viên SALE ────────────────────────────────────────────
// Tạo sale cần một dòng auth.users (do FK). Dùng service role, nhưng CHẶN
// quyền thủ công trước (service bỏ qua RLS).
async function assertAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Chưa đăng nhập' };
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!data || (data.role !== 'owner' && data.role !== 'manager')) {
    return { ok: false, error: 'Không có quyền' };
  }
  return { ok: true, userId: user.id };
}

export async function createSale(input: {
  name: string;
  phone?: string;
  commissionRate: number; // 0.10 = 10%
}): Promise<ActionResult> {
  // Sale không cần tài khoản auth → chỉ 1 dòng hồ sơ (RLS owner/manager).
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').insert({
    id: crypto.randomUUID(),
    name: input.name,
    phone: input.phone ?? null,
    role: 'sale',
    commission_rate: input.commissionRate,
    sale_token: `sale-${crypto.randomUUID()}`,
    active: true,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function updateSale(input: {
  id: string;
  name?: string;
  phone?: string;
  commissionRate?: number;
  active?: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient(); // RLS: chỉ owner/manager sửa được
  const patch: Record<string, unknown> = {};
  if (input.name != null) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.commissionRate != null) patch.commission_rate = input.commissionRate;
  if (input.active != null) patch.active = input.active;
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', input.id)
    .eq('role', 'sale');
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

/**
 * Xóa sale: nếu còn đơn thì KHÓA (active=false) để giữ lịch sử; nếu chưa có
 * đơn nào thì xóa hẳn (xóa auth user → cascade profile).
 */
export async function deleteSale(id: string): Promise<ActionResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const supabase = await createClient();

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('sale_id', id);

  if ((count ?? 0) > 0) {
    // Còn đơn → khóa để giữ lịch sử.
    const { error } = await supabase
      .from('profiles')
      .update({ active: false, sale_token: null })
      .eq('id', id);
    if (error) return { ok: false, error: friendlyError(error.message) };
    revalidatePath('/admin', 'layout');
    return { ok: true };
  }

  // Chưa có đơn → xóa hẳn hồ sơ (RLS owner/manager).
  const { error } = await supabase.from('profiles').delete().eq('id', id).eq('role', 'sale');
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ── Sign out ───────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
