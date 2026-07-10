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
