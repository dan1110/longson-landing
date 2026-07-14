'use client';

// Landing CHUNG: xem lịch trống + SALE TỰ TẠO ĐƠN (không cần chốt, tự thêm tên).
// Không cần đăng nhập / secret key — dùng anon RPC an toàn (SECURITY DEFINER).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { MonthCalendar } from '@/components/MonthCalendar';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { MoneyInput } from '@/components/MoneyInput';
import { toast } from '@/components/Toast';
import { buildConfirmMessage } from '@/lib/message';
import { bankConfigured } from '@/lib/vietqr';
import { downloadConfirmCard } from '@/lib/confirmCard';
import { money, toISODate, nightsBetween, dm } from '@/lib/format';
import type { BookingFull, Unit } from '@/lib/database.types';

interface PubUnit { id: string; home_name: string; name: string; base_price: number; sort_order: number }
interface PubBusy { unit_id: string; checkin_date: string; checkout_date: string; status: string }
interface PubSale { id: string; name: string }

const inputCls =
  'w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] bg-white focus:outline-none focus:border-[var(--teal)]';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-1.5';

export default function AvailabilityPage() {
  const [units, setUnits] = useState<PubUnit[]>([]);
  const [busy, setBusy] = useState<PubBusy[]>([]);
  const [sales, setSales] = useState<PubSale[]>([]);
  const [template, setTemplate] = useState('');
  const [stamp, setStamp] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [u, a, s, t] = await Promise.all([
      supabase.rpc('public_units'),
      supabase.rpc('public_availability'),
      supabase.rpc('public_sales'),
      supabase.rpc('public_template'),
    ]);
    if (u.data) setUnits(u.data as PubUnit[]);
    if (a.data) setBusy(a.data as PubBusy[]);
    if (s.data) setSales(s.data as PubSale[]);
    if (t.data) setTemplate(t.data as string);
    const d = new Date();
    setStamp(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 180_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // ── Tạo đơn (hold-on-tap) ────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [seed, setSeed] = useState<{ unitId: string; checkin: string; checkout: string } | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  async function onCreateRange(unitId: string, checkin: string, checkout: string) {
    if (!unitId) {
      toast.info('Hãy chọn 1 phòng cụ thể (ở ô "Tất cả phòng" phía trên) rồi mới đặt nhé.');
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc('public_create_hold', {
      p_unit: unitId,
      p_checkin: checkin,
      p_checkout: checkout,
    });
    if (error) {
      toast.error(error.message.includes('TRUNG_LICH') ? 'Ngày này vừa có người đặt. Chọn ngày khác nhé.' : 'Có lỗi, thử lại.');
      return;
    }
    setHoldId(data as string);
    setSeed({ unitId, checkin, checkout });
    setSavedOk(false);
    setFormOpen(true);
    load();
  }

  function closeForm() {
    setFormOpen(false);
    if (holdId && !savedOk) {
      createClient().rpc('public_release_hold', { p_hold: holdId }).then(() => load());
    }
    setHoldId(null);
    setSeed(null);
  }

  // ── Shape cho MonthCalendar ──────────────────────────────────────
  const calUnits = useMemo(
    () => units.map((u) => ({ id: u.id, name: u.name, home: { name: u.home_name }, parent_unit_id: null, capacity: 0, base_price: u.base_price, sort_order: u.sort_order, home_id: '' })) as unknown as (Unit & { home?: { name: string } })[],
    [units],
  );
  const calBookings = useMemo(
    () => busy.map((b, i) => ({ id: `${b.unit_id}-${b.checkin_date}-${i}`, unit_id: b.unit_id, checkin_date: b.checkin_date, checkout_date: b.checkout_date, status: b.status })) as unknown as BookingFull[],
    [busy],
  );

  const today = toISODate(new Date());
  const busyTodayUnits = new Set(busy.filter((b) => b.checkin_date <= today && b.checkout_date > today).map((b) => b.unit_id));
  const freeToday = units.filter((u) => !busyTodayUnits.has(u.id)).length;
  const now = new Date();
  const seedUnit = seed ? units.find((u) => u.id === seed.unitId) : undefined;

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-[860px] px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white grid place-items-center overflow-hidden flex-none">
            <Image src="/logo-icon.png" alt="Long Sơn" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <div className="leading-tight">
            <b className="text-[16px] font-bold block">Long Sơn Homestay</b>
            <small className="text-[11.5px] text-[#8fa1b4]">Lịch phòng · sale đặt trực tiếp</small>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-4 py-4 space-y-3">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">Phòng còn trống</h1>
            <p className="text-[12.5px] text-[var(--ink-3)]">
              Hôm nay còn <b className="text-[var(--teal-d)]">{freeToday}/{units.length}</b> phòng · chọn phòng rồi chạm ngày để đặt.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2fa36b]" /> {stamp}
              </span>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-white border border-[var(--line)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--paper)] transition-colors disabled:opacity-60"
              >
                <Icon name="clock" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>
            <span className="text-[10.5px] text-[var(--ink-3)] text-right">
              Nhấn <b>Làm mới</b> để xem lịch mới nhất · tự cập nhật mỗi 3 phút
            </span>
          </div>
        </div>

        <div className="flex gap-3 text-[10px] text-[var(--ink-3)] flex-wrap">
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[var(--free)] border border-[var(--free-line)]" />Trống</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[var(--lock)] border border-[var(--lock-line)]" />Đã đặt</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[var(--pend)] border border-[var(--pend-line)]" />Đang có khách đặt</span>
        </div>

        {units.length > 0 && (
          <MonthCalendar
            units={calUnits}
            bookings={calBookings}
            initialYear={now.getFullYear()}
            initialMonth0={now.getMonth()}
            hideNames
            onCreateRange={onCreateRange}
          />
        )}
      </main>

      <Sheet open={formOpen} onClose={closeForm} title="Đặt phòng cho khách">
        {seed && seedUnit && (
          <BookingForm
            holdId={holdId!}
            unit={seedUnit}
            checkin={seed.checkin}
            checkout={seed.checkout}
            sales={sales}
            template={template}
            onSaved={() => { setSavedOk(true); load(); }}
            onClose={closeForm}
          />
        )}
      </Sheet>
    </div>
  );
}

// ── Form đặt phòng cho sale (public) ───────────────────────────────
function BookingForm({
  holdId,
  unit,
  checkin,
  checkout,
  sales,
  template,
  onSaved,
  onClose,
}: {
  holdId: string;
  unit: PubUnit;
  checkin: string;
  checkout: string;
  sales: PubSale[];
  template: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guests, setGuests] = useState(2);
  const [price, setPrice] = useState(unit.base_price);
  const [deposit, setDeposit] = useState(unit.base_price);
  const [source, setSource] = useState('zalo');
  const [saleName, setSaleName] = useState('');
  const [newSale, setNewSale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [dling, setDling] = useState(false);

  const nights = nightsBetween(checkin, checkout);

  async function downloadCard() {
    setDling(true);
    try {
      await downloadConfirmCard({
        code,
        customerName: name,
        homeName: unit.home_name,
        unitName: unit.name,
        checkin,
        checkout,
        nights,
        total: nights * price,
        deposit,
        remaining: nights * price - deposit,
      });
    } finally {
      setDling(false);
    }
  }

  const message = buildConfirmMessage({
    template,
    home: { name: unit.home_name, maps_url: '', owner_name: '', owner_phone: '' },
    unitName: unit.name,
    customerName: name,
    checkin,
    checkout,
    guests,
    pricePerNight: price,
    deposit,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) return setErr('Nhập tên khách.');
    if (!saleName.trim()) return setErr('Chọn hoặc nhập tên bạn (sale).');
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('public_confirm_booking', {
      p_hold: holdId,
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_guests: guests,
      p_price: price,
      p_sale_name: saleName.trim(),
      p_source: source,
    });
    setSaving(false);
    if (error) return setErr('Có lỗi khi đặt, thử lại.');
    setCode((data as string) ?? '');
    onSaved();
    setDone(true);
  }

  async function copyMsg() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ text: message }); } catch { /* hủy */ }
    } else copyMsg();
  }

  if (done) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[var(--teal-d)] font-bold">
          <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-[#e0f0e5]">
            <Icon name="check" className="w-5 h-5" />
          </span>
          Đã đặt cho {name}! Gửi khách:
        </div>

        {/* Tin nhắn xác nhận */}
        <pre className="whitespace-pre-wrap text-[12px] leading-relaxed bg-white border border-[var(--line)] rounded-xl p-3 font-sans max-h-56 overflow-y-auto">{message}</pre>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyMsg} className="rounded-xl py-3 text-sm font-bold bg-[var(--teal)] text-white active:scale-[.98] flex items-center justify-center gap-2 hover:bg-[var(--teal-d)] transition-colors">
            <Icon name={copied ? 'check' : 'copy'} className="w-4 h-4" /> {copied ? 'Đã copy' : 'Copy tin nhắn'}
          </button>
          <button onClick={share} className="rounded-xl py-3 text-sm font-bold bg-white border-[1.5px] border-[var(--line)] active:scale-[.98] flex items-center justify-center gap-2 hover:bg-[var(--paper)] transition-colors">
            <Icon name="share" className="w-4 h-4" /> Chia sẻ
          </button>
        </div>

        {/* Ảnh xác nhận đầy đủ (thông tin + QR cọc) để lưu gửi khách */}
        {bankConfigured && deposit > 0 && code && (
          <div className="bg-white border border-[var(--line)] rounded-xl p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr?amount=${deposit}&code=${encodeURIComponent(code)}`} alt="QR cọc" className="w-40 mx-auto rounded-lg" width={160} height={200} />
            <div className="mono text-[13px] font-bold mt-1">Cọc {money(deposit)} ₫</div>
            <button
              onClick={downloadCard}
              disabled={dling}
              className="mt-2 w-full rounded-xl py-3 text-sm font-bold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Icon name="download" className="w-4 h-4" />
              {dling ? 'Đang tạo ảnh…' : 'Tải ảnh xác nhận (kèm QR)'}
            </button>
            <p className="text-[10.5px] text-[var(--ink-3)] mt-1.5">Ảnh gồm đầy đủ thông tin đặt phòng + QR cọc để gửi khách.</p>
          </div>
        )}

        <button onClick={onClose} className="w-full rounded-xl py-3 font-semibold text-[15px] bg-[var(--ink)] text-white active:scale-[.98]">
          Xong
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-[#e6f4ec] border border-[var(--free-line)] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--teal-d)]">
        {unit.home_name} · {unit.name}
        <div className="text-[12px] font-normal mt-0.5">
          Nhận <b>{dm(checkin)}</b> → Trả <b>{dm(checkout)}</b> · {nights} đêm
        </div>
      </div>
      <div>
        <label className={labelCls}>Tên khách</label>
        <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Anh Dũng" />
      </div>
      <div>
        <label className={labelCls}>SĐT / Zalo khách</label>
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="09xx xxx xxx" />
      </div>
      <div>
        <label className={labelCls}>Số khách</label>
        <input type="number" min={1} className={inputCls} value={guests} onChange={(e) => setGuests(+e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Giá/đêm</label>
          <MoneyInput value={price} onChange={setPrice} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tiền cọc</label>
          <MoneyInput value={deposit} onChange={setDeposit} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Bạn là sale nào?</label>
        {!newSale ? (
          <select
            className={inputCls}
            value={saleName}
            onChange={(e) => {
              if (e.target.value === '__new__') { setNewSale(true); setSaleName(''); }
              else setSaleName(e.target.value);
            }}
          >
            <option value="">— Chọn tên —</option>
            {sales.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            <option value="__new__">＋ Thêm tên mới…</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input className={inputCls} value={saleName} onChange={(e) => setSaleName(e.target.value)} placeholder="Nhập tên bạn" autoFocus />
            <button type="button" onClick={() => { setNewSale(false); setSaleName(''); }} className="px-3 rounded-xl border border-[var(--line)] text-[12px] text-[var(--ink-3)]">Hủy</button>
          </div>
        )}
      </div>
      <div>
        <label className={labelCls}>Nguồn khách</label>
        <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="zalo">Zalo</option>
          <option value="facebook">Facebook</option>
          <option value="googlemaps">Google Maps</option>
          <option value="referral">Giới thiệu</option>
          <option value="ota">OTA</option>
          <option value="walk_in">Khách vãng lai</option>
        </select>
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl px-3 py-2.5 text-[13px] font-semibold flex justify-between">
        <span>{nights} đêm × {money(price)}</span>
        <span className="mono">{money(nights * price)} ₫</span>
      </div>

      {err && <p className="text-[12px] text-[var(--tape-ink)] bg-[var(--tape)] rounded-lg px-3 py-2">{err}</p>}

      <button type="submit" disabled={saving} className="w-full rounded-xl py-3.5 font-bold text-[15px] bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors disabled:opacity-60">
        {saving ? 'Đang đặt…' : 'Đặt phòng'}
      </button>
    </form>
  );
}
