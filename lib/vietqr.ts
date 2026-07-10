// QR thu tiền VietQR (mục 12) — ảnh tĩnh, miễn phí, không cần cổng thanh toán.

const BIN = process.env.NEXT_PUBLIC_BANK_BIN ?? '';
const STK = process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? '';
// Tên chủ TK cho QR: IN HOA, KHÔNG DẤU (yêu cầu của VietQR).
const NAME = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME ?? '';
// Tên chủ TK hiển thị trong tin nhắn (có dấu) + tên ngân hàng hiển thị.
const NAME_DISPLAY =
  process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME_DISPLAY ?? NAME;
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME ?? '';

/**
 * Sinh URL ảnh QR đã điền sẵn số tiền + nội dung chứa mã booking để đối soát.
 * VD nội dung: "LS260701 thanh toan" → sau sao kê tìm mã là ra đơn.
 */
export function vietQrUrl(amount: number, bookingCode: string): string {
  const addInfo = encodeURIComponent(`${bookingCode} thanh toan`);
  const accountName = encodeURIComponent(NAME);
  return (
    `https://img.vietqr.io/image/${BIN}-${STK}-compact2.png` +
    `?amount=${Math.round(amount)}&addInfo=${addInfo}&accountName=${accountName}`
  );
}

export const bankConfigured = Boolean(BIN && STK);

export const bankInfo = {
  bin: BIN,
  account: STK,
  name: NAME, // cho QR (không dấu)
  nameDisplay: NAME_DISPLAY, // cho tin nhắn (có dấu)
  bankName: BANK_NAME, // vd "TP BANK - Ngân hàng Tiên Phong"
};
