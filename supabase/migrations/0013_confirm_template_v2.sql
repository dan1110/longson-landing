-- ── Mẫu tin nhắn xác nhận (bản mới) ────────────────────────────────
-- CHẠY CÙNG LÚC VỚI DEPLOY CODE MỚI, không chạy sớm hơn:
-- template này dùng biến {sdt_khach} mà code CŨ chưa biết → nếu chạy
-- trước khi deploy, sale copy tin nhắn sẽ thấy chữ "{sdt_khach}" thô.
update message_templates
set body = $tpl$LONG SƠN HOMESTAY – XÁC NHẬN ĐẶT PHÒNG.
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
where name = 'confirm';
