import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField } from '@/components/Fields';
import { Note } from '@/components/Rows';
import { formatMoney } from '@/lib/format';
import { paySalary } from '@/features/salary/salary-actions';
import { useApp } from '@/state/AppState';

export function PaySalaryScreen() {
  const { act, dashboard } = useApp();
  const salary = dashboard?.salary;
  const [amount, setAmount] = useState<number | null>(salary?.payableNow ?? null);
  return (
    <FormFrame
      title="Pay salary"
      subtitle="Moves money from your Pool to Available Spending. Vanea only records it: move the real money yourself."
      submitLabel="Pay salary"
      disabled={!amount}
      onSubmit={() => act((ctx) => paySalary(ctx, { amount: amount! }))}
    >
      <AmountField label="Amount" value={amount} onChange={setAmount} large
        {...(salary ? { hint: `Left this period: ${formatMoney(salary.remaining)}. Your Pool can pay ${formatMoney(salary.payableNow)} now.` } : {})} />
      {salary && salary.withheld > 0 ? <Note>{formatMoney(salary.withheld)} of this is withheld to repay your salary advance.</Note> : null}
    </FormFrame>
  );
}
