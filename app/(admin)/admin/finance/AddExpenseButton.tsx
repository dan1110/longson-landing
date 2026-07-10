'use client';

import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { ExpenseForm } from './ExpenseForm';

export function AddExpenseButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl px-3 py-2.5 text-[13px] font-semibold bg-[var(--brick)] text-white active:scale-[.98] hover:brightness-105 transition flex items-center gap-1.5"
      >
        <Icon name="plus" className="w-4 h-4" /> Ghi chi
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ghi khoản chi">
        <ExpenseForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
