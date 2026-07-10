-- BOOTSTRAP.sql — dán vào Supabase SQL Editor → Run (chạy 1 lần cho DB mới)

-- ┌─── migrations/0001_schema.sql
-- ═══════════════════════════════════════════════════════════════════
-- Mốc 1 · Schema cơ sở (mục 5)
-- Nguyên tắc: KHÔNG lưu "đã cọc"/"còn lại" trong bookings.
-- Mọi con số tiền suy ra từ bảng transactions.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists btree_gist;
create extension if not exists "pgcrypto"; -- gen_random_uuid, gen_random_bytes

-- ── Enums ──────────────────────────────────────────────────────────
create type user_role     as enum ('owner', 'manager', 'sale');
create type booking_status as enum ('pending', 'confirmed', 'staying', 'completed', 'rejected', 'cancelled');
create type txn_type       as enum ('income', 'expense');

-- ── Nhà (home) ─────────────────────────────────────────────────────
create table homes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  maps_url    text,
  owner_name  text,
  owner_phone text
);

-- ── Đơn vị cho thuê (unit) ─────────────────────────────────────────
-- parent_unit_id = null  → nguyên căn.
-- Nguyên căn Long Sơn 2 là CHA của Phòng 1..4.
create table units (
  id             uuid primary key default gen_random_uuid(),
  home_id        uuid references homes(id) on delete cascade,
  name           text not null,                   -- 'Nguyên căn', 'Phòng 1'...
  parent_unit_id uuid references units(id),
  capacity       int  not null default 2,
  base_price     bigint not null default 0,       -- VND, số nguyên
  sort_order     int  not null default 0
);

-- ── Hồ sơ người dùng (gắn với auth.users) ──────────────────────────
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  phone           text,
  role            user_role not null default 'sale',
  commission_rate numeric   not null default 0.10,  -- 10%
  sale_token      text unique,                       -- token cho link /s/{token}, chỉ sale mới có
  active          boolean   not null default true,
  created_at      timestamptz default now()
);

-- ── Khách ──────────────────────────────────────────────────────────
create table customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  zalo       text,
  note       text,
  created_at timestamptz default now()
);

-- ── Booking ────────────────────────────────────────────────────────
-- checkout_date KHÔNG tính là 1 đêm. nights & total_amount là cột generated.
create table bookings (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,                     -- 'LS260701', sinh khi duyệt/confirmed
  unit_id         uuid references units(id),
  customer_id     uuid references customers(id),
  checkin_date    date not null,
  checkout_date   date not null,
  guests_adult    int  not null default 1,
  guests_child    int  not null default 0,
  price_per_night bigint not null,
  nights          int    generated always as (checkout_date - checkin_date) stored,
  total_amount    bigint generated always as
                    (price_per_night * (checkout_date - checkin_date)) stored,
  status          booking_status not null default 'pending',
  source          text,                            -- 'zalo','facebook','ota','referral','walk_in'
  sale_id         uuid references profiles(id),
  note            text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now(),
  hold_expires_at timestamptz,                     -- với 'giữ chỗ 30 phút'
  constraint chk_dates check (checkout_date > checkin_date)
);

create index bookings_unit_dates_idx on bookings (unit_id, checkin_date, checkout_date);
create index bookings_status_idx     on bookings (status);
create index bookings_sale_idx       on bookings (sale_id);

-- ── Giao dịch (nguồn sự thật cho mọi con số tiền) ──────────────────
create table transactions (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references bookings(id) on delete set null,
  type        txn_type not null,
  amount      bigint   not null check (amount >= 0),
  method      text,                                -- 'cash','transfer'
  category    text,                                -- 'deposit','balance','electricity','cleaning','commission'...
  paid_at     date not null default current_date,
  receipt_url text,                                -- ảnh hóa đơn (Supabase Storage)
  note        text,
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

create index transactions_booking_idx on transactions (booking_id);
create index transactions_type_idx     on transactions (type, paid_at);

-- ── Template tin nhắn xác nhận (mục 11) — sửa được sau ──────────────
create table message_templates (
  id      uuid primary key default gen_random_uuid(),
  name    text not null default 'confirm',
  body    text not null,
  updated_at timestamptz default now()
);

-- ── View suy ra tiền của booking (paid / remaining) (mục 5) ────────
create or replace view booking_finance as
select
  b.id            as booking_id,
  b.total_amount,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint as paid,
  b.total_amount - coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint as remaining
from bookings b
left join transactions t on t.booking_id = b.id
group by b.id, b.total_amount;


-- ┌─── migrations/0002_overlap_and_family.sql
-- ═══════════════════════════════════════════════════════════════════
-- Mốc 1 · Chống trùng lịch — Ở TẦNG DATABASE, không phải client (mục 6)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Không cho 2 booking CÙNG unit chồng ngày ────────────────────
-- Nửa mở [ci, co): trả sáng - nhận chiều CÙNG ngày là OK.
-- pending VẪN khóa ngày; chỉ chừa rejected & cancelled.
alter table bookings add constraint no_overlap
exclude using gist (
  unit_id with =,
  daterange(checkin_date, checkout_date, '[)') with &&
) where (status not in ('rejected', 'cancelled'));

-- ── 2. Ràng buộc CHA ↔ CON ─────────────────────────────────────────
-- Đặt nguyên căn Long Sơn 2 → khóa cả 4 phòng con, và ngược lại.
-- EXCLUDE ở trên chỉ chặn trùng trong cùng unit; quan hệ cha/con cần trigger.

-- Trả về "family" của 1 unit = { chính nó, cha nó, các con của nó }.
-- Lưu ý: không xử lý nhiều tầng (cháu) vì mô hình chỉ 2 tầng cha-con.
create or replace function unit_family(p_unit_id uuid)
returns setof uuid
language sql stable as $$
  select p_unit_id
  union
  select parent_unit_id from units where id = p_unit_id and parent_unit_id is not null
  union
  select id from units where parent_unit_id = p_unit_id
$$;

-- Trigger: trước khi ghi booking, kiểm tra chồng ngày với MỌI booking
-- thuộc unit trong family (trạng thái ≠ rejected/cancelled).
create or replace function check_family_overlap()
returns trigger
language plpgsql as $$
declare
  conflict_row bookings%rowtype;
begin
  -- Booking bị hủy/từ chối thì không khóa ngày → bỏ qua kiểm tra.
  if new.status in ('rejected', 'cancelled') then
    return new;
  end if;

  select b.* into conflict_row
  from bookings b
  where b.id <> new.id
    and b.status not in ('rejected', 'cancelled')
    and b.unit_id in (
      -- Family của unit đang đặt, BỎ chính unit đó (EXCLUDE đã lo unit đó rồi).
      select fid from unit_family(new.unit_id) fid where fid <> new.unit_id
    )
    and daterange(b.checkin_date, b.checkout_date, '[)')
        && daterange(new.checkin_date, new.checkout_date, '[)')
  limit 1;

  if found then
    raise exception 'TRUNG_LICH: đơn vị này (hoặc căn/phòng liên quan) đã có khách từ % đến % (đơn %)',
      to_char(conflict_row.checkin_date, 'DD/MM/YYYY'),
      to_char(conflict_row.checkout_date, 'DD/MM/YYYY'),
      coalesce(conflict_row.code, conflict_row.id::text)
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

create trigger trg_family_overlap
  before insert or update of unit_id, checkin_date, checkout_date, status
  on bookings
  for each row execute function check_family_overlap();

-- ── 3. Sinh mã booking 'LS' + ddMM + STT trong ngày (mục 7) ────────
-- Ví dụ: LS260701 = ngày 07/06?  → quy ước: dd = ngày checkin? Không.
-- Plan: 'LS' + ddMM + số thứ tự trong ngày. LS260701 minh họa.
-- Ta dùng ddMM của NGÀY DUYỆT (created_at của lần confirmed) cho ổn định đối soát.
create or replace function gen_booking_code(p_when date)
returns text
language plpgsql as $$
declare
  ddmm text := to_char(p_when, 'DDMM');
  seq  int;
begin
  select count(*) + 1 into seq
  from bookings
  where code like 'LS' || ddmm || '%';
  return 'LS' || ddmm || lpad(seq::text, 2, '0');
end;
$$;


-- ┌─── migrations/0003_rls.sql
-- ═══════════════════════════════════════════════════════════════════
-- Mốc 1 · Row Level Security — bật cho MỌI bảng (mục 8)
--
-- Mô hình truy cập:
--  • owner / manager  → đăng nhập bằng Supabase Auth (email+mật khẩu),
--    dùng anon key + session → chịu sự chi phối của policy dưới đây.
--  • sale             → KHÔNG có session. Vào qua Edge Function chạy
--    service_role (bỏ qua RLS) và tự lọc dữ liệu trước khi trả.
--  • anon (chưa đăng nhập) → KHÔNG có policy nào cho phép → không đọc
--    được gì bằng anon key. Đây là điều kiện của tiêu chí mục 19.
-- ═══════════════════════════════════════════════════════════════════

-- Helper: vai trò của user hiện tại. SECURITY DEFINER để không đệ quy RLS
-- khi đọc chính bảng profiles trong policy.
create or replace function my_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

alter table homes             enable row level security;
alter table units             enable row level security;
alter table profiles          enable row level security;
alter table customers         enable row level security;
alter table bookings          enable row level security;
alter table transactions      enable row level security;
alter table message_templates enable row level security;

-- ── HOMES / UNITS ──────────────────────────────────────────────────
-- Danh mục dùng chung; owner/manager toàn quyền, ai đăng nhập cũng đọc được.
create policy homes_read on homes for select
  using (auth.uid() is not null);
create policy homes_write on homes for all
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));

create policy units_read on units for select
  using (auth.uid() is not null);
create policy units_write on units for all
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));

-- ── PROFILES ───────────────────────────────────────────────────────
-- Sale chỉ thấy hồ sơ CỦA MÌNH (giấu commission_rate người khác).
create policy profile_read on profiles for select using (
  id = auth.uid() or my_role() in ('owner', 'manager')
);
-- Chỉ owner/manager tạo/sửa/xóa hồ sơ, đặt vai trò, đổi token.
create policy profile_write on profiles for all
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));

-- ── CUSTOMERS ──────────────────────────────────────────────────────
-- owner/manager toàn quyền. (Sale thao tác khách qua Edge Function.)
create policy customer_read on customers for select
  using (my_role() in ('owner', 'manager'));
create policy customer_write on customers for all
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));

-- ── BOOKINGS ───────────────────────────────────────────────────────
-- Sale chỉ đọc booking của mình; owner/manager đọc hết.
create policy booking_read on bookings for select using (
  sale_id = auth.uid() or my_role() in ('owner', 'manager')
);
-- Sale chỉ tạo booking pending, gán sale_id = chính mình.
create policy booking_insert on bookings for insert with check (
  my_role() in ('owner', 'manager')
  or (sale_id = auth.uid() and status = 'pending')
);
-- Chỉ owner/manager mới sửa (duyệt/từ chối/đổi trạng thái).
create policy booking_update on bookings for update
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));
create policy booking_delete on bookings for delete
  using (my_role() in ('owner', 'manager'));

-- ── TRANSACTIONS ───────────────────────────────────────────────────
-- Sale KHÔNG thấy chi phí; chỉ thấy tiền THU.
create policy txn_read on transactions for select using (
  type = 'income' or my_role() in ('owner', 'manager')
);
-- Chỉ owner/manager ghi thu chi.
create policy txn_write on transactions for all
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));

-- ── MESSAGE TEMPLATES ──────────────────────────────────────────────
create policy tpl_read on message_templates for select
  using (auth.uid() is not null);
create policy tpl_write on message_templates for all
  using (my_role() in ('owner', 'manager'))
  with check (my_role() in ('owner', 'manager'));

-- ── REALTIME theo RLS ──────────────────────────────────────────────
-- Bật realtime cho bookings; client chỉ dùng sự kiện như "tiếng chuông"
-- rồi gọi lại truy vấn đã lọc (mục 8 & 16) — không đọc payload thô.
alter publication supabase_realtime add table bookings;


-- ┌─── migrations/0004_cron_and_storage.sql
-- ═══════════════════════════════════════════════════════════════════
-- Giữ chỗ 30 phút hết hạn (mục 7) + Storage cho ảnh hóa đơn (mục 5)
-- ═══════════════════════════════════════════════════════════════════

-- ── Hủy các booking pending đã quá hạn giữ chỗ ─────────────────────
-- Gọi định kỳ (Vercel Cron → /api/cron/expire-holds, hoặc pg_cron).
create or replace function expire_holds()
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update bookings
     set status = 'cancelled'
   where status = 'pending'
     and hold_expires_at is not null
     and hold_expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── Bucket ảnh hóa đơn ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Chỉ owner/manager đọc/ghi ảnh hóa đơn.
create policy "receipts read"  on storage.objects for select
  using (bucket_id = 'receipts' and my_role() in ('owner','manager'));
create policy "receipts write" on storage.objects for insert
  with check (bucket_id = 'receipts' and my_role() in ('owner','manager'));

-- ── (Tùy chọn) Lịch pg_cron nếu bật extension trên Supabase ────────
-- Bỏ comment nếu dùng pg_cron thay cho Vercel Cron:
-- create extension if not exists pg_cron;
-- select cron.schedule('expire-holds', '*/5 * * * *', $$ select expire_holds(); $$);


-- ┌─── migrations/0005_customer_crm.sql
-- ═══════════════════════════════════════════════════════════════════
-- CRM nhẹ: theo dõi khách quay lại + khách giới thiệu
-- ═══════════════════════════════════════════════════════════════════

-- Khách này do khách nào giới thiệu (null = tự đến / nguồn khác).
alter table customers add column if not exists referred_by uuid references customers(id);

-- Đánh index để gộp khách theo SĐT (đếm số lần ở → khách quay lại).
create index if not exists customers_phone_idx on customers (phone);
create index if not exists customers_referred_by_idx on customers (referred_by);


-- ┌─── migrations/0006_public_availability.sql
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


-- ┌─── migrations/0007_profiles_no_auth_fk.sql
-- ═══════════════════════════════════════════════════════════════════
-- Cho phép tạo hồ sơ SALE mà KHÔNG cần tài khoản auth.
-- Sale không đăng nhập (vào bằng link/token) nên không cần dòng auth.users.
-- Gỡ FK profiles.id → auth.users để tạo sale chỉ là 1 insert bình thường
-- (không cần service role / secret key). Owner/manager vẫn khớp id = auth.uid().
-- ═══════════════════════════════════════════════════════════════════
alter table profiles drop constraint if exists profiles_id_fkey;


-- ┌─── migrations/0008_public_booking.sql
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


-- ┌─── migrations/0009_public_template.sql
-- Lấy mẫu tin nhắn xác nhận cho trang landing (anon) — để sale copy gửi khách.
create or replace function public_template()
returns text
language sql stable security definer set search_path = public as $$
  select body from message_templates where name = 'confirm' limit 1
$$;
grant execute on function public_template() to anon;


-- ┌─── migrations/0010_availability_status.sql
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


-- ┌─── migrations/0011_expire_holds_anon.sql
-- Cho cron (chạy bằng anon key, có CRON_SECRET bảo vệ ở tầng route) gọi được
-- expire_holds. An toàn vì hàm CHỈ hủy các giữ chỗ ĐÃ QUÁ HẠN (đằng nào cũng hết hạn).
grant execute on function expire_holds() to anon;


-- ┌─── seed.sql
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
$tpl$LONG SƠN HOMESTAY – XÁC NHẬN ĐẶT PHÒNG

🕒 Thời gian nhận phòng: 14h00, ngày {ngay_checkin}
🕛 Thời gian trả phòng: 12h00, ngày {ngay_checkout}

Tổng số đêm: {so_dem} đêm
Tổng chi phí: {gia_dem} x{so_dem} đêm = {tong_tien} VNĐ
Cọc: {tien_coc} VNĐ  (TÊN TK: {ten_tk} - SỐ TK: {so_tk} - TẠI: {ngan_hang})
💳 Số tiền còn lại thanh toán khi nhận phòng
⸻
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


