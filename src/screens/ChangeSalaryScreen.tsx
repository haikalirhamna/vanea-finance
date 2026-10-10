/** Decrease the salary, or return to a salary you paid yourself in the last 12 months (PRD SAL-6, SAL-7). */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, Segmented } from '@/components/Fields';
import { KeyValue, Note } from '@/components/Rows';
import { decreaseSalary, restoreSalary } from '@/features/salary/salary-review-actions';
import { previewSalaryChange, salaryOptions } from '@/features/salary/salary-review';
import { formatMoney, formatMonth, formatMonthsCount } from '@/lib/format';
import { useApp } from '@/state/AppState';

type Direction = 'decrease' | 'restore';

function Impact({ amount }: { amount: number }) {
  const { snapshot, today } = useApp();
  const preview = previewSalaryChange(snapshot, today, amount);
  const runway = (months: number | null) => (months === null ? 'not limited' : formatMonthsCount(months));
  return (
    <>
      <KeyValue label="Pool lasts now" value={runway(preview.runwayBefore)} />
      <KeyValue label="Pool would last" value={runway(preview.runwayAfter)} strong />
      <KeyValue label="Monthly commitments" value={formatMoney(preview.monthlyCommitmentAfter)} />
    </>
  );
}

function directionOptions(restoreTo: number | null): { value: Direction; label: string }[] {
  const decrease = { value: 'decrease' as const, label: 'Decrease' };
  return restoreTo ? [decrease, { value: 'restore' as const, label: 'Return' }] : [decrease];
}

const parseAmount = (text: string | undefined): number | null => (text ? Number.parseInt(text, 10) || null : null);

export function ChangeSalaryScreen() {
  const { amount: suggested } = useLocalSearchParams<{ amount?: string }>();
  const { act, snapshot, today } = useApp();
  const { salary, restoreTo, period } = salaryOptions(snapshot, today);
  const [direction, setDirection] = useState<Direction | null>(restoreTo ? null : 'decrease');
  const [amount, setAmount] = useState<number | null>(parseAmount(suggested));
  const options = directionOptions(restoreTo);
  return (
    <FormFrame
      title="Change salary"
      subtitle={`Applies from the ${formatMonth(period)} salary. Vanea never changes it for you.`}
      submitLabel={direction === 'restore' ? 'Return to this salary' : 'Decrease salary'}
      disabled={!amount || !direction}
      onSubmit={() => act((ctx) => (direction === 'restore' ? restoreSalary(ctx, { amount: amount! }) : decreaseSalary(ctx, { amount: amount! })))}
    >
      <KeyValue label="Current salary" value={formatMoney(salary ?? 0)} />
      {restoreTo ? <Note>{`You can return to ${formatMoney(restoreTo)} at any time: you paid yourself that in the last 12 months.`}</Note> : null}
      {restoreTo ? <Segmented label="What do you want to do?" options={options} value={direction} onChange={setDirection} /> : null}
      <AmountField label="New salary" value={amount} onChange={setAmount} large />
      {amount ? <Impact amount={amount} /> : null}
    </FormFrame>
  );
}
