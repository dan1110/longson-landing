'use client';

// Chỉ báo "Trực tiếp · hh:mm" cho header desktop (mục 16).
import { useEffect, useState } from 'react';

export function LiveStamp() {
  const [stamp, setStamp] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setStamp(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-[var(--ink-3)]">
      <span className="rt-dot w-1.5 h-1.5 rounded-full bg-[#2fa36b]" />
      Trực tiếp · <span className="mono">{stamp}</span>
    </div>
  );
}
