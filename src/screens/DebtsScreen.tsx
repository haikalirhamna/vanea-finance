/** Everything owed: credit lines, PayLater and loans. Debts are tracked, never part of Available Spending (PRD DEBT-1). */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { NoticeCard } from '@/components/Cards';
import { ListRow, Note, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { IconButton } from '@/components/Buttons';
import { owedOnLine } from '@/domain/credit-lines';
import { owedOn } from '@/domain/installment-loans';
import { DebtRecord } from '@/data/debts';
import { formatMoney, formatPercent } from '@/lib/format';
import { useApp } from '@/state/AppState';

function owedOf(debt: DebtRecord, transactions: Parameters<typeof owedOn>[0]): number {
  return debt.kind === 'credit_line' ? owedOnLine(transactions, debt.id) : owedOn(transactions, debt.id);
}

function describe(debt: DebtRecord): string {
  if (debt.kind === 'credit_line') return debt.type === 'paylater' ? 'PayLater' : 'Credit card';
  return debt.purpose === 'business' ? 'Business loan' : 'Loan';
}

export function DebtsScreen() {
  const { snapshot, dashboard } = useApp();
  const router = useRouter();
  const open = snapshot.debts.filter((debt) => debt.status === 'open');
  const summary = dashboard?.debts;
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Debts</AppText>
        </View>
        <AppText variant="overline" tone="onDeepMuted">TOTAL OWED</AppText>
        <AppText variant="hero" tone="onDeep">{formatMoney(summary?.totalOwed ?? 0)}</AppText>
        {summary && summary.dueThisMonth > 0 ? <AppText variant="body" tone="onDeepMuted">{formatMoney(summary.dueThisMonth)} due this month</AppText> : null}
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        {summary?.showRatioCard && summary.ratio !== null ? (
          <View style={styles.card}>
            <NoticeCard title="Debt payments are a big part of your salary">
              <AppText variant="body" tone="secondary">Payments this month are {formatPercent(summary.ratio)} of your salary. That's worth keeping an eye on.</AppText>
            </NoticeCard>
          </View>
        ) : null}
        {open.length === 0 ? <Note>No debts recorded.</Note> : null}
        {open.map((debt, index) => (
          <ListRow
            key={debt.id} icon={debt.kind === 'credit_line' ? 'card' : 'receipt'} title={debt.name} subtitle={describe(debt)}
            trailing={formatMoney(owedOf(debt, snapshot.transactions))} trailingAmount={owedOf(debt, snapshot.transactions)}
            divider={index < open.length - 1} onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
          />
        ))}
        <SectionHeader title="Add" />
        <View style={styles.buttons}>
          <PrimaryPill label="Credit line or PayLater" onPress={() => router.push('/add-credit-line')} />
          <SecondaryPill label="Loan" onPress={() => router.push('/add-loan')} />
        </View>
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  sheet: { paddingTop: space.lg, paddingBottom: space.giant },
  card: { marginBottom: space.lg },
  buttons: { paddingHorizontal: GUTTER, gap: space.md, marginTop: space.md },
});
