-- ═══════════════════════════════════════════════════════════════════
-- CRM nhẹ: theo dõi khách quay lại + khách giới thiệu
-- ═══════════════════════════════════════════════════════════════════

-- Khách này do khách nào giới thiệu (null = tự đến / nguồn khác).
alter table customers add column if not exists referred_by uuid references customers(id);

-- Đánh index để gộp khách theo SĐT (đếm số lần ở → khách quay lại).
create index if not exists customers_phone_idx on customers (phone);
create index if not exists customers_referred_by_idx on customers (referred_by);
