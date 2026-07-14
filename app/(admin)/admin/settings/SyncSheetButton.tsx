'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { toast } from '@/components/Toast';

export function SyncSheetButton({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch('/api/sheets/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) toast.success('Đã đồng bộ toàn bộ dữ liệu lên Google Sheet.');
      else toast.error(data.error ?? 'Đồng bộ thất bại, thử lại.');
    } catch {
      toast.error('Không kết nối được, thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={sync}
        disabled={busy || !configured}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm bg-white border border-[var(--line)] hover:bg-[var(--paper)] transition-colors disabled:opacity-50"
      >
        <Icon name="upload" className="w-4 h-4" />
        {busy ? 'Đang đồng bộ…' : 'Đồng bộ Google Sheet ngay'}
      </button>
      <p className="text-[11px] text-[var(--ink-3)] mt-2">
        {configured
          ? 'Dữ liệu tự đồng bộ sau mỗi thay đổi. Nút này để đồng bộ lại thủ công (3 sheet: Khách · Sale · Thu chi).'
          : 'Chưa cấu hình — thêm biến môi trường GOOGLE_SHEETS_* để bật đồng bộ (xem .env.example).'}
      </p>
    </div>
  );
}
