'use client';

// Menu 3 chấm (⋮) cho mỗi dòng bảng — tái sử dụng cho mọi bảng CRUD.
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onClick: () => void;
  danger?: boolean;
}

export function RowMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="Tùy chọn"
        aria-haspopup="menu"
        className="w-8 h-8 grid place-items-center rounded-lg text-[var(--ink-3)] hover:bg-[var(--paper)] hover:text-[var(--ink)] transition-colors"
      >
        <Icon name="more" className="w-[18px] h-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[150px] bg-white border border-[var(--line)] rounded-xl shadow-[0_8px_24px_rgba(16,32,46,0.14)] py-1"
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-left transition-colors ${
                it.danger
                  ? 'text-[var(--tape-ink)] hover:bg-[#fdf3f1]'
                  : 'text-[var(--ink)] hover:bg-[var(--paper)]'
              }`}
            >
              {it.icon && <Icon name={it.icon} className="w-4 h-4" />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
