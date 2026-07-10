// Định dạng tiền & ngày kiểu Việt Nam (mục 2).

/** 2000000 → "2.000.000" (không kèm chữ). */
export function money(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  return v.toLocaleString('vi-VN');
}

/** 2000000 → "2.000.000 ₫" */
export function vnd(n: number | null | undefined): string {
  return `${money(n)} ₫`;
}

/** 2500000 → "2,5 triệu" — dùng cho thẻ KPI cho gọn. */
export function moneyShort(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  if (Math.abs(v) >= 1_000_000) {
    const t = v / 1_000_000;
    return `${t.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
  }
  if (Math.abs(v) >= 1_000) {
    return `${Math.round(v / 1000).toLocaleString('vi-VN')}k`;
  }
  return money(v);
}

/** '2026-07-16' → "16/7/2026" */
export function dmy(d: string | Date): string {
  const dt = typeof d === 'string' ? parseDate(d) : d;
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}

/** '2026-07-04' → "04/07/2026" (có số 0, dùng cho tin nhắn xác nhận). */
export function dmyPad(d: string | Date): string {
  const dt = typeof d === 'string' ? parseDate(d) : d;
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = String(dt.getMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${dt.getFullYear()}`;
}

/** '2026-07-16' → "16/7" */
export function dm(d: string | Date): string {
  const dt = typeof d === 'string' ? parseDate(d) : d;
  return `${dt.getDate()}/${dt.getMonth() + 1}`;
}

/** Parse 'YYYY-MM-DD' thành Date local (tránh lệch múi giờ của new Date). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD' (local, không dùng toISOString để khỏi lệch ngày). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Số đêm giữa 2 ngày (ngày trả không tính là 1 đêm). */
export function nightsBetween(checkin: string, checkout: string): number {
  const a = parseDate(checkin).getTime();
  const b = parseDate(checkout).getTime();
  return Math.round((b - a) / 86_400_000);
}
