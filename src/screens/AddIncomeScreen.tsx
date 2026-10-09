import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, DateField, TextField } from '@/components/Fields';
import { Note } from '@/components/Rows';
import { recordIncome } from '@/features/income/income-actions';
import { useApp } from '@/state/AppState';

export function AddIncomeScreen() {
  const { act, today } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  return (
    <FormFrame
      title="Add income"
      subtitle="Money you received goes into your Pool, not straight into spending."
      submitLabel="Save income"
      disabled={!amount}
      onSubmit={() => act((ctx) => recordIncome(ctx, {
        amount: amount!, date, ...(source.trim() ? { source: source.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      }))}
    >
      <AmountField label="Amount received" value={amount} onChange={setAmount} large autoFocus hint="After any business costs you already paid are recorded separately." />
      <TextField label="From (optional)" value={source} onChangeText={setSource} placeholder="Client or project" />
      <DateField label="Date" value={date} onChange={setDate} max={today} />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} />
      <Note>Your salary is what you pay yourself from the Pool on payday.</Note>
    </FormFrame>
  );
}
