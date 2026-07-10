'use client';

// Menu hamburger cho mobile/tablet (< lg): top bar có nút ☰ → mở drawer trượt
// từ trái → chọn 1 mục là điều hướng + tự đóng. Desktop dùng Sidebar cố định.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { NavItem } from './BottomNav';
import { Icon } from './Icon';
import { signOut } from '@/app/(admin)/admin/actions';

export function MobileMenu({
  items,
  userName,
  userRole,
}: {
  items: NavItem[];
  userName: string;
  userRole: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Đóng drawer mỗi khi đổi trang + khóa cuộn nền khi mở.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const allItems: NavItem[] = [
    ...items,
    { href: '/admin/settings', label: 'Cài đặt', icon: 'settings' },
  ];

  return (
    <>
      {/* Top bar mobile */}
      <header className="lg:hidden bg-[var(--ink)] text-white px-3 h-14 flex items-center gap-2 flex-none">
        <button
          onClick={() => setOpen(true)}
          aria-label="Mở menu"
          className="w-10 h-10 grid place-items-center rounded-lg hover:bg-white/10 transition-colors"
        >
          <Icon name="menu" className="w-6 h-6" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-white grid place-items-center overflow-hidden flex-none">
          <Image src="/logo-icon.png" alt="Long Sơn" width={32} height={32} className="w-full h-full object-contain" />
        </div>
        <b className="text-[15px] font-bold flex-1 truncate">Long Sơn Homestay</b>
      </header>

      {/* Drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
        <aside
          className={`absolute left-0 top-0 h-full w-[280px] max-w-[82%] bg-[var(--ink)] text-white flex flex-col transition-transform duration-200 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
        >
          {/* Header drawer */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
            <div className="w-9 h-9 rounded-lg bg-white grid place-items-center overflow-hidden flex-none">
              <Image src="/logo-icon.png" alt="Long Sơn" width={36} height={36} className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 leading-tight">
              <b className="text-sm font-extrabold block">Long Sơn</b>
              <small className="text-[10.5px] text-[#8fa1b4]">Homestay</small>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/10 transition-colors text-[#9db0c4]"
            >
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
            {allItems.map((it) => {
              const active =
                pathname === it.href || (it.href !== '/admin' && pathname.startsWith(it.href));
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] font-medium transition-colors ${
                    active ? 'bg-white/10 text-white' : 'text-[#8fa1b4] hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-[var(--teal)]" />}
                  <Icon name={it.icon} className={`w-5 h-5 ${active ? 'text-[var(--teal)]' : ''}`} />
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--brick)] text-white text-[11px] font-bold grid place-items-center">
                      {it.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* User + logout */}
          <div className="px-3 py-4 border-t border-white/10">
            <div className="px-3 mb-2">
              <b className="text-[13px] block">{userName}</b>
              <small className="text-[11px] text-[#8fa1b4]">{userRole}</small>
            </div>
            <form action={signOut}>
              <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#8fa1b4] hover:bg-white/[0.06] hover:text-white transition-colors">
                <Icon name="logout" className="w-[18px] h-[18px]" />
                Đăng xuất
              </button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
