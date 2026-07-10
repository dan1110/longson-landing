// Nghiệp vụ tính tiền booking (mục 5, 14). Mọi con số suy ra từ transactions.
import type { Booking, Transaction, BookingStatus } from './database.types';

/** Trạng thái được tính doanh thu/hoa hồng (từ CONFIRMED trở lên) (mục 7). */
export const REVENUE_STATUSES: BookingStatus[] = [
  'confirmed',
  'staying',
  'completed',
];

/** Trạng thái còn khóa ngày (mọi thứ trừ rejected/cancelled) (mục 6). */
export const ACTIVE_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'staying',
  'completed',
];

export function isRevenue(status: BookingStatus): boolean {
  return REVENUE_STATUSES.includes(status);
}

/** Đã thu = tổng income của booking. */
export function paid(txns: Transaction[] | undefined): number {
  if (!txns) return 0;
  return txns
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
}

/** Còn lại = tổng tiền − đã thu. */
export function remaining(booking: Booking, txns: Transaction[] | undefined): number {
  return Number(booking.total_amount) - paid(txns);
}

/** Nhãn tiếng Việt cho trạng thái. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Chờ duyệt',
  confirmed: 'Đã duyệt',
  staying: 'Đang ở',
  completed: 'Đã trả phòng',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

/** Nhãn nguồn khách. */
export const SOURCE_LABEL: Record<string, string> = {
  zalo: 'Zalo',
  facebook: 'Facebook',
  ota: 'OTA',
  referral: 'Giới thiệu',
  walk_in: 'Khách vãng lai',
};

/** Nhãn danh mục thu/chi. */
export const CATEGORY_LABEL: Record<string, string> = {
  deposit: 'Tiền cọc',
  balance: 'Tiền còn lại',
  electricity: 'Tiền điện',
  water: 'Tiền nước',
  cleaning: 'Dọn dẹp',
  commission: 'Hoa hồng sale',
  supplies: 'Vật tư',
  maintenance: 'Sửa chữa',
  other: 'Khác',
};
