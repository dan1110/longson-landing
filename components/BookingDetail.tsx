'use client';

// Chi tiết booking: Copy tin nhắn (mục 11), QR cọc & còn lại (mục 12),
// lịch sử thanh toán. Dùng cho cả admin & sale.
import { useState, useTransition } from 'react';
import type { BookingFull, Home, MessageTemplate } from '@/lib/database.types';
import { buildMessageVars, renderTemplate } from '@/lib/message';
import { bankConfigured } from '@/lib/vietqr';
import { downloadConfirmCard } from '@/lib/confirmCard';
import { paid, remaining, depositOf, STATUS_LABEL, CATEGORY_LABEL } from '@/lib/booking';
import { money, dmy, dm } from '@/lib/format';
import { Pill } from './ui';
import { Icon } from './Icon';
import { confirmDialog } from './Toast';
import { QrBox } from './QrBox';
import { BookingHistory } from './BookingHistory';
/**
 * Trạng thái admin đổi tay được từ màn chi tiết.
 * Cố ý KHÔNG có 'cancelled' (đã có nút "Hủy đơn" riêng, kèm cảnh báo)
 * và không có 'pending'/'rejected' (thuộc luồng duyệt đơn).
 */
export type EditableStatus = 'confirmed' | 'staying' | 'completed';

const STATUS_CHOICES: { v: EditableStatus; l: string }[] = [
  { v: 'confirmed', l: 'Đã duyệt' },
  { v: 'staying', l: 'Đang ở' },
  { v: 'completed', l: 'Đã trả phòng' },
];

export function BookingDetail({
  booking,
  home,
  template,
  timesStayed = 1,
  referredByName,
  admin = false,
  onEdit,
  onCancel,
  onDelete,
  onSetStatus,
  onSaveNote,
}: {
  booking: BookingFull;
  home?: Home | null;
  template: MessageTemplate;
  timesStayed?: number;
  referredByName?: string | null;
  admin?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onSetStatus?: (status: EditableStatus) => void;
  onSaveNote?: (note: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [dling, setDling] = useState(false);
  const [note, setNote] = useState(booking.note ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, startSaveNote] = useTransition();
  const paidAmount = paid(booking.transactions);
  const owe = remaining(booking, booking.transactions);
  const code = booking.code ?? 'CHUA-DUYET';
  const guests = booking.guests_adult + booking.guests_child;

  // Cọc lấy từ số sale đã chốt với khách (lưu ở đơn). Đơn cũ chưa có thì
  // suy ra từ tiền đã thu — nhưng luôn chặn trần ở tổng tiền, nếu không
  // QR sẽ đòi khách chuyển nhiều hơn giá phòng.
  const deposit = depositOf(booking, booking.transactions);

  const message = renderTemplate(
    template.body,
    // KHÔNG dùng `!`: nhiều đơn import cũ có customer_id trỏ tới khách đã
    // không còn → booking.customer là null. Ép kiểu ở đây từng làm crash
    // trắng trang khi admin mở chi tiết những đơn đó.
    buildMessageVars({
      booking,
      customer: booking.customer,
      unit: booking.unit,
      home,
      depositAmount: deposit,
    }),
  );

  async function copyMsg() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareZalo() {
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
      } catch {
        /* người dùng hủy */
      }
    } else {
      copyMsg();
    }
  }

  async function downloadCard() {
    setDling(true);
    try {
      await downloadConfirmCard({
        code,
        customerName: booking.customer?.name ?? '',
        homeName: home?.name ?? '',
        unitName: booking.unit?.name ?? '',
        checkin: booking.checkin_date,
        checkout: booking.checkout_date,
        nights: booking.nights,
        total: Number(booking.total_amount),
        deposit,
      });
    } finally {
      setDling(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="text-[15px]">
            {booking.customer?.name ?? (
              <span className="text-[var(--ink-3)] font-semibold">Khách chưa có tên</span>
            )}
          </b>
          <div className="text-[11.5px] text-[var(--ink-3)] mt-0.5 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Icon name="users" className="w-3.5 h-3.5" /> {guests} khách
              {booking.customer?.phone && (
                <>
                  <span className="text-[var(--line)]">·</span>
                  <span className="mono">{booking.customer.phone}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="calendar" className="w-3.5 h-3.5" />
              {booking.unit?.name} · {dm(booking.checkin_date)} → {dm(booking.checkout_date)} · {booking.nights} đêm
            </div>
          </div>
        </div>
        {booking.status === 'pending' ? (
          <Pill tone="pend">{STATUS_LABEL[booking.status]}</Pill>
        ) : owe > 0 ? (
          <Pill tone="owe">còn {money(owe)}</Pill>
        ) : (
          <Pill tone="ok">đã đủ</Pill>
        )}
      </div>

      {/* CRM: khách quay lại / được giới thiệu */}
      {(timesStayed > 1 || referredByName) && (
        <div className="flex flex-wrap gap-1.5">
          {timesStayed > 1 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--teal)]/10 text-[var(--teal-d)]">
              <Icon name="check" className="w-3.5 h-3.5" /> Khách quay lại · lần thứ {timesStayed}
            </span>
          )}
          {referredByName && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fbeed6] text-[var(--pend-ink)]">
              <Icon name="share" className="w-3.5 h-3.5" /> Giới thiệu bởi {referredByName}
            </span>
          )}
        </div>
      )}

      {/* Tổng tiền tách bạch */}
      <div className="grid grid-cols-3 gap-2 text-center bg-white border border-[var(--line)] rounded-[12px] p-3">
        <div>
          <div className="mono text-sm font-bold">{money(booking.total_amount)}</div>
          <div className="text-[10px] text-[var(--ink-3)]">Tổng tiền</div>
        </div>
        <div>
          <div className="mono text-sm font-bold text-[var(--teal-d)]">{money(paidAmount)}</div>
          <div className="text-[10px] text-[var(--ink-3)]">Đã thu</div>
        </div>
        <div>
          <div className="mono text-sm font-bold text-[var(--tape-ink)]">{money(owe)}</div>
          <div className="text-[10px] text-[var(--ink-3)]">Còn lại</div>
        </div>
      </div>

      {/* Hoa hồng sale (nếu có sale phụ trách) */}
      {booking.sale && (
        <div className="flex items-center justify-between bg-[var(--teal)]/[0.06] border border-[var(--free-line)] rounded-xl px-3 py-2.5">
          <span className="text-[12.5px] text-[var(--teal-d)] font-semibold flex items-center gap-1.5">
            <Icon name="commission" className="w-4 h-4" />
            Hoa hồng · {booking.sale.name} ({Math.round((Number(booking.sale.commission_rate) || 0.1) * 100)}%)
          </span>
          <span className="mono text-[14px] font-bold text-[var(--teal-d)]">
            {money(Math.round(Number(booking.total_amount) * (Number(booking.sale.commission_rate) || 0.1)))} ₫
          </span>
        </div>
      )}

      {/* Copy tin nhắn */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copyMsg}
          className="rounded-xl py-3 text-sm font-bold bg-[var(--teal)] text-white active:scale-[.98] flex items-center justify-center gap-2 transition-colors hover:bg-[var(--teal-d)]"
        >
          <Icon name={copied ? 'check' : 'copy'} className="w-4 h-4" />
          {copied ? 'Đã copy' : 'Copy tin nhắn'}
        </button>
        <button
          onClick={shareZalo}
          className="rounded-xl py-3 text-sm font-bold bg-white border-[1.5px] border-[var(--line)] active:scale-[.98] flex items-center justify-center gap-2 hover:bg-[var(--paper)] transition-colors"
        >
          <Icon name="share" className="w-4 h-4" />
          Chia sẻ Zalo
        </button>
      </div>

      {/* Xem trước tin nhắn */}
      <details className="bg-white border border-[var(--line)] rounded-[12px] p-3">
        <summary className="text-xs font-bold text-[var(--ink-3)] cursor-pointer">
          Xem trước tin nhắn
        </summary>
        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed mt-2 font-sans">{message}</pre>
      </details>

      {/* QR thu tiền */}
      {bankConfigured ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <QrBox label="QR cọc" amount={deposit} code={code} filename="QR-coc" />
            <QrBox
              label="QR còn lại"
              amount={owe > 0 ? owe : booking.total_amount}
              code={code}
              filename="QR-conlai"
            />
          </div>
          <button
            onClick={downloadCard}
            disabled={dling}
            className="w-full rounded-xl py-3 text-sm font-bold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Icon name="download" className="w-4 h-4" />
            {dling ? 'Đang tạo ảnh…' : 'Tải ảnh xác nhận (kèm QR)'}
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--pend-ink)] bg-[var(--pend)] rounded-lg px-3 py-2">
          Chưa cấu hình ngân hàng cho QR. Điền NEXT_PUBLIC_BANK_* trong .env để bật.
        </p>
      )}

      {/* Lịch sử thanh toán */}
      <div className="bg-white border border-[var(--line)] rounded-[12px] p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-1.5">
          Lịch sử thu tiền
        </div>
        {booking.transactions && booking.transactions.filter((t) => t.type === 'income').length > 0 ? (
          <div className="divide-y divide-[var(--line)]">
            {booking.transactions
              .filter((t) => t.type === 'income')
              .map((t) => (
                <div key={t.id} className="flex justify-between py-1.5 text-[12px]">
                  <span>
                    {CATEGORY_LABEL[t.category ?? ''] ?? t.category ?? 'Thu'} · {dmy(t.paid_at)}
                  </span>
                  <span className="mono font-bold text-[var(--teal-d)]">+{money(t.amount)}</span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--ink-3)]">Chưa có khoản thu nào.</p>
        )}
      </div>

      {/* Đổi trạng thái nhanh (admin) */}
      {admin && onSetStatus && (
        <div className="bg-white border border-[var(--line)] rounded-[12px] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-2">
            Trạng thái · hiện tại: {STATUS_LABEL[booking.status]}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHOICES.filter((s) => s.v !== booking.status).map((s) => (
              <button
                key={s.v}
                onClick={() => onSetStatus(s.v)}
                className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold bg-[var(--paper)] border border-[var(--line)] hover:bg-white transition-colors"
              >
                {s.l}
              </button>
            ))}
          </div>
          {booking.status === 'cancelled' && (
            <p className="text-[11.5px] text-[var(--ink-3)] mt-2">
              Đơn đã hủy không khóa ngày. Khôi phục lại sẽ báo lỗi nếu trong lúc đó
              đã có đơn khác đặt trùng ngày.
            </p>
          )}
        </div>
      )}

      {/* Ghi chú (admin sửa được) */}
      {admin && (
        <div className="bg-white border border-[var(--line)] rounded-[12px] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)] mb-1.5">
            Ghi chú
          </div>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteSaved(false);
            }}
            placeholder="VD: khách quen, xin nhận sớm, đã cọc tiền mặt…"
            className="w-full p-2.5 border-[1.5px] border-[var(--line)] rounded-lg text-[14px] min-h-[60px] focus:outline-none focus:border-[var(--teal)]"
          />
          {onSaveNote && (
            <button
              onClick={() =>
                startSaveNote(async () => {
                  await onSaveNote(note);
                  setNoteSaved(true);
                })
              }
              disabled={savingNote}
              className="mt-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-[var(--paper)] border border-[var(--line)] hover:bg-white transition-colors disabled:opacity-50"
            >
              {savingNote ? 'Đang lưu…' : noteSaved ? '✓ Đã lưu ghi chú' : 'Lưu ghi chú'}
            </button>
          )}
        </div>
      )}

      {/* Lịch sử sửa đơn (admin) */}
      {admin && <BookingHistory bookingId={booking.id} />}

      {/* CRUD: Sửa / Hủy / Xóa (admin) */}
      {admin && (onEdit || onCancel || onDelete) && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded-xl py-3 text-sm font-semibold bg-white border-[1.5px] border-[var(--line)] hover:bg-[var(--paper)] transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="settings" className="w-4 h-4" /> Sửa đơn
              </button>
            )}
            {/* Khách hủy → giữ lịch sử, chỉ nhả ngày. Đây là nút nên dùng. */}
            {onCancel && booking.status !== 'cancelled' && (
              <button
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Hủy đơn này?',
                      message:
                        'Ngày sẽ được nhả ra cho khách khác đặt. Đơn vẫn được lưu lại trong sổ để đối soát tiền cọc đã thu.',
                      confirmText: 'Hủy đơn',
                      danger: true,
                    })
                  )
                    onCancel();
                }}
                className="rounded-xl py-3 text-sm font-semibold bg-white border-[1.5px] border-[var(--pend-line)] text-[var(--pend-ink)] hover:bg-[#fdf8ef] transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="x" className="w-4 h-4" /> Hủy đơn
              </button>
            )}
          </div>

          {/* Xóa hẳn: chỉ cho đơn nhập nhầm. Để riêng, chữ nhỏ, tránh bấm nhầm. */}
          {onDelete && (
            <button
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Xóa hẳn đơn này?',
                    message:
                      paidAmount > 0
                        ? `Đơn này đã ghi nhận ${money(paidAmount)} đ tiền thu. Xóa hẳn sẽ làm sai sổ thu chi — hãy dùng "Hủy đơn" nếu khách hủy thật.`
                        : 'Chỉ dùng khi nhập nhầm. Đơn sẽ biến mất vĩnh viễn, không khôi phục được.',
                    confirmText: 'Xóa vĩnh viễn',
                    danger: true,
                  })
                )
                  onDelete();
              }}
              className="w-full rounded-xl py-2.5 text-[12.5px] font-semibold bg-transparent text-[var(--tape-ink)] hover:bg-[#fdf3f1] transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="trash" className="w-3.5 h-3.5" /> Xóa hẳn (nhập nhầm)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
