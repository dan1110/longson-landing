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
