/** Savings: money set aside from Available Spending. Never counted as spending money (PRD SAV-1). */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { IconButton, PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { AmountField } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { balanceOf } from '@/domain/ledger';
import { allMovements } from '@/domain/ledger-movements';
import { ExplainedError } from '@/features/errors';
import { depositSavings, withdrawSavings } from '@/features/savings/savings-actions';
import { formatMoney } from '@/lib/format';
import { useApp } from '@/state/AppState';

type Mode = 'deposit' | 'withdraw';

function MoveForm({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const { act } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const save = async () => {
    const result = await act((ctx) => (mode === 'deposit' ? depositSavings(ctx, { amount: amount! }) : withdrawSavings(ctx, { amount: amount! })));
    if (result.ok) onDone(); else setError(result.error);
  };
  return (
    <View style={styles.form}>
      <AmountField label="Amount" value={amount} onChange={setAmount} />
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label={mode === 'deposit' ? 'Set aside' : 'Withdraw'} onPress={save} disabled={!amount} />
    </View>
  );
}

export function SavingsScreen() {
  const { snapshot, dashboard } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const savings = balanceOf(allMovements(snapshot.transactions), 'savings');
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Savings</AppText>
        </View>
        <AppText variant="hero" tone="onDeep">{formatMoney(savings)}</AppText>
        <AppText variant="body" tone="onDeepMuted">Not part of Available Spending.</AppText>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <View style={styles.block}>
          <PrimaryPill label="Set aside" onPress={() => setMode('deposit')} disabled={(dashboard?.availableSpending ?? 0) <= 0} />
          <SecondaryPill label="Withdraw" onPress={() => setMode('withdraw')} disabled={savings <= 0} />
          <Note>Setting aside moves money from Available Spending. Withdrawing puts it back.</Note>
        </View>
      </ContentSheet>
      <BottomSheet visible={mode !== null} onClose={() => setMode(null)} title={mode === 'deposit' ? 'Set aside' : 'Withdraw'}>
        {mode ? <MoveForm key={mode} mode={mode} onDone={() => setMode(null)} /> : null}
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
