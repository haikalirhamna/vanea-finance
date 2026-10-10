/** One credit line or loan: what is owed and the few things you do with it. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { IconButton, PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { ConvertPurchaseSheet } from './ConvertPurchaseSheet';
import { AmountField, Segmented } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { KeyValue, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { CreditLine, amountDue, availableCredit, billReserveOf, olderDebt, owedOnLine } from '@/domain/credit-lines';
import { installmentsLeft } from '@/domain/debts';
import { owedOn } from '@/domain/installment-loans';
import { InstallmentLoan } from '@/domain/installment-loans';
import { DebtRecord, creditLinesOf, loansOf } from '@/data/debts';
import { Snapshot } from '@/data/snapshot';
import { ActionResult } from '@/features/action-runtime';
import { ExplainedError } from '@/features/errors';
import { closeCreditLine, payBill, payInstallment, payOffLoan, addDebtCost, DebtCostKind } from '@/features/debts/debts-actions';
import { formatMoney } from '@/lib/format';
import { useApp } from '@/state/AppState';

type Mode = 'bill' | 'installment' | 'payoff' | 'cost';

const SOURCES = [{ value: 'personal', label: 'Available Spending' }, { value: 'pool', label: 'Pool' }] as const;
const COSTS = [{ value: 'interest', label: 'Interest' }, { value: 'fee', label: 'Fee' }, { value: 'late_fee', label: 'Late fee' }] as const;

const TITLES: Record<Mode, string> = { bill: 'Pay bill', installment: 'Pay installment', payoff: 'Pay off', cost: 'Add interest or fee' };

function ActionForm({ mode, debtId, suggested, onDone }: { mode: Mode; debtId: string; suggested: number; onDone: (message?: string) => void }) {
  const { act } = useApp();
  const [amount, setAmount] = useState<number | null>(suggested || null);
  const [source, setSource] = useState<'personal' | 'pool'>('personal');
  const [cost, setCost] = useState<DebtCostKind | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const run = async (): Promise<ActionResult<unknown>> => {
    if (mode === 'bill') return act((ctx) => payBill(ctx, { debtId, amount: amount!, source }));
    if (mode === 'installment') return act((ctx) => payInstallment(ctx, { debtId, amount: amount! }));
    if (mode === 'payoff') return act((ctx) => payOffLoan(ctx, { debtId, paid: amount! }));
    return act((ctx) => addDebtCost(ctx, { debtId, amount: amount!, type: cost! }));
  };
  const submit = async () => {
    const result = await run();
    if (!result.ok) return setError(result.error);
    const saved = mode === 'payoff' ? (result.value as { interestSaved: number }).interestSaved : 0;
    onDone(saved > 0 ? `Paid off. You saved ${formatMoney(saved)} in interest.` : undefined);
  };
  return (
    <View style={styles.form}>
      <AmountField label="Amount" value={amount} onChange={setAmount} />
      {mode === 'bill' ? <Segmented label="Pay from" options={SOURCES} value={source} onChange={setSource} /> : null}
      {mode === 'cost' ? <Segmented label="What is it?" options={COSTS} value={cost} onChange={setCost} /> : null}
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label={TITLES[mode]} onPress={submit} disabled={!amount || (mode === 'cost' && !cost)} />
    </View>
  );
}

function suggestion(mode: Mode, owed: number, billDue: number): number {
  if (mode === 'payoff') return owed;
  return mode === 'bill' ? Math.min(billDue, owed) : 0;
}

function LineFacts({ line }: { line: CreditLine }) {
  const { snapshot, today } = useApp();
  const owed = owedOnLine(snapshot.transactions, line.id);
  const reserve = billReserveOf(snapshot.transactions, line.id);
  const credit = availableCredit(line.limit, owed);
  return (
    <>
      <KeyValue label="Bill due" value={formatMoney(amountDue(snapshot.transactions, line, today))} strong />
      <KeyValue label="Set aside for bills" value={formatMoney(reserve)} />
      <KeyValue label="Older debt" value={formatMoney(olderDebt(owed, reserve))} />
      {credit !== null ? <KeyValue label="Credit left" value={formatMoney(credit)} /> : null}
    </>
  );
}

interface Targets {
  debt: DebtRecord;
  line: CreditLine | undefined;
  loan: InstallmentLoan | undefined;
  owed: number;
}

function Actions({ t, onMode, onClose, onConvert }: { t: Targets; onMode: (mode: Mode) => void; onClose: () => void; onConvert: () => void }) {
  const { line, loan, owed, debt } = t;
  if (debt.status === 'closed') return <Note>This debt is closed.</Note>;
  return (
    <>
      {line ? <PrimaryPill label="Pay bill" onPress={() => onMode('bill')} disabled={owed <= 0} /> : null}
      {loan ? <PrimaryPill label="Pay installment" onPress={() => onMode('installment')} disabled={owed <= 0} /> : null}
      {loan ? <SecondaryPill label="Pay off early" onPress={() => onMode('payoff')} disabled={owed <= 0} /> : null}
      {line ? <SecondaryPill label="Convert a purchase to installments" onPress={onConvert} /> : null}
      <SecondaryPill label="Add interest or fee" onPress={() => onMode('cost')} />
      {line ? <SecondaryPill label="Close this line" onPress={onClose} disabled={owed > 0} /> : null}
    </>
  );
}

function targetsOf(snapshot: Snapshot, id: string): Targets | null {
  const debt = snapshot.debts.find((d) => d.id === id);
  if (!debt) return null;
  const line = creditLinesOf(snapshot.debts).find((l) => l.id === id);
  const loan = loansOf(snapshot.debts).find((l) => l.id === id);
  return { debt, line, loan, owed: line ? owedOnLine(snapshot.transactions, id) : owedOn(snapshot.transactions, id) };
}

export function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, act, today } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const t = targetsOf(snapshot, id!);
  if (!t) return <Note>That debt no longer exists.</Note>;
  const close = async () => {
    const result = await act((ctx) => closeCreditLine(ctx, id!));
    if (result.ok) router.back(); else setError(result.error);
  };
  const billDue = t.line ? amountDue(snapshot.transactions, t.line, today) : 0;
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header" style={styles.flex}>{t.debt.name}</AppText>
        </View>
        <AppText variant="overline" tone="onDeepMuted">YOU OWE</AppText>
        <AppText variant="hero" tone="onDeep">{formatMoney(t.owed)}</AppText>
        {t.loan ? <AppText variant="body" tone="onDeepMuted">{installmentsLeft(t.loan, snapshot.transactions)} installments left</AppText> : null}
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <View style={styles.block}>
          {t.line ? <LineFacts line={t.line} /> : null}
          {message ? <Note>{message}</Note> : null}
          <Actions t={t} onMode={setMode} onClose={close} onConvert={() => setConverting(true)} />
          {error ? <ErrorNotice error={error} /> : null}
        </View>
      </ContentSheet>
      <ConvertPurchaseSheet debtId={id!} visible={converting} onClose={() => setConverting(false)} />
      <BottomSheet visible={mode !== null} onClose={() => setMode(null)} title={mode ? TITLES[mode] : undefined}>
        {mode ? <ActionForm key={mode} mode={mode} debtId={id!} suggested={suggestion(mode, t.owed, billDue)}
          onDone={(text) => { setMessage(text ?? null); setMode(null); }} /> : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  flex: { flex: 1 },
  sheet: { paddingTop: space.xl },
  block: { paddingHorizontal: GUTTER, gap: space.md },
  form: { gap: space.lg, paddingBottom: space.xl },
});
