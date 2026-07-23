'use client';

// Microsoft Clarity — chỉ chạy ở PRODUCTION và khi có Project ID.
// Component này render null; đặt trong <body> của app/layout.tsx để giữ
// layout là Server Component (không cần 'use client' ở layout).
import { useEffect } from 'react';
import Clarity from '@microsoft/clarity';

export function ClarityAnalytics() {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'production' &&
      projectId
    ) {
      Clarity.init(projectId);
    }
  }, []);

  return null;
}
