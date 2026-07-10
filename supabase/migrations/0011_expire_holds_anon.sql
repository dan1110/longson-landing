-- Cho cron (chạy bằng anon key, có CRON_SECRET bảo vệ ở tầng route) gọi được
-- expire_holds. An toàn vì hàm CHỈ hủy các giữ chỗ ĐÃ QUÁ HẠN (đằng nào cũng hết hạn).
grant execute on function expire_holds() to anon;
