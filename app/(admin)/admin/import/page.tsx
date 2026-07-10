'use client';

// Màn Import Excel (mục 15): tải file → ánh xạ cột → xem trước → nhập.
// Truy cập trực tiếp /admin/import (không nằm trong bottom nav).
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { importBookings, type ImportRow, type ImportResult } from './import-action';

// Các trường đích cần map. Người dùng chọn cột Excel tương ứng.
const FIELDS: { key: keyof ImportRow; label: string; required?: boolean }[] = [
  { key: 'customerName', label: 'Tên khách', required: true },
  { key: 'customerPhone', label: 'SĐT' },
  { key: 'homeName', label: 'Tên home' },
  { key: 'unitName', label: 'Đơn vị / phòng', required: true },
  { key: 'checkin', label: 'Ngày nhận (YYYY-MM-DD)', required: true },
  { key: 'checkout', label: 'Ngày trả (YYYY-MM-DD)', required: true },
  { key: 'guests', label: 'Số khách' },
  { key: 'pricePerNight', label: 'Giá/đêm' },
  { key: 'deposit', label: 'Tiền cọc' },
  { key: 'saleName', label: 'Sale' },
  { key: 'source', label: 'Nguồn' },
];

const inputCls =
  'w-full p-2.5 border-[1.5px] border-[var(--line)] rounded-lg text-[14px] bg-white focus:outline-none focus:border-[var(--teal)]';

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, any>[]>([]);
  const [map, setMap] = useState<Partial<Record<keyof ImportRow, string>>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      setRaw(json);
      setHeaders(json.length ? Object.keys(json[0]) : []);
      setResult(null);
      // Đoán map theo tên cột gần đúng
      const guess: Partial<Record<keyof ImportRow, string>> = {};
      const cols = json.length ? Object.keys(json[0]) : [];
      const findCol = (kw: string[]) =>
        cols.find((c) => kw.some((k) => c.toLowerCase().includes(k)));
      guess.customerName = findCol(['khách', 'ten', 'name', 'tên']);
      guess.customerPhone = findCol(['sđt', 'phone', 'điện thoại', 'zalo']);
      guess.unitName = findCol(['phòng', 'căn', 'unit', 'home', 'đơn vị']);
      guess.checkin = findCol(['nhận', 'checkin', 'check in', 'đến']);
      guess.checkout = findCol(['trả', 'checkout', 'check out', 'đi']);
      guess.guests = findCol(['khách', 'guest', 'số người']);
      guess.pricePerNight = findCol(['giá', 'price']);
      guess.deposit = findCol(['cọc', 'deposit']);
      guess.saleName = findCol(['sale', 'nhân viên']);
      setMap(guess);
    };
    reader.readAsArrayBuffer(file);
  }

  function toRows(): ImportRow[] {
    const norm = (v: any): string => {
      if (v instanceof Date) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(v ?? '').trim();
    };
    return raw.map((r) => ({
      customerName: map.customerName ? norm(r[map.customerName]) : undefined,
      customerPhone: map.customerPhone ? norm(r[map.customerPhone]) : undefined,
      homeName: map.homeName ? norm(r[map.homeName]) : undefined,
      unitName: map.unitName ? norm(r[map.unitName]) : undefined,
      checkin: map.checkin ? norm(r[map.checkin]) : undefined,
      checkout: map.checkout ? norm(r[map.checkout]) : undefined,
      guests: map.guests ? Number(r[map.guests]) || undefined : undefined,
      pricePerNight: map.pricePerNight ? Number(String(r[map.pricePerNight]).replace(/\D/g, '')) || undefined : undefined,
      deposit: map.deposit ? Number(String(r[map.deposit]).replace(/\D/g, '')) || undefined : undefined,
      saleName: map.saleName ? norm(r[map.saleName]) : undefined,
      source: map.source ? norm(r[map.source]) : undefined,
    }));
  }

  async function doImport() {
    setBusy(true);
    const res = await importBookings(toRows());
    setResult(res);
    setBusy(false);
  }

  return (
    <div className="fade-in space-y-4">
      <div>
        <h1 className="text-lg font-extrabold">Import Excel</h1>
        <p className="text-xs text-[var(--ink-3)] mt-1 leading-relaxed">
          Tải file lịch sử hiện tại → khớp cột → nhập. Dòng lỗi sẽ bị bỏ qua và liệt kê lại.
        </p>
      </div>

      <input type="file" accept=".xlsx,.xls" onChange={onFile} className="text-sm" />

      {headers.length > 0 && (
        <>
          <div className="bg-white border border-[var(--line)] rounded-xl p-3 space-y-2.5">
            <div className="text-[11px] font-bold uppercase text-[var(--ink-3)]">Khớp cột ({raw.length} dòng)</div>
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <label className="text-[13px] w-32 flex-none">
                  {f.label} {f.required && <span className="text-[var(--brick)]">*</span>}
                </label>
                <select
                  className={inputCls}
                  value={map[f.key] ?? ''}
                  onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                >
                  <option value="">— Bỏ qua —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={doImport}
            disabled={busy}
            className="w-full rounded-xl py-3.5 font-bold text-[15px] bg-[var(--teal)] text-white active:scale-[.98] disabled:opacity-60"
          >
            {busy ? 'Đang nhập…' : `Nhập ${raw.length} dòng`}
          </button>
        </>
      )}

      {result && (
        <div className="bg-white border border-[var(--line)] rounded-xl p-3">
          <p className="font-bold text-[var(--teal-d)]">✓ Đã nhập {result.imported} đơn.</p>
          {result.skipped.length > 0 && (
            <div className="mt-2">
              <p className="text-[13px] font-bold text-[var(--tape-ink)]">
                {result.skipped.length} dòng bị bỏ qua:
              </p>
              <ul className="text-[11px] text-[var(--ink-3)] mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {result.skipped.map((s, i) => (
                  <li key={i}>Dòng {s.row}: {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
