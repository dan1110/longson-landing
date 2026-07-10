'use client';

// Ô QR VietQR: số tiền CỐ ĐỊNH (không cho sửa) + nút tải ảnh về để gửi khách.
import { useState } from 'react';
import { vietQrUrl } from '@/lib/vietqr';
import { money } from '@/lib/format';
import { Icon } from './Icon';

export function QrBox({
  label,
  amount,
  code,
  filename,
}: {
  label: string;
  amount: number;
  code: string;
  filename?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const url = vietQrUrl(amount, code);

  async function download() {
    setDownloading(true);
    const name = `${filename ?? 'QR'}-${code}-${amount}.png`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch {
      // CORS chặn → mở tab mới cho người dùng lưu tay
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-2.5 text-center">
      <div className="text-[10.5px] font-semibold text-[var(--ink-3)] mb-1">{label}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`${label} ${money(amount)}`} className="w-full rounded-lg" width={160} height={200} />
      <div className="mono text-[13px] font-bold mt-1">{money(amount)} ₫</div>
      <button
        onClick={download}
        disabled={downloading}
        className="mt-1.5 w-full rounded-lg py-1.5 text-[11.5px] font-semibold bg-[var(--paper)] border border-[var(--line)] hover:bg-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <Icon name="download" className="w-3.5 h-3.5" />
        {downloading ? 'Đang tải…' : 'Tải QR'}
      </button>
    </div>
  );
}
