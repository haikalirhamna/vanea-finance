/** A loan with the cost of borrowing shown before saving (PRD DEBT-4). */
import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, DateField, Segmented, TextField } from '@/components/Fields';
import { KeyValue, Note } from '@/components/Rows';
import { LoanPurpose, LoanFrequency } from '@/domain/installment-loans';
import { LoanType } from '@/data/debts';
import { formatMoney, formatPercent } from '@/lib/format';
import { addLoan } from '@/features/debts/debts-actions';
import { previewLoan } from '@/features/debts/loan-preview';
import { useApp } from '@/state/AppState';

const PURPOSES = [{ value: 'personal', label: 'Personal' }, { value: 'business', label: 'Business' }] as const;
const FREQUENCIES = [{ value: 'monthly', label: 'Monthly' }, { value: 'single', label: 'One payment' }] as const;
const USES = [{ value: 'cash', label: 'Cash received' }, { value: 'purchase', label: 'A purchase' }] as const;

function CostPreview({ received, installment, count, frequency, start, first }: {
  received: number | null; installment: number | null; count: number; frequency: LoanFrequency; start: string; first: string;
}) {
  if (!received || !installment || !count) return null;
  const result = previewLoan({ received, installmentAmount: installment, installmentCount: count, frequency, startDate: start, firstDueDate: first });
  if (!result.ok) return <Note tone="caution">{result.error.title}. {result.error.what}</Note>;
  const { totalToRepay, cost, yearlyRate } = result.preview;
  return (
    <>
      <KeyValue label="You will repay" value={formatMoney(totalToRepay)} strong />
      <KeyValue label="Cost of borrowing" value={formatMoney(cost)} />
      <KeyValue label="About per year" value={formatPercent(yearlyRate)} />
    </>
  );
}

interface Fields {
  name: string;
  purpose: LoanPurpose | null;
  use: 'cash' | 'purchase' | null;
  received: number | null;
  installment: number | null;
  count: string;
  frequency: LoanFrequency | null;
  first: string;
}

function installmentCount(fields: Fields): number {
  return fields.frequency === 'single' ? 1 : Number.parseInt(fields.count, 10) || 0;
}

function isReady(fields: Fields): boolean {
  const { name, purpose, use, received, installment, frequency } = fields;
  const useKnown = purpose === 'business' || use !== null;
  return !!(name.trim() && purpose && useKnown && received && installment && frequency && installmentCount(fields));
}

function loanTypeOf(fields: Fields): LoanType {
  return fields.use === 'purchase' && fields.purpose === 'personal' ? 'installment_purchase' : 'online_loan';
}

export function AddLoanScreen() {
  const { act, today } = useApp();
  const [fields, setFields] = useState<Fields>({ name: '', purpose: null, use: null, received: null, installment: null, count: '', frequency: null, first: today });
  const set = <K extends keyof Fields>(key: K) => (value: Fields[K]) => setFields((current) => ({ ...current, [key]: value }));
  const { purpose, use, received, installment, frequency } = fields;
  const total = installmentCount(fields);
  return (
    <FormFrame
      title="Add loan"
      subtitle="Money you borrow is not income."
      submitLabel="Save loan"
      disabled={!isReady(fields)}
      onSubmit={() => act((ctx) => addLoan(ctx, {
        name: fields.name, type: loanTypeOf(fields), purpose: purpose!, use: purpose === 'business' ? 'cash' : use!, received: received!,
        installmentAmount: installment!, installmentCount: total, frequency: frequency!, firstDueDate: fields.first,
      }))}
    >
      <TextField label="Lender" value={fields.name} onChangeText={set('name')} placeholder="Kredivo, bank…" />
      <Segmented label="What is it for?" options={PURPOSES} value={purpose} onChange={set('purpose')} />
      {purpose === 'personal' ? <Segmented label="What did you get?" options={USES} value={use} onChange={set('use')}
        hint="A purchase is paid for in installments: nothing comes in as cash." /> : null}
      <AmountField label={use === 'purchase' ? 'Price of the purchase' : 'Amount received'} value={received} onChange={set('received')} />
      <Segmented label="How is it repaid?" options={FREQUENCIES} value={frequency} onChange={set('frequency')} />
      <AmountField label={frequency === 'single' ? 'Total to repay' : 'Installment'} value={installment} onChange={set('installment')} />
      {frequency === 'monthly' ? <TextField label="Number of installments" value={fields.count} onChangeText={set('count')} keyboardType="number-pad" /> : null}
      <DateField label="First payment due" value={fields.first} onChange={set('first')} min={today} />
      <CostPreview received={received} installment={installment} count={total} frequency={frequency ?? 'monthly'} start={today} first={fields.first} />
    </FormFrame>
  );
}
