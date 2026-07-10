-- ═══════════════════════════════════════════════════════════════════
-- Cho phép tạo hồ sơ SALE mà KHÔNG cần tài khoản auth.
-- Sale không đăng nhập (vào bằng link/token) nên không cần dòng auth.users.
-- Gỡ FK profiles.id → auth.users để tạo sale chỉ là 1 insert bình thường
-- (không cần service role / secret key). Owner/manager vẫn khớp id = auth.uid().
-- ═══════════════════════════════════════════════════════════════════
alter table profiles drop constraint if exists profiles_id_fkey;
