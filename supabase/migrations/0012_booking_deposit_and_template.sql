-- ── Tiền cọc THỎA THUẬN (schema) ─────────────────────────
--
-- Vì sao thêm cột này (0001_schema.sql nói "KHÔNG lưu đã cọc/còn lại"):
-- Nguyên tắc đó vẫn giữ nguyên. `deposit_amount` KHÔNG phải "đã cọc" —
-- transactions vẫn là nguồn sự thật duy nhất cho tiền THỰC THU.
-- Cột này là số cọc mà sale BÁO cho khách (để in lên QR + tin nhắn +
-- ảnh xác nhận). Trước đây sale gõ số này trong form nhưng không được
-- lưu, nên khi mở lại đơn hệ thống phải đoán lại từ transactions →
-- QR sinh sai số (VD tổng 2.000.000 mà QR ra 5.000.000).
--
-- NULL = đơn cũ chưa từng đặt cọc thỏa thuận → code tự suy ra như trước
-- (đã thu, chặn trần ở tổng tiền). Không backfill để khỏi ghi đè số thật.

alter table bookings
  add column if not exists deposit_amount bigint
    check (deposit_amount is null or deposit_amount >= 0);

comment on column bookings.deposit_amount is
  'Tiền cọc THỎA THUẬN báo cho khách (QR/tin nhắn/ảnh xác nhận). '
  'KHÔNG phải tiền đã thu — tiền thực thu luôn nằm ở bảng transactions. '
  'NULL = suy ra từ transactions.';

-- ── public_units: trả thêm maps_url ────────────────────────────────
-- Mẫu tin nhắn mới có dòng "* Định vị: {maps_url}". Landing /availability
-- (sale tự tạo đơn) trước đây không có dữ liệu này nên sẽ in ra dòng trống.
-- maps_url chỉ là link Google Maps công khai → an toàn cho anon.
drop function if exists public_units();
create or replace function public_units()
returns table (id uuid, home_name text, name text, base_price bigint,
               maps_url text, sort_order int)
language sql stable security definer set search_path = public as $$
  select u.id, h.name, u.name, u.base_price, h.maps_url, u.sort_order
  from units u join homes h on h.id = u.home_id
  order by u.sort_order
$$;
grant execute on function public_units() to anon;

-- ── public_confirm_booking: lưu luôn tiền cọc ──────────────────────
-- Sale tạo đơn ở /availability cũng gõ tiền cọc và gửi QR cho khách,
-- nhưng RPC cũ không lưu → admin mở lại đơn thấy số khác. Thêm p_deposit.
-- Chặn trần ở tổng tiền ngay trong DB (giống depositFor() ở server action).
drop function if exists public_confirm_booking(uuid, text, text, int, bigint, text, text);
create or replace function public_confirm_booking(
  p_hold uuid,
  p_customer_name text,
  p_customer_phone text,
  p_guests int,
  p_price bigint,
  p_sale_name text,
  p_source text,
  p_deposit bigint default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_cust uuid; v_sale uuid; v_code text; v_nights int; v_total bigint;
begin
  if coalesce(p_customer_phone, '') <> '' then
    select id into v_cust from customers where phone = p_customer_phone limit 1;
  end if;
  if v_cust is null then
    insert into customers (name, phone) values (p_customer_name, nullif(p_customer_phone, ''))
    returning id into v_cust;
  end if;

  if coalesce(trim(p_sale_name), '') <> '' then
    select id into v_sale from profiles
    where role = 'sale' and lower(name) = lower(trim(p_sale_name)) limit 1;
    if v_sale is null then
      v_sale := gen_random_uuid();
      insert into profiles (id, name, role, commission_rate, sale_token, active)
      values (v_sale, trim(p_sale_name), 'sale', 0.10, 'sale-' || gen_random_uuid(), true);
    end if;
  end if;

  -- Trần của cọc = tổng tiền của chính đơn giữ chỗ này.
  select (checkout_date - checkin_date) into v_nights from bookings where id = p_hold;
  v_total := coalesce(p_price, 0) * greatest(coalesce(v_nights, 0), 0);

  v_code := gen_booking_code(current_date);
  update bookings set
    code = v_code,
    customer_id = v_cust,
    sale_id = v_sale,
    guests_adult = greatest(coalesce(p_guests, 1), 1),
    price_per_night = coalesce(p_price, price_per_night),
    deposit_amount = case
      when p_deposit is null or p_deposit < 0 then null
      when v_total > 0 then least(p_deposit, v_total)
      else p_deposit
    end,
    status = 'confirmed',
    source = nullif(p_source, ''),
    hold_expires_at = null
  where id = p_hold and status = 'pending';

  return v_code;
end $$;
grant execute on function
  public_confirm_booking(uuid, text, text, int, bigint, text, text, bigint) to anon;


-- ── Backfill cọc cho các đơn nhập tay ngày 20/07/2026 ──────────────
-- Hai đơn này được nhập khi cột deposit_amount chưa tồn tại, nên số cọc
-- đã thỏa thuận (500.000) tạm ghi ở note. Giờ đưa về đúng cột.
-- Idempotent: chạy lại không đổi gì; DB mới chưa có mã này thì khớp 0 dòng.
update bookings set deposit_amount = 500000
where code in ('LS200701', 'LS190701') and deposit_amount is null;

-- Dọn ghi chú tạm của đơn Ms. Hùng (đã có cột thật thì không cần nữa).
update bookings set note = null
where code = 'LS200701'
  and note like 'Cọc thỏa thuận 500.000%';
