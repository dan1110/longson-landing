import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--paper)]">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="text-lg font-extrabold">Không tìm thấy trang</h1>
      <p className="text-sm text-[var(--ink-3)] mt-2 max-w-xs leading-relaxed">
        Link không hợp lệ hoặc đã bị thu hồi. Vui lòng liên hệ chủ homestay để nhận link mới.
      </p>
      <Link href="/login" className="mt-6 rounded-xl px-5 py-2.5 font-bold bg-[var(--teal)] text-white">
        Về trang đăng nhập
      </Link>
    </main>
  );
}
