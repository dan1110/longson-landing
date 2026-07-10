-- Trả thêm trạng thái để phân biệt "Đã đặt" (confirmed) vs "Đang đặt" (giữ chỗ).
drop function if exists public_availability();
create or replace function public_availability()
returns table (unit_id uuid, checkin_date date, checkout_date date, status text)
language sql stable security definer set search_path = public as $$
  select fam.fid, b.checkin_date, b.checkout_date, b.status::text
  from bookings b
  cross join lateral unit_family(b.unit_id) as fam(fid)
  where b.status not in ('rejected', 'cancelled')
$$;
grant execute on function public_availability() to anon;
