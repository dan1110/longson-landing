'use client';

// Sidebar cho desktop (≥ lg). Trên mobile ẩn, thay bằng BottomNav.
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { NavItem } from './BottomNav';
import { Icon } from './Icon';
import { signOut } from '@/app/(admin)/admin/actions';

export function Sidebar({
  items,
  userName,
  userRole,
}: {
  items: NavItem[];
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col w-60 flex-none bg-[var(--ink)] text-white min-h-screen sticky top-0 h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-9 h-9 rounded-lg bg-white grid place-items-center overflow-hidden flex-none">
          <Image src="/logo-icon.png" alt="Long Sơn" width={36} height={36} className="w-full h-full object-contain" />
        </div>
        <div className="leading-tight">
          <b className="text-sm font-extrabold block">Long Sơn</b>
          <small className="text-[10.5px] text-[#8fa1b4]">Homestay</small>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {[...items, { href: '/admin/settings', label: 'Cài đặt', icon: 'settings' as const }].map(
          (it) => {
            const active =
              pathname === it.href ||
              (it.href !== '/admin' && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-[#8fa1b4] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-[var(--teal)]" />
                )}
                <Icon
                  name={it.icon}
                  className={`w-[19px] h-[19px] ${active ? 'text-[var(--teal)]' : ''}`}
                />
                <span className="flex-1">{it.label}</span>
                {'badge' in it && it.badge ? (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--brick)] text-white text-[11px] font-bold grid place-items-center">
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            );
          },
        )}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 mb-2">
          <b className="text-[13px] block">{userName}</b>
          <small className="text-[11px] text-[#8fa1b4]">{userRole}</small>
        </div>
        <form action={signOut}>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#8fa1b4] hover:bg-white/[0.06] hover:text-white transition-colors">
            <Icon name="logout" className="w-[17px] h-[17px]" />
            Đăng xuất
          </button>
        </form>
      </div>
    </aside>
  );
}
