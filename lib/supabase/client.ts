// Supabase client cho phía trình duyệt (owner/manager đã đăng nhập).
// Dùng anon key — RLS là lớp bảo vệ thật (mục 2, 8).
'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
