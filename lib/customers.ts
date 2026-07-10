// Gộp khách theo SĐT: cùng số điện thoại = cùng một khách → đếm được số lần ở
// (khách quay lại) và ai giới thiệu ai. Dùng cho create booking (admin + sale) + import.
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tìm khách theo SĐT, không có thì tạo mới. Trả về id khách.
 * Nếu có referrerPhone → gán referred_by (chỉ set nếu khách chưa có người giới thiệu).
 */
export async function upsertCustomer(
  supabase: SupabaseClient,
  input: {
    name: string;
    phone?: string | null;
    zalo?: string | null;
    referrerPhone?: string | null;
  },
): Promise<string> {
  const phone = input.phone?.trim() || null;

  // Người giới thiệu (nếu có SĐT khớp một khách đã tồn tại)
  let referredBy: string | null = null;
  const refPhone = input.referrerPhone?.trim();
  if (refPhone) {
    const { data: ref } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', refPhone)
      .limit(1)
      .maybeSingle();
    referredBy = ref?.id ?? null;
  }

  // Khách đã tồn tại theo SĐT?
  if (phone) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id, referred_by')
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();
    if (existing) {
      // Bổ sung người giới thiệu nếu trước đó chưa có
      if (referredBy && !existing.referred_by && referredBy !== existing.id) {
        await supabase
          .from('customers')
          .update({ referred_by: referredBy })
          .eq('id', existing.id);
      }
      return existing.id;
    }
  }

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      name: input.name,
      phone,
      zalo: input.zalo ?? null,
      referred_by: referredBy,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}
