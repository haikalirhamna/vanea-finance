/** The Salary tab in M1: this period's salary and payment. Review, decrease and the pressure card arrive in M2. */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BOTTOM_BAR_SPACE } from '@/components/BottomBar';
import { PrimaryPill } from '@/components/Buttons';
import { NoticeCard } from '@/components/Cards';
import { KeyValue, Note, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { formatDate, formatMoney, formatMonth, formatMonthsCount } from '@/lib/format';
import { DashboardSummary } from '@/features/dashboard/dashboard-summary';
import { useApp } from '@/state/AppState';

function Payment({ d, onPay }: { d: DashboardSummary; onPay: () => void }) {
  const { salary } = d;
  if (salary.due && salary.payableNow > 0) return <View style={styles.block}><PrimaryPill label="Pay salary" onPress={onPay} /></View>;
  if (salary.amount === null) return <Note>Your first salary is paid on your first payday.</Note>;
  return <Note>{salary.remaining <= 0 ? 'This period is paid.' : 'Salary can be paid on payday.'}</Note>;
}

function Pressure({ d }: { d: DashboardSummary }) {
  const { pressure } = d;
  if (pressure.level === 'NONE' || pressure.level === 'THIN_BUFFER') return null;
  const advice = pressure.safeSalary
    ? `A salary of ${formatMoney(pressure.safeSalary)} would be easier for your Pool to keep up with.`
    : 'Your Pool is covering the difference for now.';
  return (
    <View style={styles.block}>
      <NoticeCard title="Your salary is above your typical income">
        <AppText variant="body" tone="secondary">{advice}</AppText>
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

export function SalaryScreen() {
  const { dashboard: d, snapshot } = useApp();
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
        {snapshot.advances.some((a) => a.status === 'active') ? (
          <><SectionHeader title="Salary advance" /><Note>Part of each salary is withheld until the advance is repaid.</Note></>
        ) : null}
        <Pressure d={d} />
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingTop: space.xl },
  block: { paddingHorizontal: GUTTER, marginBottom: space.xl, gap: space.sm },
});
