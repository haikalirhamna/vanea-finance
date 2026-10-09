/** First launch: one question per screen (DESIGN §5). Everything is written together at the end. */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton, PrimaryPill, TextButton } from '@/components/Buttons';
import { ErrorNotice } from '@/components/ErrorNotice';
import { AmountField, TextField } from '@/components/Fields';
import { KeyValue, Note } from '@/components/Rows';
import { HeroCanvas } from '@/components/Surfaces';
import { GUTTER, space, useTheme } from '@/components/theme';
import { addMonths, monthOf } from '@/domain/calendar';
import { HistoricalMonth } from '@/domain/income-history';
import { formatMoney, formatMonth, formatMonthsCount } from '@/lib/format';
import { ExplainedError } from '@/features/errors';
import { OnboardingDebt, completeOnboarding } from '@/features/onboarding/onboarding-actions';
import { recommendForOnboarding } from '@/features/onboarding/onboarding-recommendation';
import { useApp } from '@/state/AppState';
import { OnboardingDebtsStep } from './OnboardingDebtsStep';

const STEPS = ['welcome', 'payday', 'history', 'money', 'debts', 'salary', 'privacy'] as const;
type Step = (typeof STEPS)[number];
const HISTORY_MONTHS = 12;

interface Draft {
  payday: string;
  history: Record<string, number | null>;
  pool: number | null;
  personal: number | null;
  savings: number | null;
  debts: OnboardingDebt[];
  salary: number | null;
}

const EMPTY: Draft = { payday: '', history: {}, pool: null, personal: null, savings: null, debts: [], salary: null };

function historyOf(draft: Draft): HistoricalMonth[] {
  return Object.entries(draft.history)
    .filter((entry): entry is [string, number] => entry[1] !== null && entry[1] > 0)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
}

function HistoryStep({ draft, set, months }: { draft: Draft; set: (next: Draft) => void; months: string[] }) {
  return (
    <View style={styles.stack}>
      <Note>Income per month, after business costs. Skip any month you don't know. Three or more months give a better recommendation.</Note>
      {months.map((month) => (
        <AmountField key={month} label={formatMonth(month)} value={draft.history[month] ?? null}
          onChange={(value) => set({ ...draft, history: { ...draft.history, [month]: value } })} />
      ))}
    </View>
  );
}

function MoneyStep({ draft, set }: { draft: Draft; set: (next: Draft) => void }) {
  return (
    <View style={styles.stack}>
      <AmountField label="Pool" value={draft.pool} onChange={(pool) => set({ ...draft, pool })} hint="Income you haven't paid yourself yet." />
      <AmountField label="Available Spending" value={draft.personal} onChange={(personal) => set({ ...draft, personal })} hint="Money for your personal spending." />
      <AmountField label="Savings" value={draft.savings} onChange={(savings) => set({ ...draft, savings })} hint="Kept apart; never counted as spending money." />
      <Note>Leave blank where you have nothing. Stocks and crypto can be added later: they are never counted as money you can spend.</Note>
    </View>
  );
}

function SalaryStep({ draft, set, today }: { draft: Draft; set: (next: Draft) => void; today: string }) {
  const { recommendation, monthsOfData } = useMemo(
    () => recommendForOnboarding(historyOf(draft), draft.pool ?? 0, today),
    [draft, today],
  );
  return (
    <View style={styles.stack}>
      {recommendation ? (
        <>
          <KeyValue label="Recommended salary" value={formatMoney(recommendation.amount)} strong />
          <Note>Based on your {formatMonthsCount(monthsOfData)} of income and your Pool. It's a pay level your weakest months could still support.</Note>
        </>
      ) : <Note>With fewer than 3 months of history there is no recommendation yet. Pick an amount you are sure you can keep paying yourself; Vanea will help adjust it.</Note>}
      <AmountField label="Your salary" value={draft.salary ?? recommendation?.amount ?? null} onChange={(salary) => set({ ...draft, salary })} large />
    </View>
  );
}

function StepBody({ step, draft, set, months, today }: { step: Step; draft: Draft; set: (next: Draft) => void; months: string[]; today: string }) {
  switch (step) {
    case 'payday':
      return <TextField label="Day of the month (1–28)" value={draft.payday} onChangeText={(payday) => set({ ...draft, payday })} keyboardType="number-pad" hint="The day you pay yourself." />;
    case 'history': return <HistoryStep draft={draft} set={set} months={months} />;
    case 'money': return <MoneyStep draft={draft} set={set} />;
    case 'debts': return <OnboardingDebtsStep debts={draft.debts} onChange={(debts) => set({ ...draft, debts })} />;
    case 'salary': return <SalaryStep draft={draft} set={set} today={today} />;
    case 'privacy':
      return <Note>Your data lives only on this phone. If you uninstall Vanea or lose your phone without a backup, it's gone. You can make an encrypted backup any time from More.</Note>;
    default: return null;
  }
}

function salaryOf(draft: Draft, today: string): number | null {
  if (draft.salary !== null) return draft.salary;
  return recommendForOnboarding(historyOf(draft), draft.pool ?? 0, today).recommendation?.amount ?? null;
}

const labelOf = (step: Step): string => (step === 'welcome' ? 'Get started' : step === 'privacy' ? 'Start using Vanea' : 'Continue');

function canContinueFrom(step: Step, payday: number, salary: number | null): boolean {
  if (step === 'payday') return payday >= 1 && payday <= 28;
  return step === 'salary' ? !!salary : true;
}

const TITLES: Record<Step, string> = {
  welcome: 'Welcome to Vanea', payday: 'When is your payday?', history: 'How much did you earn?', money: 'What do you have now?',
  debts: 'What do you owe?', salary: 'Your salary', privacy: 'Your data stays here',
};

export function OnboardingScreen() {
  const { act, today } = useApp();
  const router = useRouter();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [busy, setBusy] = useState(false);
  const step = STEPS[index]!;
  const months = useMemo(() => Array.from({ length: HISTORY_MONTHS }, (_, i) => addMonths(monthOf(today), -(i + 1))), [today]);
  const salary = salaryOf(draft, today);
  const payday = Number.parseInt(draft.payday, 10);
  const canContinue = canContinueFrom(step, payday, salary);

  const finish = async () => {
    setBusy(true);
    setError(null);
    const result = await act((ctx) => completeOnboarding(ctx, {
      paydayDay: payday, historical: historyOf(draft), debts: draft.debts, salary: salary!,
      openingBalances: { pool: draft.pool ?? 0, personal: draft.personal ?? 0, savings: draft.savings ?? 0 },
    }));
    setBusy(false);
    if (result.ok) router.replace('/'); else setError(result.error);
  };
  const next = () => (step === 'privacy' ? finish() : setIndex(index + 1));

  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <HeroCanvas>
        <View style={styles.top}>
          {index > 0 ? <IconButton icon="chevronLeft" label="Back" onPress={() => setIndex(index - 1)} onDeep /> : <View />}
          <AppText variant="caption" tone="onDeepMuted">{index + 1} / {STEPS.length}</AppText>
        </View>
        <AppText variant="title" tone="onDeep" accessibilityRole="header">{TITLES[step]}</AppText>
        {step === 'welcome' ? <AppText variant="body" tone="onDeepMuted">Pay yourself a steady salary from your irregular income, and always know what you can spend today.</AppText> : null}
      </HeroCanvas>
      <View style={styles.body}>
        <StepBody step={step} draft={draft} set={setDraft} months={months} today={today} />
        {error ? <ErrorNotice error={error} /> : null}
        <PrimaryPill label={labelOf(step)} onPress={next} disabled={!canContinue} busy={busy} />
        {step === 'history' || step === 'debts' ? <TextButton label="Skip" onPress={() => setIndex(index + 1)} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  body: { padding: GUTTER, gap: space.xl, paddingBottom: space.giant },
  stack: { gap: space.lg },
});
