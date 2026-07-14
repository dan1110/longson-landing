'use client';

// Đăng nhập email + mật khẩu — chỉ chủ & quản lý (mục 3).
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Sai email hoặc mật khẩu. Vui lòng thử lại.');
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-6 bg-[var(--paper)]">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.jpg"
            alt="Long Sơn Homestay"
            width={180}
            height={180}
            priority
            className="w-40 h-40 object-contain"
          />
        </div>

        <form onSubmit={onSubmit} className="bg-white border border-[var(--line)] rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tuyet@longson.test"
              className="w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] focus:outline-none focus:border-[var(--teal)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-1.5">
              Mật khẩu
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] focus:outline-none focus:border-[var(--teal)]"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--tape-ink)] bg-[var(--tape)] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 font-bold text-[15px] bg-[var(--teal)] text-white active:scale-[.98] disabled:opacity-60"
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--ink-3)] mt-5 leading-relaxed">
          Nhân viên sale không dùng trang này —<br />vào bằng link riêng được cấp.
        </p>
      </div>
    </main>
  );
}
