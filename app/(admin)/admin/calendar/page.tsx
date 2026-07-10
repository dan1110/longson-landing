// Tab Lịch (mục 10). Timeline + CRUD đơn + tin nhắn + QR + CRM khách.
import { createClient } from '@/lib/supabase/server';
import { getUnits, getBookings, getSales, getHomes, getCustomers } from '@/lib/queries';
import { CalendarClient } from './CalendarClient';
import type { MessageTemplate } from '@/lib/database.types';

export default async function CalendarPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();

  const supabase = await createClient();
  const [units, bookings, sales, homes, customers, tplRes] = await Promise.all([
    getUnits(),
    getBookings(),
    getSales(),
    getHomes(),
    getCustomers(),
    supabase.from('message_templates').select('*').eq('name', 'confirm').single(),
  ]);

  const template = (tplRes.data as MessageTemplate) ?? {
    id: '',
    name: 'confirm',
    body: '{ten_khach}',
    updated_at: '',
  };

  return (
    <CalendarClient
      units={units}
      bookings={bookings}
      sales={sales}
      homes={homes}
      customers={customers}
      template={template}
      year={year}
      month0={month0}
    />
  );
}
