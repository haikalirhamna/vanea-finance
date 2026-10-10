/** Move money out of the Pool. Above the safe surplus it shows the runway first and still allows it. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PrimaryPill } from '@/components/Buttons';
import { AmountField, Segmented } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Note } from '@/components/Rows';
import { space } from '@/components/theme';
import { ExplainedError } from '@/features/errors';
import { SurplusTarget, allocateSurplus, runwayAfterMove, surplusView } from '@/features/savings/savings-actions';
import { formatMoney, formatMonthsCount } from '@/lib/format';
import { useApp } from '@/state/AppState';

function destinationsOf(): { value: string; label: string }[] {
  return [{ value: 'savings', label: 'Savings' }];
}

function targetOf(choice: string): SurplusTarget {
  return choice === 'savings' ? { to: 'savings' } : { to: 'investment', holdingId: choice };
}

export function PoolMoveForm() {
  const { act, snapshot, today } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const view = surplusView(snapshot, today);
  const above = amount !== null && amount > view.safe;
  const after = amount ? runwayAfterMove(snapshot, today, amount) : null;
  const save = async () => {
    const result = await act((ctx) => allocateSurplus(ctx, { amount: amount!, target: targetOf(choice!) }));
    if (result.ok) { setDone(`Moved ${formatMoney(amount!)}.`); setAmount(null); setError(null); } else setError(result.error);
  };
  return (
    <View style={styles.form}>
      <AmountField label="Move out of the Pool" value={amount} onChange={setAmount} />
      <Segmented label="To" options={destinationsOf()} value={choice} onChange={setChoice} />
      {above && after !== null ? <Note tone="caution">{`That is more than your safe surplus. Your Pool would then cover ${formatMonthsCount(after)}.`}</Note> : null}
      {error ? <ErrorNotice error={error} /> : null}
      {done ? <Note>{done}</Note> : null}
      <PrimaryPill label="Move" onPress={save} disabled={!amount || !choice} />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: space.lg, marginTop: space.lg } });
