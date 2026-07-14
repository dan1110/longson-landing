'use client';

// Form tạo / sửa booking (admin → confirmed). Sau khi tạo, hiện luôn tin nhắn
// xác nhận để gửi khách nhanh. Báo lỗi trùng lịch thân thiện.
import { useState } from 'react';
import type { Unit, Profile, Home, MessageTemplate, BookingFull } from '@/lib/database.types';
import {
  createBooking,
  updateBooking,
  confirmHold,
  lookupCustomerByPhone,
  type CreateBookingInput,
  type CustomerLookup,
} from '@/app/(admin)/admin/actions';
import { buildConfirmMessage } from '@/lib/message';
import { bankConfigured } from '@/lib/vietqr';
import { downloadConfirmCard } from '@/lib/confirmCard';
import { nightsBetween, money } from '@/lib/format';
import { Icon } from './Icon';
import { MoneyInput } from './MoneyInput';

const SOURCES = [
  { v: 'zalo', l: 'Zalo' },
  { v: 'facebook', l: 'Facebook' },
  { v: 'googlemaps', l: 'Google Maps' },
  { v: 'referral', l: 'Giới thiệu' },
  { v: 'ota', l: 'OTA' },
  { v: 'walk_in', l: 'Khách vãng lai' },
];

const inputCls =
  'w-full p-3 border-[1.5px] border-[var(--line)] rounded-xl text-[15px] bg-white focus:outline-none focus:border-[var(--teal)] transition-colors';
const labelCls =
  'block text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-1.5';

export function BookingForm({
  units,
  sales,
  homes,
  template,
  booking,
  initialUnitId,
  initialCheckin,
  initialCheckout,
  holdId,
  onSaved,
  onDone,
}: {
  units: (Unit & { home?: { name: string } })[];
  sales: Profile[];
  homes: Home[];
  template: MessageTemplate;
  booking?: BookingFull; // có = chế độ sửa
  initialUnitId?: string;
  initialCheckin?: string;
  initialCheckout?: string;
  holdId?: string; // có = đang chốt một "giữ chỗ" đã đặt trước
  onSaved?: () => void; // gọi khi lưu thành công (để đừng nhả giữ chỗ)
  onDone: () => void;
}) {
  const editing = !!booking;
  const firstUnit =
    units.find((u) => u.id === (booking?.unit_id ?? initialUnitId)) ?? units[0];

  const [unitId, setUnitId] = useState(firstUnit?.id ?? '');
  const [checkin, setCheckin] = useState(booking?.checkin_date ?? initialCheckin ?? '');
  const [checkout, setCheckout] = useState(booking?.checkout_date ?? initialCheckout ?? '');
  const [name, setName] = useState(booking?.customer?.name ?? '');
  const [phone, setPhone] = useState(booking?.customer?.phone ?? '');
  const [adult, setAdult] = useState(booking?.guests_adult ?? 2);
  const [child, setChild] = useState(booking?.guests_child ?? 0);
  const [source, setSource] = useState(booking?.source ?? 'zalo');
  const [saleId, setSaleId] = useState(booking?.sale_id ?? '');
  const [note, setNote] = useState(booking?.note ?? '');
  const [referrerPhone, setReferrerPhone] = useState('');
  const [price, setPrice] = useState(booking?.price_per_night ?? firstUnit?.base_price ?? 0);
  const [deposit, setDeposit] = useState(booking?.price_per_night ?? firstUnit?.base_price ?? 0);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdMsg, setCreatedMsg] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dling, setDling] = useState(false);

  async function downloadCard() {
    const u = units.find((x) => x.id === unitId);
    const home = homes.find((h) => h.id === u?.home_id) ?? homes[0];
    setDling(true);
    try {
      await downloadConfirmCard({
        code: createdCode ?? 'moi',
        customerName: name,
        homeName: home?.name ?? '',
        unitName: u?.name ?? '',
        checkin,
        checkout,
        nights,
        total,
        deposit,
        remaining: total - deposit,
      });
    } finally {
      setDling(false);
    }
  }
  const [lookup, setLookup] = useState<CustomerLookup | null>(null);
  const [looking, setLooking] = useState(false);

  async function checkPhone() {
    if (editing || phone.trim().length < 6) return;
    setLooking(true);
    const res = await lookupCustomerByPhone(phone);
    setLooking(false);
    setLookup(res);
    if (res.found && !name.trim()) setName(res.name); // điền sẵn tên khách cũ
  }

  const unit = units.find((u) => u.id === unitId);
  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0;
  const total = nights > 0 ? nights * price : 0;

  function onUnitChange(id: string) {
    setUnitId(id);
    const u = units.find((x) => x.id === id);
    if (u && !editing) {
      setPrice(u.base_price);
      setDeposit(u.base_price);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (nights <= 0) {
      setErr('Ngày trả phải sau ngày nhận.');
      return;
    }
    setLoading(true);

    if (editing) {
      const res = await updateBooking({
        id: booking!.id,
        unitId,
        checkin,
        checkout,
        guestsAdult: adult,
        guestsChild: child,
        pricePerNight: price,
        source,
        note,
        customerId: booking!.customer_id,
        customerName: name,
        customerPhone: phone,
      });
      setLoading(false);
      if (!res.ok) return setErr(res.error);
      onDone();
      return;
    }

    const input: CreateBookingInput = {
      customerName: name,
      customerPhone: phone || undefined,
      unitId,
      checkin,
      checkout,
      guestsAdult: adult,
      guestsChild: child,
      pricePerNight: price,
      source,
      saleId: saleId || undefined,
      note: note || undefined,
      referrerPhone: source === 'referral' ? referrerPhone || undefined : undefined,
    };
    const res = holdId ? await confirmHold(holdId, input) : await createBooking(input);
    setLoading(false);
    if (!res.ok) return setErr(res.error);
    onSaved?.(); // đã lưu → không nhả giữ chỗ nữa
    setCreatedCode(res.code);

    // Sinh tin nhắn ngay để gửi khách
    const home = homes.find((h) => h.id === unit?.home_id) ?? homes[0];
    const msg = buildConfirmMessage({
      template: template.body,
      home,
      unitName: unit?.name ?? '',
      customerName: name,
      checkin,
      checkout,
      guests: adult + child,
      pricePerNight: price,
      deposit,
    });
    setCreatedMsg(msg);
  }

  async function copyMsg() {
    if (!createdMsg) return;
    await navigator.clipboard.writeText(createdMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function share() {
    if (createdMsg && navigator.share) {
      try {
        await navigator.share({ text: createdMsg });
      } catch {
        /* hủy */
      }
    } else copyMsg();
  }

  // ── Màn tin nhắn sau khi tạo ─────────────────────────────────────
  if (createdMsg) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[var(--teal-d)] font-bold">
          <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-[#e0f0e5]">
            <Icon name="check" className="w-5 h-5" />
          </span>
          Đã tạo đơn! Gửi tin nhắn cho khách:
        </div>
        <pre className="whitespace-pre-wrap text-[12px] leading-relaxed bg-white border border-[var(--line)] rounded-xl p-3 font-sans max-h-64 overflow-y-auto">
          {createdMsg}
        </pre>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copyMsg}
            className="rounded-xl py-3 text-sm font-bold bg-[var(--teal)] text-white active:scale-[.98] flex items-center justify-center gap-2 hover:bg-[var(--teal-d)] transition-colors"
          >
            <Icon name={copied ? 'check' : 'copy'} className="w-4 h-4" />
            {copied ? 'Đã copy' : 'Copy tin nhắn'}
          </button>
          <button
            onClick={share}
            className="rounded-xl py-3 text-sm font-bold bg-white border-[1.5px] border-[var(--line)] active:scale-[.98] flex items-center justify-center gap-2 hover:bg-[var(--paper)] transition-colors"
          >
            <Icon name="share" className="w-4 h-4" /> Chia sẻ
          </button>
        </div>
        {bankConfigured && deposit > 0 && (
          <div className="bg-white border border-[var(--line)] rounded-xl p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr?amount=${deposit}&code=${encodeURIComponent(createdCode ?? 'moi')}`} alt="QR cọc" className="w-36 mx-auto rounded-lg" width={144} height={180} />
            <div className="mono text-[13px] font-bold mt-1">Cọc {money(deposit)} ₫</div>
            <button
              onClick={downloadCard}
              disabled={dling}
              className="mt-2 w-full rounded-xl py-3 text-sm font-bold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Icon name="download" className="w-4 h-4" />
              {dling ? 'Đang tạo ảnh…' : 'Tải ảnh xác nhận (kèm QR)'}
            </button>
          </div>
        )}
        <button
          onClick={onDone}
          className="w-full rounded-xl py-3 font-semibold text-[15px] bg-[var(--ink)] text-white active:scale-[.98]"
        >
          Xong
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Bước 1: nhập SĐT trước để biết khách cũ hay mới */}
      <div>
        <label className={labelCls}>SĐT / Zalo {!editing && <span className="text-[var(--teal)] normal-case">— nhập trước để kiểm tra khách</span>}</label>
        <input
          className={inputCls}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setLookup(null);
          }}
          onBlur={checkPhone}
          inputMode="tel"
          placeholder="09xx xxx xxx"
        />
        {!editing && looking && (
          <p className="text-[12px] text-[var(--ink-3)] mt-1.5">Đang kiểm tra…</p>
        )}
        {!editing && lookup?.found && (
          <div className="mt-1.5 flex items-start gap-2 bg-[#e6f4ec] border border-[var(--free-line)] rounded-lg px-3 py-2 text-[12.5px]">
            <Icon name="check" className="w-4 h-4 text-[var(--teal-d)] mt-0.5 flex-none" />
            <div className="text-[var(--teal-d)] font-semibold">
              Khách quen: {lookup.name}
              <div className="font-normal text-[11.5px]">
                Đã ở {lookup.timesStayed} lần{lookup.referrerName ? ` · do ${lookup.referrerName} giới thiệu` : ''}. Đã điền sẵn tên.
              </div>
            </div>
          </div>
        )}
        {!editing && lookup && !lookup.found && phone.trim().length >= 6 && (
          <div className="mt-1.5 flex items-center gap-2 bg-[#fbeed6] border border-[var(--pend-line)] rounded-lg px-3 py-2 text-[12.5px] text-[var(--pend-ink)] font-semibold">
            <Icon name="users" className="w-4 h-4 flex-none" /> Khách mới — nhập tên bên dưới.
          </div>
        )}
      </div>

      {/* Bước 2: tên khách (tự điền nếu là khách quen) */}
      <div>
        <label className={labelCls}>Tên khách</label>
        <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Anh Dũng" />
      </div>
      <div>
        <label className={labelCls}>Đơn vị</label>
        <select className={inputCls} value={unitId} onChange={(e) => onUnitChange(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.home?.name} · {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Nhận phòng</label>
          <input type="date" className={inputCls} required value={checkin} onChange={(e) => setCheckin(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Trả phòng</label>
          <input type="date" className={inputCls} required value={checkout} onChange={(e) => setCheckout(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Người lớn</label>
          <input type="number" min={1} className={inputCls} value={adult} onChange={(e) => setAdult(+e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Trẻ em</label>
          <input type="number" min={0} className={inputCls} value={child} onChange={(e) => setChild(+e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Giá/đêm</label>
        <MoneyInput value={price} onChange={setPrice} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Nguồn</label>
          <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s.v} value={s.v}>{s.l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Sale phụ trách</label>
          <select className={inputCls} value={saleId} onChange={(e) => setSaleId(e.target.value)}>
            <option value="">— Không —</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {source === 'referral' && !editing && (
        <div>
          <label className={labelCls}>SĐT người giới thiệu (khách cũ)</label>
          <input className={inputCls} value={referrerPhone} onChange={(e) => setReferrerPhone(e.target.value)} inputMode="tel" placeholder="Để theo dõi ai giới thiệu khách" />
        </div>
      )}

      {!editing && (
        <div>
          <label className={labelCls}>Tiền cọc (cho tin nhắn)</label>
          <MoneyInput value={deposit} onChange={setDeposit} className={inputCls} />
        </div>
      )}

      <div>
        <label className={labelCls}>Ghi chú</label>
        <textarea className={`${inputCls} min-h-[64px]`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: khách quen, xin nhận sớm, dị ứng…" />
      </div>

      {nights > 0 && (
        <div className="bg-[#e6f4ec] border border-[var(--free-line)] rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--teal-d)] flex justify-between">
          <span>{nights} đêm × {money(price)}</span>
          <span className="mono">{money(total)} ₫</span>
        </div>
      )}

      {err && <p className="text-[12px] text-[var(--tape-ink)] bg-[var(--tape)] rounded-lg px-3 py-2">{err}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-3.5 font-bold text-[15px] bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors disabled:opacity-60"
      >
        {loading ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo đơn & soạn tin nhắn'}
      </button>
    </form>
  );
}
