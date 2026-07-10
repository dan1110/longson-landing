'use client';

// Realtime (mục 16): dùng sự kiện postgres_changes như "tiếng chuông" rồi
// gọi router.refresh() để lấy lại dữ liệu ĐÃ LỌC qua RLS — KHÔNG đọc payload thô.
// Kèm lưới an toàn: refetch khi mở lại app + poll 3 phút.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('bookings-bell')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => router.refresh(), // chỉ dùng như tín hiệu → refetch
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    const poll = setInterval(() => router.refresh(), 180_000); // 3 phút

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, [router]);

  return null;
}
