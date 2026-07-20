-- ═══════════════════════════════════════════════════════════════════
-- Dữ liệu seed để test (mục 18)
-- Chạy: supabase db reset  (tự áp migrations + seed này)
--
-- Tài khoản đăng nhập tạo sẵn (đổi mật khẩu sau khi lên production!):
--   Chủ     : tuyet@longson.test   / longson123
--   Quản lý : quanly@longson.test  / longson123
-- Sale KHÔNG có mật khẩu — vào bằng link /s/{token} bên dưới.
-- ═══════════════════════════════════════════════════════════════════

-- ── UUID cố định để tham chiếu chéo ────────────────────────────────
-- Homes
--   h1 = Long Sơn, h2 = Long Sơn 2
-- Units
--   u_ls1  = Long Sơn / Nguyên căn
--   u_ls2  = Long Sơn 2 / Nguyên căn (cha)
--   u_p1..4 = Phòng 1..4 (con của u_ls2)
-- Profiles
--   p_owner, p_mgr, p_hanh, p_thu

-- ── HOMES ──────────────────────────────────────────────────────────
insert into homes (id, name, address, maps_url, owner_name, owner_phone) values
  ('11111111-0000-0000-0000-000000000001', 'Long Sơn',   'Long Sơn, Việt Nam', 'https://maps.app.goo.gl/longson1', 'Ms.Tuyết', '0336249668'),
  ('11111111-0000-0000-0000-000000000002', 'Long Sơn 2', 'Long Sơn, Việt Nam', 'https://maps.app.goo.gl/longson2', 'Ms.Tuyết', '0336249668');

-- ── UNITS ──────────────────────────────────────────────────────────
insert into units (id, home_id, name, parent_unit_id, capacity, base_price, sort_order) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Nguyên căn', null, 8, 1000000, 1),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Nguyên căn', null, 12, 2500000, 2);

insert into units (id, home_id, name, parent_unit_id, capacity, base_price, sort_order) values
  ('22222222-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-000000000002', 'Phòng 1', '22222222-0000-0000-0000-000000000002', 3, 450000, 3),
  ('22222222-0000-0000-0000-0000000000a2', '11111111-0000-0000-0000-000000000002', 'Phòng 2', '22222222-0000-0000-0000-000000000002', 3, 450000, 4),
  ('22222222-0000-0000-0000-0000000000a3', '11111111-0000-0000-0000-000000000002', 'Phòng 3', '22222222-0000-0000-0000-000000000002', 3, 450000, 5),
  ('22222222-0000-0000-0000-0000000000a4', '11111111-0000-0000-0000-000000000002', 'Phòng 4', '22222222-0000-0000-0000-000000000002', 3, 450000, 6);

-- ── AUTH USERS (chủ + quản lý) ─────────────────────────────────────
-- Tạo trực tiếp trong auth.users cho môi trường local. Mật khẩu: longson123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000',
   '33333333-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'tuyet@longson.test', crypt('longson123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'quanly@longson.test', crypt('longson123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- Sale cũng cần dòng auth.users do FK profiles.id → auth.users, dù không đăng nhập.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000',
   '33333333-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
   'hanh.sale@longson.test', crypt(gen_random_uuid()::text, gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated',
   'thu.sale@longson.test', crypt(gen_random_uuid()::text, gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- GoTrue yêu cầu các cột token là chuỗi rỗng '' thay vì NULL, nếu không sẽ báo
-- "Database error querying schema" khi đăng nhập. Đặt lại cho các user seed.
update auth.users set
  confirmation_token='', recovery_token='', email_change='',
  email_change_token_new='', email_change_token_current='',
  phone_change='', phone_change_token='', reauthentication_token=''
where email like '%@longson.test';

-- ── PROFILES ───────────────────────────────────────────────────────
insert into profiles (id, name, phone, role, commission_rate, sale_token, active) values
  ('33333333-0000-0000-0000-000000000001', 'Ms.Tuyết', '0336249668', 'owner',   0.00, null, true),
  ('33333333-0000-0000-0000-000000000002', 'Quản lý',  null,          'manager', 0.00, null, true),
  ('33333333-0000-0000-0000-0000000000a1', 'Ms. Hạnh', null, 'sale', 0.10, 'sale-hanh-demo-token-001', true),
  ('33333333-0000-0000-0000-0000000000a2', 'Ms. Thu',  null, 'sale', 0.10, 'sale-thu-demo-token-002',  true);

-- ── TEMPLATE TIN NHẮN (mục 11) ─────────────────────────────────────
insert into message_templates (name, body) values (
  'confirm',
$tpl$LONG SƠN HOMESTAY – XÁC NHẬN ĐẶT PHÒNG.
*Tên khách: {ten_khach}
*Số người: {so_khach}NL
*Số điện thoại: {sdt_khach}
* Định vị: {maps_url}

🕒 Thời gian nhận phòng: 14h00, ngày {ngay_checkin}
🕛 Thời gian trả phòng: 12h00, ngày {ngay_checkout}

Tổng số đêm: {so_dem} đêm
Tổng chi phí: {gia_dem} x {so_dem}đêm = {tong_tien} VNĐ
Cọc: {tien_coc} VNĐ  (TÊN TK: {ten_tk} - SỐ TK: {so_tk})
💳 Số tiền còn lại {con_lai} thanh toán khi nhận phòng.
⸻
🌿 Vui lòng giữ gìn vệ sinh chung, nếu khách không có thời gian, chúng tôi sẽ thay mặt bạn dọn dẹp, phí phụ thu 200.000 VNĐ
🌿 Rất cảm ơn gia đình đã tin tưởng chọn Long Sơn Homestay là điểm dừng chân. Home rất mong được phục vụ và mang lại trải nghiệm nghỉ dưỡng tuyệt vời nhất cho gia đình!$tpl$
);

-- ── KHÁCH mẫu ──────────────────────────────────────────────────────
insert into customers (id, name, phone, zalo) values
  ('44444444-0000-0000-0000-000000000001', 'Anh Dũng',  '0901111111', '0901111111'),
  ('44444444-0000-0000-0000-000000000002', 'Chị Lan',   '0902222222', '0902222222'),
  ('44444444-0000-0000-0000-000000000003', 'Anh Phúc',  '0903333333', null),
  ('44444444-0000-0000-0000-000000000004', 'Chị Mai',   '0904444444', null);

-- ── BOOKINGS mẫu (rải trong tháng hiện tại) ────────────────────────
-- Dùng date_trunc('month', current_date) làm mốc để seed luôn "trong tháng".
-- 3 confirmed + 2 pending (để test màn Duyệt).
insert into bookings
  (id, code, unit_id, customer_id, checkin_date, checkout_date,
   guests_adult, price_per_night, status, source, sale_id, created_by, created_at)
values
  -- Confirmed: Long Sơn nguyên căn, đầu tháng
  ('55555555-0000-0000-0000-000000000001', 'LS0101',
   '22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001',
   date_trunc('month', current_date)::date + 2,
   date_trunc('month', current_date)::date + 4,
   4, 1000000, 'confirmed', 'zalo',
   '33333333-0000-0000-0000-0000000000a1', '33333333-0000-0000-0000-000000000002', now()),

  -- Confirmed: Long Sơn 2 nguyên căn, giữa tháng (khóa cả 4 phòng con)
  ('55555555-0000-0000-0000-000000000002', 'LS0102',
   '22222222-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000002',
   date_trunc('month', current_date)::date + 10,
   date_trunc('month', current_date)::date + 12,
   10, 2500000, 'confirmed', 'facebook',
   '33333333-0000-0000-0000-0000000000a2', '33333333-0000-0000-0000-000000000002', now()),

  -- Confirmed: Phòng 1 lẻ, cuối tháng
  ('55555555-0000-0000-0000-000000000003', 'LS0103',
   '22222222-0000-0000-0000-0000000000a1', '44444444-0000-0000-0000-000000000003',
   date_trunc('month', current_date)::date + 20,
   date_trunc('month', current_date)::date + 22,
   2, 450000, 'confirmed', 'walk_in',
   '33333333-0000-0000-0000-0000000000a1', '33333333-0000-0000-0000-000000000001', now());

-- Pending (chưa có code, chờ duyệt)
insert into bookings
  (id, unit_id, customer_id, checkin_date, checkout_date,
   guests_adult, price_per_night, status, source, sale_id, created_by, created_at)
values
  ('55555555-0000-0000-0000-0000000000f1',
   '22222222-0000-0000-0000-0000000000a2', '44444444-0000-0000-0000-000000000004',
   date_trunc('month', current_date)::date + 15,
   date_trunc('month', current_date)::date + 17,
   3, 450000, 'pending', 'zalo',
   '33333333-0000-0000-0000-0000000000a1', '33333333-0000-0000-0000-0000000000a1', now()),

  ('55555555-0000-0000-0000-0000000000f2',
   '22222222-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002',
   date_trunc('month', current_date)::date + 25,
   date_trunc('month', current_date)::date + 27,
   6, 1000000, 'pending', 'referral',
   '33333333-0000-0000-0000-0000000000a2', '33333333-0000-0000-0000-0000000000a2', now());

-- ── TRANSACTIONS mẫu ───────────────────────────────────────────────
-- Đơn 1: đã cọc 1.000.000 (còn nợ 1.000.000)
-- Đơn 2: đã thu đủ 5.000.000
-- Đơn 3: chưa thu
insert into transactions (booking_id, type, amount, method, category, paid_at) values
  ('55555555-0000-0000-0000-000000000001', 'income', 1000000, 'transfer', 'deposit', current_date),
  ('55555555-0000-0000-0000-000000000002', 'income', 2500000, 'transfer', 'deposit', current_date),
  ('55555555-0000-0000-0000-000000000002', 'income', 2500000, 'cash',     'balance', current_date);

-- Chi phí mẫu (chỉ owner/manager thấy)
insert into transactions (type, amount, method, category, paid_at, note) values
  ('expense', 300000, 'cash', 'cleaning',    current_date, 'Dọn dẹp đầu tháng'),
  ('expense', 500000, 'transfer', 'electricity', current_date, 'Tiền điện');
