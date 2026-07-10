'use client';

// Lưới an toàn cho trang Sale (không dùng realtime anon): refetch khi mở lại
// app + poll 3 phút (mục 16).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function FocusRefresher() {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(() => router.refresh(), 180_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, [router]);
  return null;
}
