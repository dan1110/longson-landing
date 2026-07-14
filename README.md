# Long Sơn Homestay — App quản lý đặt phòng

Web app quản lý homestay, **mobile-first**, tiếng Việt. Next.js (App Router) + Supabase (Postgres/Auth/RLS/Realtime/Storage) — chạy được trên **bản miễn phí** Vercel + Supabase.

Xây theo `prompt-xay-app-homestay.md`. Giao diện theo mockup `long-son-mobile.html`.

---

## Ba mặt tiền, một database

| Đường dẫn | Ai vào | Cách vào |
|---|---|---|
| `/login` → `/admin` | Chủ & Quản lý | Email + mật khẩu |
| `/s/{token}` | Sale | Link riêng, **không mật khẩu** |

Bảo mật cốt lõi: **mọi phân quyền chặn ở tầng database (RLS)**, không chỉ ẩn nút. `anon key` coi như công khai.

---

## Cấu trúc

```
app/
  login/                      đăng nhập admin
  (admin)/admin/             trang admin: tổng quan, lịch, duyệt, thu-chi, cài-đặt, import
  (sale)/s/[token]/          trang sale: trống, lịch, khách, hoa-hồng
  api/export/                xuất báo cáo .xlsx
  api/cron/expire-holds/     cron hủy giữ chỗ hết hạn
lib/                         supabase clients, format tiền/ngày, nghiệp vụ, báo cáo, sale backend
components/                  AppBar, BottomNav, Timeline, Sheet, BookingDetail, ...
supabase/
  migrations/                schema, chống trùng lịch + trigger cha/con, RLS, cron+storage
  seed.sql                   dữ liệu test (mục 18)
  functions/sale/            Edge Function bản tùy chọn (mục 9)
```

---

## 🚀 Chạy local

### 1. Cài đặt
```bash
npm install
```

### 2. Supabase local (cần Docker + Supabase CLI)
```bash
supabase start          # khởi động Postgres/Auth/... local
supabase db reset       # áp migrations + seed
```
Lệnh `supabase start` in ra `API URL`, `anon key`, `service_role key`.

### 3. Tạo `.env.local`
Copy từ `.env.example` rồi điền:
```bash
cp .env.example .env.local
```
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → từ `supabase start`
- `NEXT_PUBLIC_BANK_*` → **thông tin ngân hàng thật của chủ home** (xem bên dưới)

### 4. Chạy
```bash
npm run dev
```
- Admin: http://localhost:3000/login — `tuyet@longson.test` / `longson123`
- Sale: http://localhost:3000/s/sale-hanh-demo-token-001

---

## ⚠️ Thông tin bạn cần cung cấp

### 1. Ngân hàng cho QR VietQR (mục 12) — điền vào `.env.local`
```
NEXT_PUBLIC_BANK_BIN=970422           # mã ngân hàng VietQR (MB=970422, VCB=970436, ...)
NEXT_PUBLIC_BANK_ACCOUNT=xxxxxxxxxx   # số tài khoản
NEXT_PUBLIC_BANK_ACCOUNT_NAME=NGUYEN THI TUYET   # IN HOA, KHÔNG DẤU
```
Chưa điền thì app vẫn chạy, chỉ phần QR hiện thông báo "chưa cấu hình".

### 2. File Excel hiện tại (mục 15)
Gửi file `.xlsx` đang dùng để mình **map cột cho khớp**. Hiện màn `/admin/import`
đã có bộ khớp cột tổng quát (tự đoán theo tên cột), nhưng có file thật sẽ chỉnh
chính xác 100% và test trên dữ liệu của bạn.

### 3. Danh sách thật để thay seed
Tên các home/căn/phòng, giá, danh sách sale + tỉ lệ hoa hồng, tài khoản chủ/quản lý.
Mình sẽ thay `supabase/seed.sql` (hoặc nhập trực ttiếp sau khi deploy).

### 4. Google Sheet — tự đồng bộ dữ liệu (Khách / Sale / Thu chi)
Toàn bộ dữ liệu tự đẩy lên Google Sheet **sau mỗi thay đổi** (chạy nền, không làm
chậm thao tác). Sheet là bản sao; Supabase vẫn là nguồn gốc. Ba sheet: **Khách**
(STT · Ngày · Tên · SĐT · Số tiền ở), **Sale** (thông tin + hiệu quả), **Thu chi**
(mọi giao dịch). Cần điền 3 biến `GOOGLE_SHEETS_*` + `SUPABASE_SERVICE_ROLE_KEY`
vào `.env.local` — xem hướng dẫn tạo Service Account chi tiết trong `.env.example`.
Tóm tắt: bật Google Sheets API → tạo Service Account + key JSON → **Share sheet cho
`client_email` quyền Editor** → điền env. Chưa điền thì app vẫn chạy bình thường,
đồng bộ tự tắt. Có nút **Đồng bộ ngay** ở tab Cài đặt để chạy lại thủ công.

---

## ☁️ Deploy (miễn phí)

### Supabase (backend)
1. Tạo project tại supabase.com (Free tier).
2. Push schema: `supabase link --project-ref <ref>` rồi `supabase db push`.
   Hoặc dán lần lượt các file trong `supabase/migrations/` vào SQL Editor.
3. Chạy `supabase/seed.sql` (hoặc tạo dữ liệu tay).
4. Tạo tài khoản chủ/quản lý trong Authentication (nếu không seed).

### Vercel (frontend)
1. Import repo vào Vercel.
2. Thêm Environment Variables (giống `.env.local`, dùng URL/key của Supabase cloud)
   và thêm `CRON_SECRET` (chuỗi bí mật bất kỳ) cho cron.
3. Deploy. `vercel.json` đã cấu hình cron chạy `/api/cron/expire-holds` mỗi 5 phút.

---

## Đối chiếu tiêu chí hoàn thành (mục 19)

| Tiêu chí | Ở đâu |
|---|---|
| 2 sale đặt trùng → **DB** từ chối | `migrations/0002` — `EXCLUDE no_overlap` |
| Nguyên căn ↔ phòng con tự khóa | `migrations/0002` — trigger `check_family_overlap` |
| anon key không lấy được chi phí/giá sale khác | `migrations/0003` — RLS; sale đi qua service role (`lib/sale.ts`) |
| Link sale không cần mật khẩu; đổi token thu hồi | `/s/[token]`, `rotateSaleToken` (Cài đặt) |
| Pending khóa ngày, chưa vào doanh thu; duyệt mới sinh mã | `lib/report.ts` (REVENUE_STATUSES), `approveBooking` |
| Copy tin nhắn đúng định dạng + QR điền sẵn | `lib/message.ts`, `lib/vietqr.ts`, `BookingDetail` |
| Doanh thu / thực thu / công nợ tách bạch; công suất đêm-phòng | `lib/report.ts`, Tổng quan |
| Mobile: bottom nav, ô bấm to, reduced-motion | `components/`, `globals.css` |
| Import/Export Excel | `/admin/import`, `/api/export` |

---

## Ghi chú kỹ thuật

- **Realtime** (`components/RealtimeRefresher`): sự kiện `postgres_changes` chỉ dùng như
  "tiếng chuông" → gọi lại truy vấn đã lọc qua RLS, **không đọc payload thô** (mục 8, 16).
  Kèm refetch khi mở lại app + poll 3 phút.
- **Trang sale** không dùng anon key. Mọi truy vấn đi qua Server Action + service role,
  tự lọc trước khi trả (mục 9). Bản Edge Function tương đương ở `supabase/functions/sale/`.
- Tiền lưu `bigint` VND (số nguyên). "Đã cọc"/"còn lại" **không** lưu cột riêng — suy ra
  từ `transactions` (view `booking_finance`).
