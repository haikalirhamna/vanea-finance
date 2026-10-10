/** One holding: put money in, update its estimate, sell, record income (USER-FLOWS §23.2–23.5). */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { IconButton, PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { AmountField, DateField, Segmented } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { KeyValue, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { ActionContext, ActionResult } from '@/features/action-runtime';
import { ExplainedError } from '@/features/errors';
import {
  addHoldingIncome, contribute, previewSale, recordExistingPutIn, sell, updateValue, withdrawHoldingCash,
} from '@/features/investments/investment-actions';
import { HoldingRow, investmentsView } from '@/features/investments/investment-summary';
import { CLASS_WORDS, RISK_WORDS } from '@/features/investments/investment-words';
import { formatDate, formatMoney } from '@/lib/format';
import { useApp } from '@/state/AppState';

type Mode = 'contribute' | 'existing' | 'value' | 'sell' | 'income' | 'cash';
const TITLES: Record<Mode, string> = {
  contribute: 'Put money in', existing: 'Already owned', value: 'Update value', sell: 'Sell', income: 'Add income', cash: 'Withdraw cash',
};
const FROM = [{ value: 'personal', label: 'Available Spending' }, { value: 'pool', label: 'Pool surplus' }] as const;
const TO = [{ value: 'personal', label: 'Available Spending' }, { value: 'savings', label: 'Savings' }] as const;
const SHARES = [{ value: 'all', label: 'All' }, { value: '0.5', label: 'Half' }, { value: '0.25', label: 'A quarter' }] as const;

function useRun(onDone: () => void) {
  const { act } = useApp();
  const [error, setError] = useState<ExplainedError | null>(null);
  const run = async (action: Parameters<typeof act>[0]) => {
    const result: ActionResult<unknown> = await act(action);
    if (result.ok) onDone(); else setError(result.error);
  };
  return { run, error };
}

function SellForm({ row, onDone }: { row: HoldingRow; onDone: () => void }) {
  const [proceeds, setProceeds] = useState<number | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [to, setTo] = useState<'personal' | 'savings' | null>(null);
  const { run, error } = useRun(onDone);
  const parsed = share === null ? null : share === 'all' ? 'all' : Number.parseFloat(share);
  const plan = proceeds !== null && parsed !== null ? previewSale(row.putIn, { proceeds, share: parsed }) : null;
  return (
    <View style={styles.form}>
      <AmountField label="Cash received" value={proceeds} onChange={setProceeds} />
      <Segmented label="How much did you sell?" options={SHARES} value={share} onChange={setShare} />
      <Segmented label="Send the cash to" options={TO} value={to} onChange={setTo} />
      {plan ? <Note>{`Cost of what you sold: ${formatMoney(plan.costRemoved)} · Realized ${plan.realizedGain >= 0 ? 'gain' : 'loss'}: ${formatMoney(Math.abs(plan.realizedGain))}`}</Note> : null}
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label="Sell" disabled={!proceeds || parsed === null || !to}
        onPress={() => run((ctx) => sell(ctx, { holdingId: row.id, proceeds: proceeds!, share: parsed!, to: to! }))} />
    </View>
  );
}

interface FormValues {
  holdingId: string;
  amount: number;
  from: 'personal' | 'pool' | null;
  to: 'personal' | 'savings' | null;
  asOf: string;
}

/** What each mode asks for, and what it runs. */
const MODES: Record<Exclude<Mode, 'sell'>, {
  label: string; from?: true; to?: true; date?: true; run: (ctx: ActionContext, v: FormValues) => Promise<ActionResult<unknown>>;
}> = {
  contribute: { label: 'Amount', from: true, run: (ctx, v) => contribute(ctx, { holdingId: v.holdingId, amount: v.amount, from: v.from! }) },
  existing: { label: 'What you put in, in total', run: (ctx, v) => recordExistingPutIn(ctx, { holdingId: v.holdingId, amount: v.amount }) },
  value: { label: 'Current value', date: true, run: (ctx, v) => updateValue(ctx, { holdingId: v.holdingId, value: v.amount, asOf: v.asOf }) },
  income: { label: 'Amount', run: (ctx, v) => addHoldingIncome(ctx, { holdingId: v.holdingId, amount: v.amount }) },
  cash: { label: 'Amount', to: true, run: (ctx, v) => withdrawHoldingCash(ctx, { holdingId: v.holdingId, amount: v.amount, to: v.to! }) },
};

function isMissing(spec: { from?: true; to?: true }, v: { amount: number | null; from: string | null; to: string | null }): boolean {
  if (v.amount === null) return true;
  return (!!spec.from && !v.from) || (!!spec.to && !v.to);
}

function ModeForm({ mode, row, onDone }: { mode: Mode; row: HoldingRow; onDone: () => void }) {
  const { today } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [from, setFrom] = useState<'personal' | 'pool' | null>(null);
  const [to, setTo] = useState<'personal' | 'savings' | null>(null);
  const [asOf, setAsOf] = useState(today);
  const { run, error } = useRun(onDone);
  if (mode === 'sell') return <SellForm row={row} onDone={onDone} />;
  const spec = MODES[mode];
  const missing = isMissing(spec, { amount, from, to });
  return (
    <View style={styles.form}>
      <AmountField label={spec.label} value={amount} onChange={setAmount} />
      {spec.from ? <Segmented label="From" options={FROM} value={from} onChange={setFrom} /> : null}
      {spec.to ? <Segmented label="Send to" options={TO} value={to} onChange={setTo} /> : null}
      {spec.date ? <DateField label="As of" value={asOf} onChange={setAsOf} max={today} /> : null}
      {spec.date ? <Note>An estimate never changes any money, your Pool, runway or salary.</Note> : null}
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label={TITLES[mode]} disabled={missing} onPress={() => run((ctx) => spec.run(ctx, { holdingId: row.id, amount: amount!, from, to, asOf }))} />
    </View>
  );
}

function Facts({ row }: { row: HoldingRow }) {
  const estimate = row.estimate;
  return (
    <>
      {estimate ? (
        <>
          <KeyValue label={estimate.stale ? 'Value last updated' : 'Estimate as of'} value={formatDate(estimate.asOf, true)} />
          <KeyValue label="Estimated value" value={formatMoney(estimate.value)} />
          <KeyValue label="On paper" value={`${estimate.onPaper >= 0 ? '+' : ''}${formatMoney(estimate.onPaper)}`} />
        </>
      ) : <Note>No estimate yet. Add one when you want to see the on-paper difference.</Note>}
      {row.cash > 0 ? <KeyValue label="Income kept here" value={formatMoney(row.cash)} /> : null}
    </>
  );
}

function Actions({ row, onMode }: { row: HoldingRow; onMode: (mode: Mode) => void }) {
  if (row.status === 'closed') return <Note>This holding is closed.</Note>;
  return (
    <>
      <SecondaryPill label="Put money in" onPress={() => onMode('contribute')} />
      <SecondaryPill label="Update value" onPress={() => onMode('value')} />
      <SecondaryPill label="Sell" onPress={() => onMode('sell')} disabled={row.putIn <= 0} />
      <SecondaryPill label="Add income" onPress={() => onMode('income')} />
      {row.cash > 0 ? <SecondaryPill label="Withdraw cash" onPress={() => onMode('cash')} /> : null}
      <SecondaryPill label="Already owned before Vanea" onPress={() => onMode('existing')} />
    </>
  );
}

export function HoldingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, today } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const row = investmentsView(snapshot, today).holdings.find((h) => h.id === id);
  if (!row) return <Note>That holding no longer exists.</Note>;
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">{row.name}</AppText>
        </View>
        <AppText variant="overline" tone="onDeepMuted">PUT IN</AppText>
        <AppText variant="hero" tone="onDeep">{formatMoney(row.putIn)}</AppText>
        <AppText variant="body" tone="onDeepMuted">{[CLASS_WORDS[row.assetClass], row.risk ? RISK_WORDS[row.risk] : null, row.platform].filter(Boolean).join(' · ')}</AppText>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <View style={styles.block}>
          <Facts row={row} />
          <Actions row={row} onMode={setMode} />
        </View>
      </ContentSheet>
      <BottomSheet visible={mode !== null} onClose={() => setMode(null)} title={mode ? TITLES[mode] : undefined}>
        {mode ? <ModeForm key={mode} mode={mode} row={row} onDone={() => setMode(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  sheet: { paddingTop: space.xl },
  block: { paddingHorizontal: GUTTER, gap: space.md },
  form: { gap: space.lg, paddingBottom: space.xl },
});
