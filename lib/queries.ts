// Truy vấn dùng chung phía server cho trang admin.
import { createClient } from '@/lib/supabase/server';
import type {
  Booking,
  BookingFull,
  Customer,
  Home,
  Profile,
  Transaction,
  Unit,
} from '@/lib/database.types';

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data as Profile | null;
}

export async function getUnits(): Promise<(Unit & { home: Home })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('units')
    .select('*, home:homes(*)')
    .order('sort_order');
  return (data ?? []) as (Unit & { home: Home })[];
}

export async function getHomes(): Promise<Home[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('homes').select('*').order('name');
  return (data ?? []) as Home[];
}

export async function getCustomers(): Promise<Customer[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('customers').select('*');
  return (data ?? []) as Customer[];
}

export async function getSales(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'sale')
    .order('name');
  return (data ?? []) as Profile[];
}

/** Booking kèm unit, khách, sale, giao dịch — cho lịch & danh sách. */
export async function getBookings(range?: {
  from: string;
  to: string;
}): Promise<BookingFull[]> {
  const supabase = await createClient();
  let q = supabase
    .from('bookings')
    .select(
      '*, unit:units(*), customer:customers(*), sale:profiles!bookings_sale_id_fkey(id,name,commission_rate), transactions(*)',
    )
    .order('checkin_date');
  if (range) {
    // Giao nhau với khoảng [from, to]
    q = q.lte('checkin_date', range.to).gte('checkout_date', range.from);
  }
  const { data } = await q;
  return (data ?? []) as BookingFull[];
}

export async function getPendingBookings(): Promise<BookingFull[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bookings')
    .select(
      '*, unit:units(*), customer:customers(*), sale:profiles!bookings_sale_id_fkey(id,name)',
    )
    .eq('status', 'pending')
    .order('created_at');
  return (data ?? []) as BookingFull[];
}

export async function getTransactions(range?: {
  from: string;
  to: string;
}): Promise<Transaction[]> {
  const supabase = await createClient();
  let q = supabase.from('transactions').select('*').order('paid_at', { ascending: false });
  if (range) q = q.gte('paid_at', range.from).lte('paid_at', range.to);
  const { data } = await q;
  return (data ?? []) as Transaction[];
}
