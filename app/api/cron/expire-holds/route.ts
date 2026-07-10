// Cron: hủy booking pending quá hạn giữ chỗ 30' (mục 7).
// Vercel Cron gọi mỗi 5 phút (xem vercel.json). Bảo vệ bằng CRON_SECRET.
// Dùng anon key + RPC expire_holds (SECURITY DEFINER) — KHÔNG cần secret key.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc('expire_holds');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, cancelled: data });
}
