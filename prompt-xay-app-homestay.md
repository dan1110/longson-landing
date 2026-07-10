# Prompt xây dựng: App quản lý Homestay Long Sơn

> Dán toàn bộ file này vào một công cụ lập trình AI (Claude Code, Cursor, hoặc Claude ở cửa sổ mới). Hai chỗ cần bạn điền trước khi gửi được đánh dấu `⚠️ ĐIỀN`.

---

## 0. Vai trò của bạn (AI)

Bạn là kỹ sư full-stack dựng một web app quản lý homestay cho người **không rành công nghệ**, dùng chủ yếu **trên điện thoại**. Ưu tiên: đơn giản, khó bấm nhầm, không mất dữ liệu, chạy mượt trên 3G/4G. Viết code sạch, có chú thích tiếng Việt ở chỗ nghiệp vụ. Giao diện, nhãn nút, thông báo lỗi đều bằng **tiếng Việt**.

Làm theo đúng thứ tự ở mục 16. Sau mỗi mốc, dừng lại cho tôi kiểm tra rồi mới đi tiếp.

---

## 1. Bối cảnh

Homestay Long Sơn ở Việt Nam, cho thuê lưu trú ngắn ngày. Hiện quản lý bằng Excel và tin nhắn tay. Đội ngũ: 1 chủ (Ms.Tuyết), vài quản lý, nhiều sale. Mỗi lần khách đặt, sale soạn tay một tin xác nhận và theo dõi cọc/công nợ trên giấy → hay trùng lịch, nhầm ngày, sai tiền.

Sắp có thêm một căn 4 phòng, nên hệ thống phải xử lý được **căn nguyên (nguyên căn) lẫn căn chia phòng** ngay từ đầu.

## 2. Stack & nguyên tắc

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase**: Postgres, Auth, Row Level Security, Realtime, Storage, Edge Functions
- Deploy **Vercel** (frontend) + Supabase (backend) — dùng **bản miễn phí** cả hai
- **Mobile-first**: thiết kế cho màn ~390px, điều hướng bằng **thanh dưới đáy** (bottom nav), ô bấm ≥ 44px
- Định dạng tiền kiểu Việt: `2.000.000`. Ngày kiểu `16/7/2026`
- **Nguyên tắc bảo mật số 1:** mọi phân quyền phải chặn ở **tầng database (RLS)**, không chỉ ẩn nút trên giao diện. `anon key` là công khai — coi như ai cũng đọc được nó.

## 3. Ba mặt tiền, một database

```
/                → chuyển hướng: có session admin → /admin, không → trang đăng nhập
/login           → đăng nhập email + mật khẩu (chỉ chủ & quản lý)
/s/{token}       → TRANG SALE — vào bằng link riêng, KHÔNG mật khẩu
/admin           → TRANG ADMIN — chủ & quản lý, cần đăng nhập
```

Chỉ một dự án Next.js, một Supabase. Dùng hai route group: `app/(sale)/` và `app/(admin)/`. **Không tách hai repo.**

## 4. Vai trò

| Vai trò | Xem lịch | Tạo booking | Duyệt | Sửa/Xóa | Thu chi | Báo cáo lãi lỗ | Hoa hồng |
|---|---|---|---|---|---|---|---|
| **Sale** | tất cả (ẩn tiền của người khác) | có (→ trạng thái *chờ duyệt*) | ✕ | ✕ (gửi yêu cầu) | ✕ | ✕ | chỉ của mình |
| **Quản lý** | ✓ | ✓ (chốt luôn) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Chủ** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ + chốt trả | ✓ |

## 5. Mô hình dữ liệu (Postgres / Supabase)

Quan trọng: **không lưu cột "đã cọc" và "còn lại" trong bookings.** Mọi con số tiền suy ra từ bảng `transactions`. `total_amount`, `nights` là cột generated.

```sql
create type user_role     as enum ('owner','manager','sale');
create type booking_status as enum ('pending','confirmed','staying','completed','rejected','cancelled');
create type txn_type       as enum ('income','expense');

create table homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  maps_url text,
  owner_name text,
  owner_phone text
);

-- Đơn vị cho thuê. parent_unit_id = null nghĩa là nguyên căn.
-- Nguyên căn Long Sơn 2 là cha của Phòng 1..4.
create table units (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id) on delete cascade,
  name text not null,                 -- 'Nguyên căn', 'Phòng 1'...
  parent_unit_id uuid references units(id),
  capacity int not null default 2,
  base_price bigint not null default 0 -- VND, số nguyên
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  role user_role not null default 'sale',
  commission_rate numeric not null default 0.10,  -- 10%
  sale_token text unique,             -- token cho link /s/{token}, chỉ sale mới có
  active boolean not null default true
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  zalo text,
  note text
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  code text unique,                   -- 'LS260701', sinh khi duyệt
  unit_id uuid references units(id),
  customer_id uuid references customers(id),
  checkin_date date not null,
  checkout_date date not null,        -- ngày trả KHÔNG tính là 1 đêm
  guests_adult int not null default 1,
  guests_child int not null default 0,
  price_per_night bigint not null,
  nights int generated always as (checkout_date - checkin_date) stored,
  total_amount bigint generated always as
     (price_per_night * (checkout_date - checkin_date)) stored,
  status booking_status not null default 'pending',
  source text,                        -- 'zalo','facebook','ota','referral','walk_in'
  sale_id uuid references profiles(id),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  hold_expires_at timestamptz         -- với 'giữ chỗ 30 phút'
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  type txn_type not null,
  amount bigint not null,
  method text,                        -- 'cash','transfer'
  category text,                      -- 'deposit','balance','electricity','cleaning','commission'...
  paid_at date not null default current_date,
  receipt_url text,                   -- ảnh hóa đơn (Supabase Storage)
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
```

Cách tính suy ra (viết thành SQL view hoặc tính ở client):
```
paid(booking)     = tổng transactions.amount type='income' của booking
remaining(booking)= total_amount − paid
```

## 6. Chống trùng lịch — ở tầng database, KHÔNG ở client

```sql
create extension if not exists btree_gist;

-- Không cho 2 booking cùng unit chồng ngày. Nửa mở [ci, co): trả sáng, nhận chiều cùng ngày OK.
-- pending VẪN khóa ngày; chỉ chừa rejected & cancelled.
alter table bookings add constraint no_overlap
exclude using gist (
  unit_id with =,
  daterange(checkin_date, checkout_date, '[)') with &&
) where (status not in ('rejected','cancelled'));
```

**Ràng buộc cha ↔ con** (nguyên căn Long Sơn 2 đặt thì khóa cả 4 phòng, và ngược lại): viết một `trigger before insert or update` trên `bookings`, kiểm tra chồng ngày với mọi booking thuộc `unit cha + các unit con` của unit đang đặt (trạng thái ≠ rejected/cancelled), nếu có thì `raise exception`. Hàm gợi ý: lấy family = {unit_id, parent_of(unit_id), children_of(unit_id)}.

Frontend cũng kiểm tra để báo lỗi thân thiện, nhưng database là chốt chặn cuối.

## 7. Luồng trạng thái booking

```
Sale tạo         → PENDING   (khóa ngày, CHƯA tính doanh thu/hoa hồng)
  Quản lý duyệt  → CONFIRMED (sinh code LS…, tính doanh thu, mở tin nhắn + QR)
  Quản lý từ chối→ REJECTED  (nhả ngày)
Giữ chỗ 30 phút  → PENDING + hold_expires_at = now()+30'  (cron tự chuyển thành cancelled khi hết hạn)
Nhận phòng       → STAYING
Trả phòng xong   → COMPLETED (mốc chốt hoa hồng)
```

- Quản lý/chủ tạo booking thì vào thẳng CONFIRMED (không cần tự duyệt).
- **Doanh thu và hoa hồng chỉ tính từ trạng thái CONFIRMED trở lên.** Pending không được cộng vào báo cáo.
- Sinh `code`: `LS` + ddMM + số thứ tự trong ngày, ví dụ `LS260701`.

## 8. RLS (Row Level Security) — bật cho MỌI bảng

Viết policy TRƯỚC khi viết màn hình. Vài policy cốt lõi:

```sql
alter table bookings     enable row level security;
alter table transactions enable row level security;
alter table profiles     enable row level security;
alter table customers    enable row level security;

-- Helper
create or replace function my_role() returns user_role language sql stable as
$$ select role from profiles where id = auth.uid() $$;

-- Sale chỉ đọc booking của mình; quản lý/chủ đọc hết
create policy booking_read on bookings for select using (
  sale_id = auth.uid() or my_role() in ('owner','manager')
);

-- Sale KHÔNG thấy chi phí; chỉ thấy tiền thu
create policy txn_read on transactions for select using (
  type = 'income' or my_role() in ('owner','manager')
);

-- Sale chỉ thấy hồ sơ của mình (giấu commission_rate người khác)
create policy profile_read on profiles for select using (
  id = auth.uid() or my_role() in ('owner','manager')
);

-- Sale chỉ tạo booking pending, gán sale_id = chính mình, không sửa của người khác
create policy booking_insert on bookings for insert with check (
  my_role() in ('owner','manager')
  or (sale_id = auth.uid() and status = 'pending')
);
create policy booking_update on bookings for update using (
  my_role() in ('owner','manager')
);
```

**Realtime cũng phải theo RLS.** Bật RLS cho publication realtime, hoặc ở client chỉ dùng sự kiện realtime như "tiếng chuông" rồi gọi lại truy vấn đã lọc (đừng đọc thẳng payload vì payload chứa cả cột tiền).

## 9. Trang Sale vào bằng link — qua Edge Function

Trang `/s/{token}` **không** gọi thẳng bảng bằng anon key. Thay vào đó gọi một **Supabase Edge Function** (chạy service role):

1. Nhận `token` → tra `profiles.sale_token` ra `sale_id` và `role='sale'`. Sai token → 403.
2. Mọi truy vấn/ghi đều được function thực hiện rồi **lọc trước khi trả về**: lịch trống (không tên, không tiền của người khác), booking của chính sale này, hoa hồng của chính sale này, tạo booking pending gán đúng `sale_id`.
3. Token coi như bán công khai: lộ ra thì người lạ chỉ thấy lịch trống và tạo được booking rác — không thấy tiền, không xóa được gì. Có nút **đổi token** để thu hồi.

## 10. Màn hình

### Trang Sale — bottom nav 4 mục

1. **Trống** (mặc định): dải "Phòng hôm nay" (vuốt ngang, mỗi phòng hiện Trống/Có khách). Ô nhập *Nhận – Trả – Số khách* → nút **Tìm phòng trống** → danh sách từng đơn vị Trống/Bận kèm giá. Mỗi phòng trống có nút **Giữ chỗ 30 phút** và **Gửi chủ duyệt**.
2. **Lịch**: timeline ngang, mỗi đơn vị 1 dòng, 31 cột ngày. Thanh booking vẽ từ **giữa ô ngày nhận đến giữa ô ngày trả**. Ô của mình màu hồng + tên khách; của sale khác màu xám "Đã đặt"; chờ duyệt sọc vàng. Kéo ngang trên ô trống để chọn khoảng ngày → mở form đặt.
3. **Khách**: danh sách đơn của chính sale, mỗi thẻ có trạng thái (chờ duyệt / còn nợ / đã đủ). Bấm mở chi tiết: **Copy tin nhắn**, **QR thu tiền**, lịch sử thanh toán.
4. **Hoa hồng**: hoa hồng tháng của mình, danh sách đơn đã duyệt đóng góp bao nhiêu.

### Trang Admin — bottom nav 4 mục

1. **Tổng quan** (mặc định): 4 thẻ KPI (Doanh thu · Chi phí · **Lãi** + biên lãi% · Công suất phòng %). Biểu đồ cột doanh thu/chi phí theo tháng. Ô nhắc đỏ "có N booking chờ duyệt" (bấm sang tab Duyệt). Danh sách công nợ xếp theo ngày trả phòng gần nhất. Chọn được **Theo tháng / Cả năm**.
2. **Lịch**: như trên nhưng thấy hết, có tiền. Kéo tạo booking vào thẳng confirmed.
3. **Duyệt**: badge đỏ đếm số pending. Mỗi thẻ: khách, căn, ngày, số đêm, số khách, nguồn, sale gửi, giá trị + nút **Duyệt** / **Từ chối**.
4. **Sổ thu chi**: KPI Đã thu / Đã chi / Dòng tiền. Form ghi khoản chi (danh mục + số tiền + ngày + ảnh hóa đơn). Chi theo danh mục. Tiền vào. Mục **Hoa hồng sale**: mỗi sale bao nhiêu, nút **Đánh dấu đã trả** (tự sinh một `transaction` expense category='commission').

## 11. Sinh tin nhắn xác nhận

Lưu template trong DB để sau chủ tự sửa. Khi bấm **Copy tin nhắn**, thay biến và xuất **đúng** định dạng dưới (giữ nguyên emoji, xuống dòng, dấu `⸻`):

```
LONG SƠN HOMESTAY – XÁC NHẬN ĐẶT PHÒNG
Tên khách : {ten_khach}
✍️ Đặt home : {ten_home}
✍️ Vị trí Home : {maps_url}
🕒 Check in 14h ngày {ngay_checkin}
🕛 Check out 12h ngày {ngay_checkout}
✍️ số khách : {so_khach} NL
✍️ Tổng tiền {so_dem} đêm: {gia_dem} x {so_dem}= {tong_tien}VND,
✍️Ngày {ngay_coc} cọc {tien_coc} VND
CÒN LẠI {con_lai} VNĐ vui lòng thanh toán khi nhận home
{ten_chu} : {sdt_chu} ( chủ home )
⸻
🌿 Rất cảm ơn gia đình đã tin tưởng chọn Long Sơn Homestay là điểm dừng chân. Home rất mong được phục vụ và mang lại trải nghiệm nghỉ dưỡng tuyệt vời nhất cho gia đình!
```

Có thêm nút **Chia sẻ Zalo** (dùng Web Share API nếu có).

## 12. QR thu tiền (VietQR, miễn phí, không cần cổng thanh toán)

Ảnh QR tĩnh, điền sẵn số tiền + nội dung có mã booking để đối soát:

```
https://img.vietqr.io/image/{BIN}-{STK}-compact2.png?amount={SO_TIEN}&addInfo={MA_BOOKING}%20thanh%20toan&accountName={TEN_CHU_TK}
```

Mỗi booking hiện 2 QR: **cọc** và **còn lại** (amount tương ứng). Nội dung chuyển khoản chứa mã booking (vd `LS260701`) → sau này sao kê ngân hàng tìm mã là ra ngay đơn nào.

⚠️ ĐIỀN thông tin ngân hàng thật của chủ home:
```
BIN ngân hàng : __________   (mã ngân hàng VietQR, vd MB = 970422)
Số tài khoản  : __________
Tên chủ TK    : __________   (IN HOA không dấu)
```

## 13. Hoa hồng

- `commission_rate` lưu trên `profiles` (mặc định 0.10).
- Tính khi booking **COMPLETED** (khách ở xong), tránh trả cho đơn hủy.
- Màn hoa hồng theo tháng: mỗi sale số đơn, doanh số, hoa hồng, đã trả chưa.
- **Đánh dấu đã trả** → tạo `transaction(type=expense, category='commission')`. Chi phí này tự vào báo cáo lãi lỗ, không nhập tay lần nữa.

## 14. Công thức báo cáo (làm cho đúng, đừng gộp nhầm)

- **Doanh thu tháng** = tổng `total_amount` của booking CONFIRMED+ có đêm rơi vào tháng đó. (Ghi nhận theo giá trị booking, KHÔNG phải tiền đã vào tài khoản.)
- **Tiền thực thu** = tổng `transactions income`. Chênh lệch doanh thu − thực thu = **công nợ**. Hiển thị tách bạch, đừng trộn.
- **Công suất phòng** = số **đêm-phòng** đã bán / tổng đêm-phòng khả dụng. 1 đêm nguyên căn Long Sơn 2 = 4 đêm-phòng (vì khóa cả 4 phòng con). Tổng khả dụng tháng = (số đơn vị bán lẻ được) × số ngày. Nhờ cách quy đổi này mới so được nên bán nguyên căn hay bán lẻ lời hơn.
- **Lãi** = Doanh thu − Chi phí. Hoa hồng là **chi phí**, nằm trong tổng chi, ăn vào biên lãi.

## 15. Import / Export Excel

- **Import** (chạy 1 lần lúc đầu để không mất lịch sử): người dùng tải lên file .xlsx hiện tại → màn ánh xạ cột (khách, home, ngày nhận, ngày trả, số khách, giá, cọc, sale…) → tạo customers + bookings + transactions. Bỏ qua/đánh dấu dòng lỗi thay vì dừng hết.
- **Export**: xuất báo cáo tháng ra .xlsx (bookings + transactions) để chủ vẫn cầm được file. Đừng khóa dữ liệu vào một mình app.

⚠️ ĐIỀN: đính kèm file Excel hiện tại của tôi để bạn đọc cấu trúc cột thật và viết map cho khớp.

## 16. Realtime

Dùng Supabase Realtime (postgres_changes trên `bookings`). Khi có thay đổi → client gọi lại truy vấn đã lọc (không đọc payload thô). Giữ thêm: nút refresh thủ công + refetch khi mở lại app từ background + poll 3 phút làm lưới an toàn. Hiện trạng thái "● Trực tiếp · cập nhật hh:mm"; chấm chuyển xám khi mất kết nối.

## 17. Thứ tự build (dừng lại cho tôi duyệt sau mỗi mốc)

1. **Nền tảng**: khởi tạo Next.js + Supabase, tạo schema mục 5, EXCLUDE constraint + trigger cha/con (mục 6), bật RLS + policy (mục 8). Seed dữ liệu mục 18. Auth email cho admin.
2. **Trang Admin – Lịch + Đặt phòng**: timeline, kéo chọn ngày, form tạo booking (confirmed), sinh tin nhắn (mục 11), QR (mục 12).
3. **Luồng duyệt**: trạng thái pending, tab Duyệt, Duyệt/Từ chối, giữ chỗ 30 phút + cron hết hạn.
4. **Trang Sale**: Edge Function theo token (mục 9), 4 tab mục 10, đăng nhập bằng link.
5. **Thu chi + Báo cáo + Hoa hồng**: mục 13, 14.
6. **Realtime** (mục 16) + **Import/Export Excel** (mục 15).
7. Deploy Vercel + Supabase, kiểm thử trên điện thoại thật.

## 18. Dữ liệu seed (để test)

```
Homes:  Long Sơn (nguyên căn) ; Long Sơn 2 (nguyên căn + Phòng 1..4)
Units:  Long Sơn/Nguyên căn (cap 8, 1.000.000)
        Long Sơn 2/Nguyên căn (cap 12, 2.500.000) là cha của Phòng 1..4 (cap 3, 450.000)
Sales:  Ms. Hạnh (token riêng) ; Ms. Thu (token riêng) — rate 10%
Chủ:    Ms.Tuyết — SĐT 0336249668
Bookings mẫu: vài đơn confirmed rải trong tháng + 2 đơn pending để test màn Duyệt.
```

## 19. Tiêu chí hoàn thành

- [ ] Hai sale bấm lưu cùng một ngày/phòng → người sau bị **database** từ chối (không phải chỉ frontend).
- [ ] Đặt nguyên căn Long Sơn 2 → 4 phòng con tự khóa, và ngược lại.
- [ ] Sale mở DevTools gọi API bằng anon key → **không** lấy được chi phí, giá đơn của sale khác, hay commission_rate người khác.
- [ ] Link sale dùng được **không cần mật khẩu**; đổi token là thu hồi được ngay.
- [ ] Booking pending khóa ngày nhưng **không** vào doanh thu; duyệt xong mới cộng và sinh mã.
- [ ] Nút Copy tin nhắn ra **đúng** định dạng mục 11. QR điền sẵn số tiền + mã booking.
- [ ] Doanh thu, tiền thực thu, công nợ hiển thị **tách bạch**. Công suất tính theo đêm-phòng.
- [ ] Dùng mượt trên điện thoại: bottom nav, ô bấm to, có focus bàn phím, tôn trọng reduced-motion.
- [ ] Import được file Excel hiện tại; export được báo cáo tháng.
- [ ] Toàn bộ chạy trên **bản miễn phí** Supabase + Vercel.

---

### Hai việc tôi sẽ cung cấp
1. ⚠️ Thông tin ngân hàng cho QR (mục 12).
2. ⚠️ File Excel hiện tại để map import (mục 15).

Bắt đầu từ **Mốc 1**. Trước khi code, tóm tắt lại kiến trúc bạn hiểu để tôi xác nhận, rồi mới làm.
