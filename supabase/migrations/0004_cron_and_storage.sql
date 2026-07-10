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
