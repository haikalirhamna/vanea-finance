/** The Salary tab in M1: this period's salary and payment. Review, decrease and the pressure card arrive in M2. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BOTTOM_BAR_SPACE } from '@/components/BottomBar';
import { PrimaryPill } from '@/components/Buttons';
import { NoticeCard } from '@/components/Cards';
import { KeyValue, Note, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { formatDate, formatMoney, formatMonth, formatMonthsCount } from '@/lib/format';
import { SalaryReviewSection } from './SalaryReviewSection';
import { salaryHistory } from '@/features/salary/salary-review';
import { SecondaryPill } from '@/components/Buttons';
import { DashboardSummary } from '@/features/dashboard/dashboard-summary';
import { useApp } from '@/state/AppState';

function Payment({ d, onPay }: { d: DashboardSummary; onPay: () => void }) {
  const { salary } = d;
  if (salary.due && salary.payableNow > 0) return <View style={styles.block}><PrimaryPill label="Pay salary" onPress={onPay} /></View>;
  if (salary.amount === null) return <Note>Your first salary is paid on your first payday.</Note>;
  return <Note>{salary.remaining <= 0 ? 'This period is paid.' : 'Salary can be paid on payday.'}</Note>;
}

/** "Not now" collapses the card for the rest of this session; it returns the next time Vanea is opened. */
const dismissedMonths = new Set<string>();

function Pressure({ d }: { d: DashboardSummary }) {
  const router = useRouter();
  const { today } = useApp();
  const month = today.slice(0, 7);
  const [dismissed, setDismissed] = useState(dismissedMonths.has(month));
  const { pressure } = d;
  if (pressure.level === 'NONE' || pressure.level === 'THIN_BUFFER') return null;
  if (dismissed) return <Note>Your salary is above your typical income. Review it any time with Change salary.</Note>;
  const advice = pressure.safeSalary
    ? `A salary of ${formatMoney(pressure.safeSalary)} would be easier for your Pool to keep up with.`
    : 'Your Pool is covering the difference for now.';
  return (
    <View style={styles.block}>
      <NoticeCard title="Your salary is above your typical income">
        <AppText variant="body" tone="secondary">{advice}</AppText>
        {pressure.monthsToEmpty !== null ? <AppText variant="body" tone="secondary">{`If this continues, your Pool may run out in about ${formatMonthsCount(pressure.monthsToEmpty)}.`}</AppText> : null}
        <SecondaryPill label="Not now" onPress={() => { dismissedMonths.add(month); setDismissed(true); }} />
        <SecondaryPill label="Review salary" onPress={() => router.push(pressure.safeSalary ? { pathname: '/change-salary', params: { amount: String(pressure.safeSalary) } } : '/change-salary')} />
      </NoticeCard>
    </View>
  );
}

function Figures({ d }: { d: DashboardSummary }) {
  const { salary, pool } = d;
  return (
    <View style={styles.block}>
      <KeyValue label="Left to pay this period" value={formatMoney(salary.remaining)} strong />
      <KeyValue label="Your Pool" value={formatMoney(pool.balance)} />
      <KeyValue label="Pool after business loans" value={formatMoney(pool.own)} />
      {pool.runwayMonths !== null ? <KeyValue label="Covers" value={formatMonthsCount(pool.runwayMonths)} /> : null}
      {salary.withheld > 0 ? <KeyValue label="Withheld for your advance" value={formatMoney(salary.withheld)} /> : null}
    </View>
  );
}

const CHANGE_WORDS = { initial: 'First salary', calibration: 'Adjusted', increase: 'Raise', decrease: 'Decrease', restore: 'Returned' } as const;

function History() {
  const { snapshot } = useApp();
  const items = salaryHistory(snapshot);
  return (
    <>
      <SectionHeader title="Salary history" />
      <View style={styles.block}>
        {items.map((item) => <KeyValue key={item.id} label={`${CHANGE_WORDS[item.type]} · from ${formatMonth(item.period)}`} value={formatMoney(item.amount)} />)}
      </View>
    </>
  );
}

export function SalaryScreen() {
  const { dashboard: d } = useApp();
  const router = useRouter();
  if (!d) return null;
  const { salary } = d;
  const startText = `Your first salary starts ${formatDate(salary.startsOn ?? salary.nextPayday)}.`;
  return (
    <Screen bottomInset={BOTTOM_BAR_SPACE}>
      <HeroCanvas>
        <AppText variant="overline" tone="onDeepMuted">{salary.amount === null ? 'SALARY' : `SALARY · ${formatMonth(salary.period).toUpperCase()}`}</AppText>
        <AppText variant="hero" tone="onDeep" accessibilityRole="header">{formatMoney(salary.amount ?? 0)}</AppText>
        <AppText variant="body" tone="onDeepMuted">{salary.amount === null ? startText : `Next payday ${formatDate(salary.nextPayday)}`}</AppText>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <Figures d={d} />
        <Payment d={d} onPay={() => router.push('/pay-salary')} />
        <SectionHeader title="Salary advance" />
        <View style={styles.block}>
          {salary.advance ? (
            <>
              <KeyValue label="You still owe" value={formatMoney(salary.advance.outstanding)} strong />
              <KeyValue label="Withheld from each salary" value={formatMoney(salary.advance.installment)} />
              <KeyValue label="Salaries left" value={String(salary.advance.periodsLeft)} />
            </>
          ) : <Note>Take some of your Pool now and repay it from your next salaries.</Note>}
          <SecondaryPill label={salary.advance ? 'Repay early' : 'Take an advance'} onPress={() => router.push('/advance')} disabled={salary.amount === null} />
        </View>
        <Pressure d={d} />
        <SalaryReviewSection />
        <View style={styles.block}>
          <SecondaryPill label="Change salary" onPress={() => router.push('/change-salary')} disabled={salary.amount === null} />
        </View>
        <History />
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingTop: space.xl },
  block: { paddingHorizontal: GUTTER, marginBottom: space.xl, gap: space.sm },
});
