// Cài đặt (mục 15): nhập/xuất dữ liệu, tài khoản. (Quản lý link sale ở tab Sales.)
import Link from 'next/link';
import { Card, Eyebrow, PageTitle } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { signOut } from '../actions';

export default async function SettingsPage() {
  return (
    <div className="fade-in space-y-4">
      <PageTitle title="Cài đặt" sub="Nhập / xuất dữ liệu, tài khoản." />

      <Card className="lg:max-w-md">
        <Eyebrow>Dữ liệu</Eyebrow>
        <div className="mt-3 space-y-2">
          <Link
            href="/admin/import"
            className="flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm bg-white border border-[var(--line)] hover:bg-[var(--paper)] transition-colors"
          >
            <Icon name="upload" className="w-4 h-4" /> Import lịch sử từ Excel
          </Link>
          <a
            href="/api/export"
            className="flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm bg-white border border-[var(--line)] hover:bg-[var(--paper)] transition-colors"
          >
            <Icon name="download" className="w-4 h-4" /> Export báo cáo tháng này
          </a>
        </div>
        <p className="text-[11px] text-[var(--ink-3)] mt-3">
          Quản lý nhân viên sale & link riêng ở tab <b>Sales</b>.
        </p>
      </Card>

      <form action={signOut} className="lg:max-w-xs">
        <button
          type="submit"
          className="w-full rounded-xl py-3.5 font-semibold text-[15px] bg-white border border-[var(--tape-line)] text-[var(--tape-ink)] hover:bg-[#fdf3f1] transition-colors"
        >
          Đăng xuất
        </button>
      </form>
    </div>
  );
}
