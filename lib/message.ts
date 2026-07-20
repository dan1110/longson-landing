// Sinh tin nhắn xác nhận (mục 11). Thay biến vào template lưu ở DB,
// GIỮ NGUYÊN emoji, xuống dòng, dấu ⸻.
import { dmy, dmyPad, money } from './format';
import { clampDeposit } from './booking';
import { bankInfo } from './vietqr';
import type { Booking, Customer, Home, Unit } from './database.types';

export interface MessageVars {
  // Khách & nơi ở (template mặc định mới không dùng, giữ để chủ tự thêm lại)
  ten_khach: string;
  sdt_khach: string;
  ten_home: string;
  maps_url: string;
  // Ngày & số đêm
  ngay_checkin: string;
  ngay_checkout: string;
  so_khach: string;
  so_dem: string;
  // Tiền
  gia_dem: string;
  tong_tien: string;
  ngay_coc: string;
  tien_coc: string;
  con_lai: string;
  // Chủ home
  ten_chu: string;
  sdt_chu: string;
  // Tài khoản nhận cọc (điền từ .env NEXT_PUBLIC_BANK_*)
  ten_tk: string;
  so_tk: string;
  ngan_hang: string;
}

/** Thay {bien} trong template bằng giá trị tương ứng. */
export function renderTemplate(template: string, vars: MessageVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (vars as unknown as Record<string, string>)[key];
    return v ?? `{${key}}`;
  });
}

/** Dựng tin nhắn xác nhận từ dữ liệu thô (dùng ngay trong form tạo đơn). */
export function buildConfirmMessage(input: {
  template: string;
  home: Pick<Home, 'name' | 'maps_url' | 'owner_name' | 'owner_phone'>;
  unitName: string;
  customerName: string;
  customerPhone?: string;
  checkin: string;
  checkout: string;
  guests: number;
  pricePerNight: number;
  deposit: number;
}): string {
  const { template, home } = input;
  const nights = Math.max(
    0,
    Math.round(
      (new Date(input.checkout).getTime() - new Date(input.checkin).getTime()) / 86_400_000,
    ),
  );
  const total = nights * input.pricePerNight;
  const vars: MessageVars = {
    ten_khach: input.customerName,
    sdt_khach: input.customerPhone ?? '',
    ten_home: `${home.name} · ${input.unitName}`,
    maps_url: home.maps_url ?? '',
    ngay_checkin: dmyPad(input.checkin),
    ngay_checkout: dmyPad(input.checkout),
    so_khach: String(input.guests),
    so_dem: String(nights),
    gia_dem: money(input.pricePerNight),
    tong_tien: money(total),
    ngay_coc: dmyPad(input.checkin),
    tien_coc: money(clampDeposit(input.deposit, total)),
    con_lai: money(total - clampDeposit(input.deposit, total)),
    ten_chu: home.owner_name ?? 'Ms.Tuyết',
    sdt_chu: home.owner_phone ?? '',
    ten_tk: bankInfo.nameDisplay,
    so_tk: bankInfo.account,
    ngan_hang: bankInfo.bankName,
  };
  return renderTemplate(template, vars);
}

/** Gom biến từ dữ liệu booking để đổ vào template. */
export function buildMessageVars(input: {
  booking: Booking;
  customer: Customer;
  unit: Unit;
  home: Home;
  depositAmount: number; // tiền cọc hiển thị trong tin nhắn
  depositDate?: string;
}): MessageVars {
  const { booking, customer, unit, home, depositDate } = input;
  const depositAmount = clampDeposit(input.depositAmount, Number(booking.total_amount));
  const remaining = Number(booking.total_amount) - depositAmount;
  const guests = booking.guests_adult + booking.guests_child;
  return {
    ten_khach: customer.name,
    sdt_khach: customer.phone ?? '',
    ten_home: `${home.name} · ${unit.name}`,
    maps_url: home.maps_url ?? '',
    ngay_checkin: dmyPad(booking.checkin_date),
    ngay_checkout: dmyPad(booking.checkout_date),
    so_khach: String(guests),
    so_dem: String(booking.nights),
    gia_dem: money(booking.price_per_night),
    tong_tien: money(booking.total_amount),
    ngay_coc: depositDate ? dmy(depositDate) : dmy(booking.created_at.slice(0, 10)),
    tien_coc: money(depositAmount),
    con_lai: money(remaining),
    ten_chu: home.owner_name ?? 'Ms.Tuyết',
    sdt_chu: home.owner_phone ?? '',
    ten_tk: bankInfo.nameDisplay,
    so_tk: bankInfo.account,
    ngan_hang: bankInfo.bankName,
  };
}
