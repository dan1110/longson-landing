'use client';

// Một dòng sale: copy link + đổi token (thu hồi) (mục 9).
import { useState, useTransition } from 'react';
import { rotateSaleToken } from '../actions';
import { confirmDialog } from '@/components/Toast';

export function SaleLinkRow({
  saleId,
  name,
  token,
  siteUrl,
}: {
  saleId: string;
  name: string;
  token: string | null;
  siteUrl: string;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const link = token ? `${siteUrl}/s/${token}` : '';

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function rotate() {
    if (!(await confirmDialog({ title: `Đổi link của ${name}?`, message: 'Link CŨ sẽ ngừng hoạt động ngay.', confirmText: 'Đổi link', danger: true }))) return;
    start(() => rotateSaleToken(saleId).then(() => {}));
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between">
        <b className="text-[14px]">{name}</b>
        <button
          onClick={rotate}
          disabled={pending}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border-[1.5px] border-[var(--tape-line)] text-[var(--tape-ink)] disabled:opacity-50"
        >
          {pending ? '…' : 'Đổi link'}
        </button>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <input
          readOnly
          value={link}
          className="flex-1 text-[11px] p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg mono"
        />
        <button
          onClick={copy}
          className="text-[12px] font-bold px-3 py-2 rounded-lg bg-[var(--teal)] text-white"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
