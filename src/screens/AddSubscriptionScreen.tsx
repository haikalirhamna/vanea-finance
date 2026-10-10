import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, DateField, Segmented, TextField } from '@/components/Fields';
import { Note } from '@/components/Rows';
import { BillingCycle } from '@/domain/ledger-types';
import { monthlyEquivalent } from '@/domain/subscriptions';
import { addSubscription } from '@/features/subscriptions/subscription-actions';
import { formatMoney } from '@/lib/format';
import { useApp } from '@/state/AppState';

const CYCLES = [{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }] as const;

export function AddSubscriptionScreen() {
  const { act, today } = useApp();
  const [name, setName] = useState('');
  const [cycle, setCycle] = useState<BillingCycle | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [next, setNext] = useState(today);
  const perMonth = price && cycle === 'yearly' ? `That counts as about ${formatMoney(monthlyEquivalent('yearly', price))} each month.` : undefined;
  return (
    <FormFrame
      title="Add subscription"
      subtitle="Paid from your income, so it counts against your Pool."
      submitLabel="Save subscription"
      disabled={!name.trim() || !cycle || !price}
      onSubmit={() => act((ctx) => addSubscription(ctx, { name, cycle: cycle!, price: price!, nextBillingDate: next }))}
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Figma, hosting…" />
      <Segmented label="How often is it billed?" options={CYCLES} value={cycle} onChange={setCycle} {...(perMonth ? { hint: perMonth } : {})} />
      <AmountField label="Price" value={price} onChange={setPrice} large />
      <DateField label="Next billing date" value={next} onChange={setNext} />
      <Note>Vanea reminds you on the billing date. Nothing is recorded until you confirm.</Note>
    </FormFrame>
  );
}
