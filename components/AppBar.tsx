'use client';

// Thanh trên cùng: logo, tên/vai trò, chỉ báo "Trực tiếp" realtime (mục 16).
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export function AppBar({
  name,
  role,
  live = true,
  settingsHref,
}: {
  name: string;
  role: string;
  live?: boolean;
  settingsHref?: string;
}) {
  const [stamp, setStamp] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setStamp(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="bg-[var(--ink)] text-white px-4 pt-3 pb-3 flex-none">
      <div className="flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-lg bg-white grid place-items-center flex-none overflow-hidden">
          <Image src="/logo-icon.png" alt="Long Sơn" width={30} height={30} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 leading-tight">
          <b className="text-sm font-bold block">{name}</b>
          <small className="text-[10.5px] text-[#8fa1b4]">{role}</small>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-[#9db0c4]">
            <span
              className={`rt-dot w-1.5 h-1.5 rounded-full ${live ? 'bg-[#48c78e]' : 'bg-[#5a6b7e]'}`}
            />
            <span className="mono">{stamp}</span>
          </div>
          {settingsHref && (
            <Link
              href={settingsHref}
              className="text-[#9db0c4] hover:text-white transition-colors"
              aria-label="Cài đặt"
            >
              <Icon name="settings" className="w-[18px] h-[18px]" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
