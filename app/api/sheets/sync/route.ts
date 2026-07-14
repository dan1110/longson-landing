// Đồng bộ toàn bộ dữ liệu sang Google Sheet — dùng cho:
//  • Nút "Đồng bộ ngay" ở trang Cài đặt (đăng nhập owner/manager), hoặc
//  • Cron/định kỳ (Bearer CRON_SECRET).
// Sync tự động sau mỗi thay đổi đã chạy nền trong actions; route này để chạy tay.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sheetsConfigured, syncAllToSheets } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

async function authorize(request: Request): Promise<boolean> {
  // 1) Cron/hệ thống: Bearer CRON_SECRET
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) return true;

  // 2) Người dùng đăng nhập owner/manager
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'owner' || data?.role === 'manager';
}

async function handle(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!sheetsConfigured()) {
    return NextResponse.json(
      { error: 'Chưa cấu hình Google Sheet (thiếu biến môi trường).' },
      { status: 400 },
    );
  }
  const res = await syncAllToSheets();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const GET = handle; // cho Vercel Cron
export const POST = handle; // cho nút bấm tay
