import 'server-only';
// Client service-role (BỎ QUA RLS) — CHỈ dùng cho tác vụ nền tin cậy phía server
// như đồng bộ Google Sheet, nơi không có session người dùng để dựa vào RLS.
// TUYỆT ĐỐI không dùng ở code chạy phía client.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL cho admin client.');
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
