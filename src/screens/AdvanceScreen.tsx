/** Take a salary advance, or repay one early (USER-FLOWS §11). */
import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, Segmented } from '@/components/Fields';
import { KeyValue, Note } from '@/components/Rows';
import { installmentFor } from '@/domain/salary-advance';
import { createAdvance, repayAdvanceEarly } from '@/features/salary/advance-actions';
import { formatMoney } from '@/lib/format';
import { useApp } from '@/state/AppState';

const TERMS = ['1', '2', '3', '4', '5', '6'].map((value) => ({ value, label: value }));

function Create() {
  const { act } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [term, setTerm] = useState<string | null>('3');
  const periods = Number.parseInt(term ?? '0', 10);
  return (
    <FormFrame
      title="Salary advance"
      subtitle="Take some of your Pool now and repay it from your next salaries."
      submitLabel="Take advance"
      disabled={!amount || !periods}
      onSubmit={() => act((ctx) => createAdvance(ctx, { amount: amount!, termPeriods: periods }))}
    >
      <AmountField label="Amount" value={amount} onChange={setAmount} large />
      <Segmented label="Repay over how many salaries?" options={TERMS} value={term} onChange={setTerm} />
      {amount && periods ? (
        <Note>{`${formatMoney(amount)} now. Your next ${periods} salar${periods === 1 ? 'y' : 'ies'} will be ${formatMoney(installmentFor(amount, periods))} lower.`}</Note>
      ) : null}
    </FormFrame>
  );
}

function Repay({ outstanding }: { outstanding: number }) {
  const { act } = useApp();
  const [amount, setAmount] = useState<number | null>(outstanding);
  return (
    <FormFrame
      title="Repay early"
      subtitle="The installment stays the same, so the advance finishes sooner."
      submitLabel="Repay"
      disabled={!amount}
      onSubmit={() => act((ctx) => repayAdvanceEarly(ctx, { amount: amount! }))}
    >
      <KeyValue label="You still owe" value={formatMoney(outstanding)} strong />
      <AmountField label="Amount" value={amount} onChange={setAmount} large />
    </FormFrame>
  );
}

export function AdvanceScreen() {
  const { dashboard } = useApp();
  const advance = dashboard?.salary.advance;
  return advance ? <Repay outstanding={advance.outstanding} /> : <Create />;
}
