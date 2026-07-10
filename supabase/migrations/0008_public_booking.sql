-- ═══════════════════════════════════════════════════════════════════
-- Cho phép SALE tự tạo đơn trên trang landing chung (anon) — KHÔNG cần
-- secret key. Dùng SECURITY DEFINER (chạy như owner, bỏ qua RLS) nhưng
-- chỉ mở đúng thao tác cần: giữ chỗ, chốt đơn, nhả chỗ, tự thêm tên sale.
-- Vẫn được database chống trùng lịch (EXCLUDE + trigger cha/con).
-- ═══════════════════════════════════════════════════════════════════

-- Bổ sung giá vào danh sách phòng (sale cần biết giá để đặt).
drop function if exists public_units();
create or replace function public_units()
returns table (id uuid, home_name text, name text, base_price bigint, sort_order int)
language sql stable security definer set search_path = public as $$
  select u.id, h.name, u.name, u.base_price, u.sort_order
  from units u join homes h on h.id = u.home_id
  order by u.sort_order
$$;
grant execute on function public_units() to anon;

-- Danh sách tên sale đang hoạt động (cho ô chọn trên landing).
create or replace function public_sales()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from profiles where role = 'sale' and active order by name
$$;
grant execute on function public_sales() to anon;

-- Giữ chỗ tức thì. Trả id; trùng lịch thì báo lỗi TRUNG_LICH.
create or replace function public_create_hold(p_unit uuid, p_checkin date, p_checkout date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_price bigint;
begin
  select base_price into v_price from units where id = p_unit;
  begin
    insert into bookings (unit_id, checkin_date, checkout_date, price_per_night, status, hold_expires_at)
    values (p_unit, p_checkin, p_checkout, coalesce(v_price, 0), 'pending', now() + interval '10 min')
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'TRUNG_LICH';
  end;
  return v_id;
end $$;
grant execute on function public_create_hold(uuid, date, date) to anon;

-- Nhả giữ chỗ (khi hủy form).
create or replace function public_release_hold(p_hold uuid)
returns void
language sql security definer set search_path = public as $$
  delete from bookings where id = p_hold and status = 'pending'
$$;
grant execute on function public_release_hold(uuid) to anon;

-- Chốt giữ chỗ thành đơn CHÍNH THỨC (không cần chủ duyệt).
-- Gộp khách theo SĐT; tìm-hoặc-tạo sale theo tên (sale mới tự thêm được).
create or replace function public_confirm_booking(
  p_hold uuid,
  p_customer_name text,
  p_customer_phone text,
  p_guests int,
  p_price bigint,
  p_sale_name text,
  p_source text
) returns text
language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_sale uuid; v_code text;
begin
  -- Khách theo SĐT (gộp khách quay lại)
  if coalesce(p_customer_phone, '') <> '' then
    select id into v_cust from customers where phone = p_customer_phone limit 1;
  end if;
  if v_cust is null then
    insert into customers (name, phone) values (p_customer_name, nullif(p_customer_phone, ''))
    returning id into v_cust;
  end if;

  -- Sale theo tên: tìm hoặc TẠO MỚI (sale tự thêm tên)
  if coalesce(trim(p_sale_name), '') <> '' then
    select id into v_sale from profiles
    where role = 'sale' and lower(name) = lower(trim(p_sale_name)) limit 1;
    if v_sale is null then
      v_sale := gen_random_uuid();
      insert into profiles (id, name, role, commission_rate, sale_token, active)
      values (v_sale, trim(p_sale_name), 'sale', 0.10, 'sale-' || gen_random_uuid(), true);
    end if;
  end if;

  v_code := gen_booking_code(current_date);
  update bookings set
    code = v_code,
    customer_id = v_cust,
    sale_id = v_sale,
    guests_adult = greatest(coalesce(p_guests, 1), 1),
    price_per_night = coalesce(p_price, price_per_night),
    status = 'confirmed',
    source = nullif(p_source, ''),
    hold_expires_at = null
  where id = p_hold and status = 'pending';

  return v_code;
end $$;
grant execute on function public_confirm_booking(uuid, text, text, int, bigint, text, text) to anon;
