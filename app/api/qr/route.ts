// Proxy ảnh QR VietQR về cùng origin → để vẽ lên canvas (ảnh xác nhận) không
// bị "tainted" bởi CORS. Ảnh QR là công khai nên route này không cần auth.
import { NextResponse } from 'next/server';
import { vietQrUrl } from '@/lib/vietqr';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const amount = Number(url.searchParams.get('amount') ?? '0');
  const code = url.searchParams.get('code') ?? 'thanh-toan';
  try {
    const res = await fetch(vietQrUrl(amount, code));
    if (!res.ok) return NextResponse.json({ error: 'qr fetch failed' }, { status: 502 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'qr error' }, { status: 502 });
  }
}
