// Các mảnh UI dùng lại — phong cách "data-dense dashboard": shadow tinh tế,
// bo góc mềm, hover mượt.
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const CARD =
  'bg-white border border-[var(--line)] rounded-2xl shadow-[0_1px_2px_rgba(16,32,46,0.04),0_1px_3px_rgba(16,32,46,0.03)]';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${CARD} p-4 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--ink-3)]">
      {children}
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-1">
      <h1 className="text-[19px] lg:text-[22px] font-extrabold tracking-[-0.02em] text-[var(--ink)]">
        {title}
      </h1>
      {sub && <p className="text-[12.5px] text-[var(--ink-3)] leading-relaxed mt-0.5">{sub}</p>}
    </div>
  );
}

type KpiTone = 'default' | 'warn' | 'hero' | 'good';

export function Kpi({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  icon?: IconName;
}) {
  const tones: Record<KpiTone, string> = {
    default: `${CARD}`,
    warn: `${CARD}`,
    good: `${CARD}`,
    hero: 'bg-[var(--ink)] text-white border-transparent rounded-2xl shadow-[0_4px_16px_rgba(16,32,46,0.18)]',
  };
  const chip: Record<KpiTone, string> = {
    default: 'bg-[var(--teal)]/10 text-[var(--teal)]',
    good: 'bg-[#e6f4ec] text-[var(--teal-d)]',
    warn: 'bg-[#fbeee0] text-[#b4741b]',
    hero: 'bg-white/15 text-white',
  };
  const labelColor = tone === 'hero' ? 'text-white/70' : 'text-[var(--ink-3)]';
  const subColor = tone === 'hero' ? 'text-white/60' : 'text-[var(--ink-3)]';
  return (
    <div className={`${tones[tone]} p-4`}>
      <div className="flex items-center justify-between">
        <div className={`text-[11.5px] font-semibold ${labelColor}`}>{label}</div>
        {icon && (
          <span className={`grid place-items-center w-7 h-7 rounded-lg ${chip[tone]}`}>
            <Icon name={icon} className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className="mono text-[22px] lg:text-[24px] font-bold mt-1.5 leading-none tracking-tight">
        {value}
      </div>
      {sub && <div className={`text-[11px] mt-1.5 ${subColor}`}>{sub}</div>}
    </div>
  );
}

type PillTone = 'pend' | 'owe' | 'ok' | 'lock';
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const map: Record<PillTone, string> = {
    pend: 'bg-[#fbeed6] text-[var(--pend-ink)]',
    owe: 'bg-[#fbe0dc] text-[var(--tape-ink)]',
    ok: 'bg-[#e0f0e5] text-[var(--teal-d)]',
    lock: 'bg-[var(--lock)] text-[var(--lock-ink)]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="text-center py-14 text-[var(--ink-3)] text-sm leading-relaxed">
      <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[var(--paper)] text-[var(--ink-3)] mb-3">
        <Icon name={icon} className="w-7 h-7" />
      </span>
      <div>{children}</div>
    </div>
  );
}
