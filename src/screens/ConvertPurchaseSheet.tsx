/** Convert a purchase on a credit line into installments, with the cost shown first (USER-FLOWS §22.1). */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryPill } from '@/components/Buttons';
import { AmountField, DateField, Segmented, TextField } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { KeyValue, Note } from '@/components/Rows';
import { space } from '@/components/theme';
import { convertPurchase, convertiblePurchases } from '@/features/debts/conversion-actions';
import { previewLoan } from '@/features/debts/loan-preview';
import { ExplainedError } from '@/features/errors';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { useApp } from '@/state/AppState';

function Preview({ price, installment, count, today, first }: { price: number; installment: number | null; count: number; today: string; first: string }) {
  if (!installment || !count) return null;
  const result = previewLoan({ received: price, installmentAmount: installment, installmentCount: count, frequency: 'monthly', startDate: today, firstDueDate: first });
  if (!result.ok) return <Note tone="caution">{`${result.error.title}. ${result.error.what}`}</Note>;
  return (
    <>
      <KeyValue label="You will repay" value={formatMoney(result.preview.totalToRepay)} strong />
      <KeyValue label="Cost of borrowing" value={formatMoney(result.preview.cost)} />
      <KeyValue label="About per year" value={formatPercent(result.preview.yearlyRate)} />
    </>
  );
}

function Form({ debtId, onDone }: { debtId: string; onDone: () => void }) {
  const { snapshot, today, act } = useApp();
  const purchases = convertiblePurchases(snapshot.transactions, debtId);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [installment, setInstallment] = useState<number | null>(null);
  const [count, setCount] = useState('');
  const [first, setFirst] = useState(today);
  const [error, setError] = useState<ExplainedError | null>(null);
  const purchase = purchases.find((p) => p.id === purchaseId);
  const periods = Number.parseInt(count, 10) || 0;
  const options = purchases.map((p) => ({ value: p.id, label: `${p.note ?? 'Purchase'} · ${formatMoney(p.amount)} · ${formatDate(p.date)}` }));
  const save = async () => {
    const result = await act((ctx) => convertPurchase(ctx, { debtId, purchaseId: purchaseId!, installmentAmount: installment!, installmentCount: periods, firstDueDate: first }));
    if (result.ok) onDone(); else setError(result.error);
  };
  if (purchases.length === 0) return <Note>There are no purchases on this line to convert.</Note>;
  return (
    <View style={styles.form}>
      <Segmented label="Which purchase?" options={options} value={purchaseId} onChange={setPurchaseId} />
      <AmountField label="Installment" value={installment} onChange={setInstallment} />
      <TextField label="Number of installments" value={count} onChangeText={setCount} keyboardType="number-pad" />
      <DateField label="First payment due" value={first} onChange={setFirst} min={today} />
      {purchase ? <Preview price={purchase.amount} installment={installment} count={periods} today={today} first={first} /> : null}
      <Note>The reserved money returns to Available Spending. The expense keeps its full price in its month.</Note>
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label="Convert" onPress={save} disabled={!purchase || !installment || !periods} />
    </View>
  );
}

export function ConvertPurchaseSheet({ debtId, visible, onClose }: { debtId: string; visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Convert to installments">
      {visible ? <Form debtId={debtId} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ form: { gap: space.lg, paddingBottom: space.xl } });
