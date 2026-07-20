// Kiểu dữ liệu tối giản khớp schema (mục 5).
// Khi chạy được Supabase local, tạo lại chính xác bằng:
//   npm run db:types   (supabase gen types typescript --local)

export type UserRole = 'owner' | 'manager' | 'sale';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'staying'
  | 'completed'
  | 'rejected'
  | 'cancelled';
export type TxnType = 'income' | 'expense';

export interface Home {
  id: string;
  name: string;
  address: string | null;
  maps_url: string | null;
  owner_name: string | null;
  owner_phone: string | null;
}

export interface Unit {
  id: string;
  home_id: string;
  name: string;
  parent_unit_id: string | null;
  capacity: number;
  base_price: number;
  sort_order: number;
}

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  role: UserRole;
  commission_rate: number;
  sale_token: string | null;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  zalo: string | null;
  note: string | null;
  referred_by: string | null; // khách này do khách nào giới thiệu
  created_at: string;
}

export interface Booking {
  id: string;
  code: string | null;
  unit_id: string;
  customer_id: string;
  checkin_date: string; // 'YYYY-MM-DD'
  checkout_date: string;
  guests_adult: number;
  guests_child: number;
  price_per_night: number;
  nights: number; // generated
  total_amount: number; // generated
  /** Cọc THỎA THUẬN báo khách (QR/tin nhắn). null = suy ra từ transactions. */
  deposit_amount: number | null;
  status: BookingStatus;
  source: string | null;
  sale_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  hold_expires_at: string | null;
}

export interface Transaction {
  id: string;
  booking_id: string | null;
  type: TxnType;
  amount: number;
  method: string | null;
  category: string | null;
  paid_at: string;
  receipt_url: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  updated_at: string;
}

// Join tiện dùng ở UI
export interface BookingFull extends Booking {
  unit?: Unit;
  customer?: Customer;
  sale?: Pick<Profile, 'id' | 'name' | 'commission_rate'>;
  transactions?: Transaction[];
}
