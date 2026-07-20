// Vẽ 1 ẢNH XÁC NHẬN đầy đủ (thông tin đặt phòng + QR cọc) rồi tải về, để sale
// lưu và gửi khách trong 1 tấm ảnh. Chạy phía trình duyệt (canvas).
import { money, dmyPad } from './format';
import { clampDeposit } from './booking';
import { bankInfo } from './vietqr';

export interface ConfirmCardInput {
  code: string;
  customerName: string;
  homeName: string;
  unitName: string;
  checkin: string;
  checkout: string;
  nights: number;
  total: number;
  deposit: number;
  /** @deprecated Bỏ qua — "còn lại" luôn tự tính = tổng − cọc (đã chặn trần). */
  remaining?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadConfirmCard(input: ConfirmCardInput): Promise<void> {
  // Chốt lại cọc & còn lại ngay tại đây: ảnh này gửi thẳng cho khách nên
  // không được phép in ra số âm hay QR đòi nhiều hơn tổng tiền, dù người
  // gọi có truyền vào số gì đi nữa.
  const deposit = clampDeposit(input.deposit, input.total);
  const owed = Math.max(0, input.total - deposit);

  const W = 580;
  const H = 780;
  const s = 2; // nét sắc (retina)
  const canvas = document.createElement('canvas');
  canvas.width = W * s;
  canvas.height = H * s;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(s, s);
  const FONT = "'Be Vietnam Pro', system-ui, sans-serif";

  // Nền
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = '#0e8cae';
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText('LONG SƠN HOMESTAY', W / 2, 44);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('XÁC NHẬN ĐẶT PHÒNG', W / 2, 70);

  const PAD = 34;
  let y = 138;
  const row = (label: string, value: string, bold = false, color = '#16202e') => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText(label, PAD, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = `${bold ? '700' : '500'} 15px ${FONT}`;
    ctx.fillText(value, W - PAD, y);
    y += 30;
  };
  const divider = () => {
    ctx.strokeStyle = '#e1e6ea';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 12);
    ctx.lineTo(W - PAD, y - 12);
    ctx.stroke();
    y += 6;
  };

  row('Khách', input.customerName, true);
  row('Phòng', `${input.homeName} · ${input.unitName}`);
  row('Nhận phòng', `14h00 · ${dmyPad(input.checkin)}`);
  row('Trả phòng', `12h00 · ${dmyPad(input.checkout)}`);
  row('Số đêm', `${input.nights} đêm`);
  divider();
  row('Tổng tiền', `${money(input.total)} đ`, true);
  row('Tiền cọc', `${money(deposit)} đ`, true, '#0a6c88');
  row('Còn lại (trả khi nhận phòng)', `${money(owed)} đ`, true, '#b8402f');
  divider();

  // Tiêu đề QR
  ctx.textAlign = 'center';
  ctx.fillStyle = '#16202e';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText('QUÉT QR CHUYỂN TIỀN CỌC', W / 2, y + 10);
  y += 26;

  // QR (lấy qua proxy cùng origin → không bị chặn)
  try {
    const qr = await loadImage(`/api/qr?amount=${deposit}&code=${encodeURIComponent(input.code)}`);
    const size = 230;
    ctx.drawImage(qr, (W - size) / 2, y, size, size);
    y += size + 18;
  } catch {
    y += 20;
  }

  // Thông tin ngân hàng
  ctx.textAlign = 'center';
  ctx.fillStyle = '#16202e';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(bankInfo.nameDisplay, W / 2, y);
  y += 22;
  ctx.font = `500 14px ${FONT}`;
  ctx.fillStyle = '#24344a';
  ctx.fillText(`STK: ${bankInfo.account} · ${bankInfo.bankName}`, W / 2, y);
  y += 22;
  ctx.fillStyle = '#64748b';
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(`Nội dung: ${input.code} thanh toan`, W / 2, y);
  y += 30;

  // Footer
  ctx.fillStyle = '#0a6c88';
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('Cảm ơn gia đình đã chọn Long Sơn Homestay 🌿', W / 2, y);

  // Tải về
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `xac-nhan-${input.code}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      resolve();
    }, 'image/png');
  });
}
