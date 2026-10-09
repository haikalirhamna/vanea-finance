import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, DateField, Segmented, TextField } from '@/components/Fields';
import { Note } from '@/components/Rows';
import { ExpenseCategory } from '@/domain/ledger-types';
import { recordExpense } from '@/features/spending/spending-actions';
import { useApp } from '@/state/AppState';

const CATEGORIES = [
  { value: 'needs', label: 'Needs' }, { value: 'wants', label: 'Wants' },
  { value: 'growth', label: 'Growth' }, { value: 'unexpected', label: 'Unexpected' },
] as const;

const AVAILABLE = 'available';

export function AddExpenseScreen() {
  const { act, today, snapshot } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<string>(AVAILABLE);
  const lines = snapshot.debts.filter((debt) => debt.kind === 'credit_line' && debt.status === 'open');
  const methods = [{ value: AVAILABLE, label: 'Available' }, ...lines.map((line) => ({ value: line.id, label: line.name }))];
  return (
    <FormFrame
      title="Add expense"
      subtitle="Spending is never blocked: Vanea just shows where you stand."
      submitLabel="Save expense"
      disabled={!amount || !category}
      onSubmit={() => act((ctx) => recordExpense(ctx, {
        amount: amount!, category: category!, date, ...(note.trim() ? { note: note.trim() } : {}),
        ...(method !== AVAILABLE ? { creditLineId: method } : {}),
      }))}
    >
      <AmountField label="Amount" value={amount} onChange={setAmount} large autoFocus />
      <Segmented label="What kind of spending is it?" options={CATEGORIES} value={category} onChange={setCategory} />
      {lines.length > 0 ? (
        <Segmented label="Paid with" options={methods} value={method} onChange={setMethod}
          hint={method === AVAILABLE ? undefined : 'Not taken from Available Spending now. It is added to what you owe on this line.'} />
      ) : null}
      <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Lunch, parking…" />
      <DateField label="Date" value={date} onChange={setDate} max={today} />
      <Note>Needs, wants, growth and unexpected are for your monthly reflection.</Note>
    </FormFrame>
  );
}
