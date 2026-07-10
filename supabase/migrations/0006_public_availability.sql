-- ═══════════════════════════════════════════════════════════════════
-- Landing CHUNG xem lịch trống (public) — an toàn cho anon.
-- Chỉ trả: danh sách phòng + các khoảng ngày BẬN (không tên, không tiền).
-- SECURITY DEFINER để bỏ qua RLS nhưng chỉ lộ đúng dữ liệu vô hại.
-- ═══════════════════════════════════════════════════════════════════

-- Danh sách phòng (không kèm giá).
create or replace function public_units()
returns table (id uuid, home_name text, name text, sort_order int)
language sql stable security definer set search_path = public as $$
  select u.id, h.name, u.name, u.sort_order
  from units u join homes h on h.id = u.home_id
  order by u.sort_order
$$;
grant execute on function public_units() to anon;

-- Các khoảng BẬN, đã "nở" theo cha/con: đặt nguyên căn → khóa cả 4 phòng,
-- đặt 1 phòng → nguyên căn cũng coi như bận. Chỉ trả unit_id + ngày.
create or replace function public_availability()
returns table (unit_id uuid, checkin_date date, checkout_date date)
language sql stable security definer set search_path = public as $$
  select fam.fid, b.checkin_date, b.checkout_date
  from bookings b
  cross join lateral unit_family(b.unit_id) as fam(fid)
  where b.status not in ('rejected', 'cancelled')
$$;
grant execute on function public_availability() to anon;
