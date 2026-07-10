'use client';

// Thanh điều hướng dưới đáy, ô bấm ≥44px (mục 2). Icon SVG, có safe-area.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 mx-auto max-w-[430px] bg-white/95 backdrop-blur border-t border-[var(--line)] flex z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((it) => {
        const active =
          pathname === it.href ||
          (it.href !== '/admin' && it.href !== '' && pathname.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`relative flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-semibold transition-colors ${
              active ? 'text-[var(--teal)]' : 'text-[var(--ink-3)]'
            }`}
          >
            <Icon name={it.icon} className={`w-[22px] h-[22px] ${active ? 'stroke-[2.4]' : ''}`} />
            <span>{it.label}</span>
            {it.badge ? (
              <span className="absolute top-1.5 right-[calc(50%-22px)] min-w-[16px] h-4 px-1 rounded-full bg-[var(--brick)] text-white text-[9px] font-bold grid place-items-center">
                {it.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
