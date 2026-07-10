// Shell trang Admin — RESPONSIVE:
//  • Desktop (≥lg): sidebar trái cố định + nội dung rộng nhiều cột.
//  • Mobile/tablet (<lg): top bar có nút ☰ → drawer trượt ra (hamburger menu).
import { redirect } from 'next/navigation';
import { type NavItem } from '@/components/BottomNav';
import { Sidebar } from '@/components/Sidebar';
import { MobileMenu } from '@/components/MobileMenu';
import { LiveStamp } from '@/components/LiveStamp';
import { RealtimeRefresher } from '@/components/RealtimeRefresher';
import { getMyProfile } from '@/lib/queries';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Chủ homestay',
  manager: 'Quản lý',
  sale: 'Sale',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getMyProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'sale') redirect('/login');

  const roleLabel = ROLE_LABEL[profile.role];

  const nav: NavItem[] = [
    { href: '/admin', label: 'Tổng quan', icon: 'overview' },
    { href: '/admin/calendar', label: 'Lịch', icon: 'calendar' },
    { href: '/admin/customers', label: 'Khách', icon: 'users' },
    { href: '/admin/finance', label: 'Thu chi', icon: 'wallet' },
    { href: '/admin/sales', label: 'Sales', icon: 'commission' },
  ];

  return (
    <div className="min-h-screen bg-[var(--paper)] lg:flex">
      {/* Sidebar — chỉ desktop */}
      <Sidebar items={nav} userName={profile.name} userRole={roleLabel} />

      {/* Cột nội dung */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Hamburger + top bar — chỉ mobile/tablet */}
        <MobileMenu items={nav} userName={profile.name} userRole={roleLabel} />

        {/* Header desktop (ẩn ở mobile) */}
        <header className="hidden lg:flex items-center justify-between px-8 h-16 border-b border-[var(--line)] bg-white/60 backdrop-blur sticky top-0 z-10">
          <div className="text-[var(--ink-3)] text-sm">Bảng điều hành</div>
          <LiveStamp />
        </header>

        <main className="flex-1 w-full mx-auto max-w-6xl p-3.5 pb-8 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>

      <RealtimeRefresher />
    </div>
  );
}
