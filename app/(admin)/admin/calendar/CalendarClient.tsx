'use client';

// Tab Lịch admin: lịch tháng (MonthCalendar) + CRUD đơn + ghi chú + CRM khách.
import { useMemo, useRef, useState } from 'react';
import type { BookingFull, Customer, Home, MessageTemplate, Profile, Unit } from '@/lib/database.types';
import { isRevenue } from '@/lib/booking';
import { MonthCalendar } from '@/components/MonthCalendar';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { BookingForm } from '@/components/BookingForm';
import { BookingDetail } from '@/components/BookingDetail';
import { toast } from '@/components/Toast';
import { deleteBooking, updateBookingNote, createHold, releaseHold } from '../actions';

export function CalendarClient({
  units,
  bookings,
  sales,
  homes,
  customers,
  template,
  year,
  month0,
}: {
  units: (Unit & { home?: { name: string } })[];
  bookings: BookingFull[];
  sales: Profile[];
  homes: Home[];
  customers: Customer[];
  template: MessageTemplate;
  year: number;
  month0: number;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingFull | null>(null);
  const [seedUnit, setSeedUnit] = useState<string | undefined>();
  const [seedCheckin, setSeedCheckin] = useState<string | undefined>();
  const [seedCheckout, setSeedCheckout] = useState<string | undefined>();
  const [holdId, setHoldId] = useState<string | undefined>();
  const [creatingHold, setCreatingHold] = useState(false);
  const [detail, setDetail] = useState<BookingFull | null>(null);
  const savedRef = useRef(false);

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const staysByCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookings) {
      if (isRevenue(b.status) && b.customer_id) m.set(b.customer_id, (m.get(b.customer_id) ?? 0) + 1);
    }
    return m;
  }, [bookings]);

  // Bấm chọn ngày trên lịch (đã có unit cụ thể) → GIỮ CHỖ ngay rồi mở form.
  async function openCreate(unitId?: string, checkin?: string, checkout?: string) {
    setEditBooking(null);
    savedRef.current = false;
    setHoldId(undefined);
    setSeedUnit(unitId || undefined);
    setSeedCheckin(checkin);
    setSeedCheckout(checkout);

    if (unitId && checkin && checkout) {
      setCreatingHold(true);
      const res = await createHold(unitId, checkin, checkout);
      setCreatingHold(false);
      if (!res.ok) {
        toast.error(res.error); // ngày vừa có người đặt
        return;
      }
      setHoldId(res.id);
    }
    setFormOpen(true);
  }

  // Đóng form: nếu có giữ chỗ mà chưa lưu → nhả ra.
  function closeForm() {
    setFormOpen(false);
    if (holdId && !savedRef.current) releaseHold(holdId);
    setHoldId(undefined);
  }

  function openEdit(b: BookingFull) {
    setDetail(null);
    setHoldId(undefined);
    savedRef.current = false;
    setEditBooking(b);
    setFormOpen(true);
  }

  const detailHome = detail
    ? homes.find((h) => h.id === detail.unit?.home_id) ?? homes[0]
    : homes[0];
  const detailRefName = detail?.customer?.referred_by
    ? customersById.get(detail.customer.referred_by)?.name ?? null
    : null;

  return (
    <div className="fade-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] lg:text-[22px] font-extrabold tracking-[-0.02em]">Lịch phòng</h1>
          <p className="text-[12.5px] text-[var(--ink-3)]">Chọn phòng · chạm ngày nhận rồi ngày trả để đặt (kể cả tháng sau).</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold bg-[var(--teal)] text-white active:scale-[.98] hover:bg-[var(--teal-d)] transition-colors flex items-center gap-1.5 flex-none"
        >
          <Icon name="plus" className="w-4 h-4" /> Tạo đơn
        </button>
      </div>

      <MonthCalendar
        units={units}
        bookings={bookings}
        initialYear={year}
        initialMonth0={month0}
        onPickBooking={(b) => setDetail(b)}
        onCreateRange={openCreate}
      />

      <Sheet open={formOpen} onClose={closeForm} title={editBooking ? 'Sửa đơn' : holdId ? 'Chốt đơn (đã giữ chỗ)' : 'Tạo đơn mới'}>
        <BookingForm
          units={units}
          sales={sales}
          homes={homes}
          template={template}
          booking={editBooking ?? undefined}
          initialUnitId={seedUnit}
          initialCheckin={seedCheckin}
          initialCheckout={seedCheckout}
          holdId={holdId}
          onSaved={() => { savedRef.current = true; }}
          onDone={closeForm}
        />
      </Sheet>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title="Chi tiết đơn">
        {detail && (
          <BookingDetail
            booking={detail}
            home={detailHome}
            template={template}
            admin
            timesStayed={staysByCustomer.get(detail.customer_id) ?? 1}
            referredByName={detailRefName}
            onEdit={() => openEdit(detail)}
            onDelete={async () => {
              await deleteBooking(detail.id);
              setDetail(null);
            }}
            onSaveNote={async (note) => {
              await updateBookingNote(detail.id, note);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
