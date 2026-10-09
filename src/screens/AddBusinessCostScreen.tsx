import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, DateField, Segmented, TextField } from '@/components/Fields';
import { Note } from '@/components/Rows';
import { BillingCycle, BusinessCostCategory } from '@/domain/ledger-types';
import { monthlyEquivalent } from '@/domain/subscriptions';
import { formatMoney } from '@/lib/format';
import { recordBusinessCost } from '@/features/business/business-actions';
import { useApp } from '@/state/AppState';

const CATEGORIES = [
  { value: 'subscription', label: 'Subscription' }, { value: 'tools', label: 'Tools' },
  { value: 'tax', label: 'Tax' }, { value: 'other', label: 'Other' },
] as const;
const CYCLES = [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }] as const;

function spreadHint(amount: number | null, cycle: BillingCycle | null): string | undefined {
  if (!amount || cycle !== 'yearly') return undefined;
  return `Spread over 12 months: about ${formatMoney(monthlyEquivalent('yearly', amount))} counts against each month's income.`;
}

export function AddBusinessCostScreen() {
  const { act, today } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<BusinessCostCategory | null>(null);
  const [cycle, setCycle] = useState<BillingCycle | null>(null);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(today);
  const isSubscription = category === 'subscription';
  return (
    <FormFrame
      title="Business cost"
      subtitle="Paid from your Pool, before your salary."
      submitLabel="Save cost"
      disabled={!amount || !category || (isSubscription && !cycle)}
      onSubmit={() => act((ctx) => recordBusinessCost(ctx, {
        amount: amount!, category: category!, date,
        ...(isSubscription ? { billingCycle: cycle! } : {}), ...(label.trim() ? { label: label.trim() } : {}),
      }))}
    >
      <AmountField label="Amount" value={amount} onChange={setAmount} large autoFocus />
      <Segmented label="What is it?" options={CATEGORIES} value={category} onChange={setCategory} />
      {isSubscription ? (
        <>
          <Segmented label="How often is it billed?" options={CYCLES} value={cycle} onChange={setCycle} hint={spreadHint(amount, cycle)} />
          <TextField label="Name (optional)" value={label} onChangeText={setLabel} placeholder="Figma, hosting…" />
        </>
      ) : null}
      <DateField label="Date" value={date} onChange={setDate} max={today} />
      <Note>Yearly subscriptions are spread over 12 months so one big bill doesn't look like a bad month.</Note>
    </FormFrame>
  );
}
