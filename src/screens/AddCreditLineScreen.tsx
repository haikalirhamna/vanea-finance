import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, Segmented, TextField } from '@/components/Fields';
import { CreditLineType } from '@/data/debts';
import { addCreditLine } from '@/features/debts/debts-actions';
import { useApp } from '@/state/AppState';

const TYPES = [{ value: 'paylater', label: 'PayLater' }, { value: 'credit_card', label: 'Credit card' }] as const;

const toDay = (text: string): number => Number.parseInt(text, 10);

export function AddCreditLineScreen() {
  const { act } = useApp();
  const [type, setType] = useState<CreditLineType | null>(null);
  const [name, setName] = useState('');
  const [statement, setStatement] = useState('');
  const [due, setDue] = useState('');
  const [limit, setLimit] = useState<number | null>(null);
  return (
    <FormFrame
      title="Add credit line"
      subtitle="Purchases on it are added to what you owe, not taken from Available Spending."
      submitLabel="Save"
      disabled={!type || !name.trim() || !toDay(statement) || !toDay(due)}
      onSubmit={() => act((ctx) => addCreditLine(ctx, {
        name, type: type!, statementDay: toDay(statement), dueDay: toDay(due), ...(limit ? { creditLimit: limit } : {}),
      }))}
    >
      <Segmented label="What is it?" options={TYPES} value={type} onChange={setType} />
      <TextField label="Name" value={name} onChangeText={setName} placeholder="ShopeePayLater, BCA card…" />
      <TextField label="Statement day (1–31)" value={statement} onChangeText={setStatement} keyboardType="number-pad" hint="The day your bill is made." />
      <TextField label="Due day (1–31)" value={due} onChangeText={setDue} keyboardType="number-pad" hint="The day it has to be paid." />
      <AmountField label="Limit (optional)" value={limit} onChange={setLimit} />
    </FormFrame>
  );
}
