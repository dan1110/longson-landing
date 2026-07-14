import 'server-only';
// ─────────────────────────────────────────────────────────────────────
// Đồng bộ toàn bộ dữ liệu sang Google Sheet. Bố cục cột bám theo file Excel
// chủ home đang dùng thật (Đặt phòng / Chi phí / Dashboard), bỏ phần Lịch.
// Supabase là nguồn gốc; Google Sheet là bản sao — mỗi lần sync ghi đè lại.
// 4 sheet: Khách · Sale · Thu chi · Dashboard.
// ─────────────────────────────────────────────────────────────────────
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORY_LABEL, METHOD_LABEL, SOURCE_LABEL, STATUS_LABEL, paid, paymentStatus } from '@/lib/booking';
import { dmyPad } from '@/lib/format';

const SHEET_KHACH = 'Khách';
const SHEET_SALE = 'Sale';
const SHEET_THUCHI = 'Thu chi';
const SHEET_DASHBOARD = 'Dashboard';
const ALL_TABS = [SHEET_KHACH, SHEET_SALE, SHEET_THUCHI, SHEET_DASHBOARD];

const REVENUE = ['confirmed', 'staying', 'completed'];

/** Có đủ cấu hình Google Sheet để sync không? */
export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY,
  );
}

function getSheetsClient() {
  // private_key trong env bị escape \n → khôi phục lại xuống dòng thật.
  const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

type Grid = (string | number)[][];

async function ensureTabs(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[],
  );
  const toCreate = ALL_TABS.filter((t) => !existing.has(t));
  if (toCreate.length === 0) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });
}

async function writeTab(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  title: string,
  values: Grid,
): Promise<void> {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

/**
 * Đánh dấu KHÁCH MỚI / KHÁCH CŨ cho từng đơn: đơn có doanh thu ĐẦU TIÊN của
 * một khách (tính theo ngày nhận phòng) là "Khách mới", các đơn sau là "Khách cũ".
 * Đơn chưa gắn khách (đơn cũ nhập từ Excel, không rõ tên) → null = "chưa rõ",
 * và KHÔNG được tính vào thống kê mới/cũ để khỏi làm lệch số.
 */
function buildNewReturningMap(revenueBookings: any[]): Map<string, boolean | null> {
  const firstByCustomer = new Map<string, string>(); // customer_id → booking id đầu tiên
  const sorted = [...revenueBookings].sort((a, b) =>
    a.checkin_date === b.checkin_date
      ? String(a.id).localeCompare(String(b.id))
      : a.checkin_date.localeCompare(b.checkin_date),
  );
  for (const b of sorted) {
    if (!b.customer_id) continue;
    if (!firstByCustomer.has(b.customer_id)) firstByCustomer.set(b.customer_id, b.id);
  }
  const isNew = new Map<string, boolean | null>();
  for (const b of sorted) {
    isNew.set(b.id, !b.customer_id ? null : firstByCustomer.get(b.customer_id) === b.id);
  }
  return isNew;
}

/** Nhãn cột "Khách mới/cũ". */
const newOldLabel = (v: boolean | null | undefined) =>
  v == null ? '—' : v ? 'Khách mới' : 'Khách cũ';

export async function syncAllToSheets(): Promise<{ ok: boolean; error?: string }> {
  if (!sheetsConfigured()) {
    return { ok: false, error: 'Chưa cấu hình Google Sheet (thiếu biến môi trường).' };
  }
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const supabase = createAdminClient();

  const [{ data: bookings }, { data: sales }, { data: txns }] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        '*, unit:units(name), customer:customers(name,phone), sale:profiles!bookings_sale_id_fkey(name), transactions(*)',
      )
      .order('checkin_date', { ascending: true }),
    supabase.from('profiles').select('*').eq('role', 'sale').order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('*, booking:bookings(code, customer:customers(name))')
      .order('paid_at', { ascending: true }),
  ]);

  const revenue = (bookings ?? []).filter((b: any) => REVENUE.includes(b.status));
  const isNew = buildNewReturningMap(revenue);

  // ── Sheet KHÁCH ────────────────────────────────────────────────────
  const khachGrid: Grid = [
    [
      'STT', 'Mã đặt', 'Ngày', 'Tên khách', 'SĐT', 'Khách mới/cũ', 'Nguồn',
      'Check-in', 'Check-out', 'Số đêm', 'Giá/đêm', 'Số tiền ở',
      'Đã thu', 'Còn lại', 'Tình trạng TT', 'Trạng thái', 'Sale', 'Ghi chú',
    ],
  ];
  revenue.forEach((b: any, i: number) => {
    const total = Number(b.total_amount) || 0;
    const daThu = paid(b.transactions);
    khachGrid.push([
      i + 1,
      b.code ?? '',
      dmyPad(b.checkin_date),
      b.customer?.name ?? 'Khách lẻ', // đơn cũ chưa rõ tên khách
      b.customer?.phone ?? '',
      newOldLabel(isNew.get(b.id)),
      SOURCE_LABEL[b.source] ?? b.source ?? '',
      dmyPad(b.checkin_date),
      dmyPad(b.checkout_date),
      Number(b.nights) || 0,
      Number(b.price_per_night) || 0,
      total,
      daThu,
      total - daThu,
      paymentStatus(total, daThu),
      STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status,
      b.sale?.name ?? '',
      b.note ?? '',
    ]);
  });

  // ── Sheet SALE ─────────────────────────────────────────────────────
  const saleGrid: Grid = [
    [
      'STT', 'Tên sale', 'SĐT', '% Hoa hồng', 'Trạng thái', 'Số đơn',
      'Khách mới', 'Khách cũ', 'Doanh thu mang về', 'Đã thu', 'Hoa hồng tạm tính',
    ],
  ];
  (sales ?? []).forEach((s: any, i: number) => {
    const mine = revenue.filter((b: any) => b.sale_id === s.id);
    const rev = mine.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
    const collected = mine.reduce((sum: number, b: any) => sum + paid(b.transactions), 0);
    const rate = Number(s.commission_rate) || 0;
    saleGrid.push([
      i + 1,
      s.name ?? '',
      s.phone ?? '',
      `${Math.round(rate * 100)}%`,
      s.active ? 'Đang làm' : 'Đã khóa',
      mine.length,
      mine.filter((b: any) => isNew.get(b.id) === true).length,
      mine.filter((b: any) => isNew.get(b.id) === false).length,
      rev,
      collected,
      Math.round(rev * rate),
    ]);
  });

  // ── Sheet THU CHI ──────────────────────────────────────────────────
  const thuchiGrid: Grid = [
    ['STT', 'Ngày', 'Loại', 'Hạng mục', 'Số tiền', 'Phương thức', 'Khách / Đơn', 'Diễn giải'],
  ];
  (txns ?? []).forEach((t: any, i: number) => {
    thuchiGrid.push([
      i + 1,
      dmyPad(t.paid_at),
      t.type === 'income' ? 'Thu' : 'Chi',
      CATEGORY_LABEL[t.category] ?? t.category ?? '',
      Number(t.amount) || 0,
      METHOD_LABEL[t.method] ?? t.method ?? '',
      t.booking?.customer?.name ?? (t.booking?.code ? `Đơn ${t.booking.code}` : ''),
      t.note ?? '',
    ]);
  });

  // ── Sheet DASHBOARD ────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const inYear = (d: string) => d?.startsWith(String(year));
  const revYear = revenue.filter((b: any) => inYear(b.checkin_date));
  const txnYear = (txns ?? []).filter((t: any) => inYear(t.paid_at));

  const doanhThu = revYear.reduce((s: number, b: any) => s + (Number(b.total_amount) || 0), 0);
  const daThu = txnYear
    .filter((t: any) => t.type === 'income')
    .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
  const chiPhi = txnYear
    .filter((t: any) => t.type === 'expense')
    .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
  const loiNhuan = doanhThu - chiPhi;
  const soDem = revYear.reduce((s: number, b: any) => s + (Number(b.nights) || 0), 0);
  // Chỉ tính trên đơn ĐÃ BIẾT khách; đơn cũ chưa rõ tên không làm lệch tỉ lệ.
  const khachMoi = revYear.filter((b: any) => isNew.get(b.id) === true).length;
  const khachCu = revYear.filter((b: any) => isNew.get(b.id) === false).length;
  const chuaRo = revYear.length - khachMoi - khachCu;

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : '0%');

  const dashGrid: Grid = [
    [`QUẢN LÝ HOMESTAY — TỔNG QUAN ${year}`],
    [`Cập nhật tự động từ app · ${dmyPad(new Date())}`],
    [],
    ['TỔNG QUAN CẢ NĂM'],
    ['Tổng doanh thu', 'Đã thu', 'Còn phải thu'],
    [doanhThu, daThu, doanhThu - daThu],
    ['Tổng chi phí', 'Lợi nhuận', 'Tỷ suất LN'],
    [chiPhi, loiNhuan, pct(loiNhuan, doanhThu)],
    ['Số lượt đặt', 'Tổng số đêm', 'Doanh thu TB/đêm'],
    [revYear.length, soDem, soDem ? Math.round(doanhThu / soDem) : 0],
    ['Khách mới', 'Khách cũ', 'Tỉ lệ khách quay lại', 'Đơn chưa rõ khách'],
    [khachMoi, khachCu, pct(khachCu, khachMoi + khachCu), chuaRo],
    [],
    ['CHI TIẾT THEO THÁNG'],
    ['Tháng', 'Doanh thu', 'Đã thu', 'Còn lại', 'Chi phí', 'Lợi nhuận', 'Số đêm', 'Số lượt', 'Khách mới', 'Khách cũ'],
  ];

  for (let m = 1; m <= 12; m++) {
    const p = `${year}-${String(m).padStart(2, '0')}`;
    const bs = revenue.filter((b: any) => b.checkin_date?.startsWith(p));
    const ts = (txns ?? []).filter((t: any) => t.paid_at?.startsWith(p));
    const dt = bs.reduce((s: number, b: any) => s + (Number(b.total_amount) || 0), 0);
    const dth = ts.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
    const cp = ts.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
    dashGrid.push([
      m, dt, dth, dt - dth, cp, dt - cp,
      bs.reduce((s: number, b: any) => s + (Number(b.nights) || 0), 0),
      bs.length,
      bs.filter((b: any) => isNew.get(b.id) === true).length,
      bs.filter((b: any) => isNew.get(b.id) === false).length,
    ]);
  }

  try {
    const sheets = getSheetsClient();
    await ensureTabs(sheets, spreadsheetId);
    await writeTab(sheets, spreadsheetId, SHEET_KHACH, khachGrid);
    await writeTab(sheets, spreadsheetId, SHEET_SALE, saleGrid);
    await writeTab(sheets, spreadsheetId, SHEET_THUCHI, thuchiGrid);
    await writeTab(sheets, spreadsheetId, SHEET_DASHBOARD, dashGrid);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message ?? 'Lỗi không rõ';
    console.error('[sheets] sync thất bại:', msg);
    return { ok: false, error: msg };
  }
}
