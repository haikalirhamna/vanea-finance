/** The dashboard (DESIGN §4): what can I spend today. All figures come from buildDashboard; this only shows them. */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BOTTOM_BAR_SPACE } from '@/components/BottomBar';
import { PrimaryPill } from '@/components/Buttons';
import { DuoCard, DuoRow, FloatingActionCard, NoticeCard } from '@/components/Cards';
import { ListRow, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { formatDate, formatMoney, formatMonthsCount, formatPercent } from '@/lib/format';
import { subscriptionList } from '@/features/subscriptions/subscription-summary';
import { monthPrompts } from '@/features/reflection/reflection-summary';
import { formatMonthName } from '@/lib/format';
import { DashboardSummary } from '@/features/dashboard/dashboard-summary';
import { useApp } from '@/state/AppState';

/** The floating card straddles the hero's edge; the sheet rises behind it so its rounded top shows. */
const CARD_OVERLAP = 44;
const CARD_HEIGHT = 104;
const SEAM_RISE = 28;

const CATEGORY_WORDS = { needs: 'Needs', wants: 'Wants', growth: 'Growth', unexpected: 'Unexpected' } as const;

function allowanceLine(d: DashboardSummary): string {
  const { allowance } = d;
  if (allowance.overspent || allowance.amount === null) {
    return `You've spent ${formatMoney(-d.availableSpending)} more than your salary. Your next salary will cover it.`;
  }
  const after = allowance.dueBeforePayday > 0 ? `, after ${formatMoney(allowance.dueBeforePayday)} in payments due before then` : '';
  return `${formatMoney(allowance.amount)} a day until ${formatDate(allowance.nextPayday)}${after}`;
}

function paceLine(d: DashboardSummary): string | null {
  if (!d.pace?.ahead) return null;
  return `You've used ${formatPercent(d.pace.spentRatio)} of this period's money; ${formatPercent(d.pace.elapsedRatio)} of the period has passed.`;
}

function Hero({ d, onPaySalary }: { d: DashboardSummary; onPaySalary: () => void }) {
  const pace = paceLine(d);
  return (
    <HeroCanvas overlap={CARD_OVERLAP}>
      <AppText variant="overline" tone="onDeepMuted">AVAILABLE SPENDING</AppText>
      <AppText variant="hero" tone="onDeep" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>{formatMoney(d.availableSpending)}</AppText>
      <AppText variant="body" tone="onDeepMuted">{allowanceLine(d)}</AppText>
      {pace ? <AppText variant="caption" tone="onDeepMuted">{pace}</AppText> : null}
      {d.salary.due && d.salary.payableNow > 0 ? (
        <View style={styles.heroAction}>
          <AppText variant="bodyStrong" tone="onDeep">Payday · Pay yourself {formatMoney(d.salary.remaining)}</AppText>
          {d.salary.payableNow < d.salary.remaining ? <AppText variant="caption" tone="onDeepMuted">Your Pool can pay {formatMoney(d.salary.payableNow)} of it.</AppText> : null}
          <PrimaryPill label="Pay salary" onDeep onPress={onPaySalary} />
        </View>
      ) : null}
    </HeroCanvas>
  );
}

/** Quiet invitations, never badges: reflect on last month, set this month's intention. */
function MonthInvites() {
  const { snapshot, today } = useApp();
  const router = useRouter();
  const { reflectOn, needsIntention } = monthPrompts(snapshot, today);
  const due = subscriptionList(snapshot, today).rows.filter((row) => row.dueToday);
  if (!reflectOn && !needsIntention && due.length === 0) return null;
  return (
    <View style={styles.stack}>
      {due.map((row) => <ListRow key={row.id} icon="repeat" title={`${row.name} renews`} subtitle="Confirm the billing when it is charged" trailing={formatMoney(row.price ?? 0)} onPress={() => router.push({ pathname: '/subscription/[id]', params: { id: row.id } })} />)}
      {reflectOn ? <ListRow icon="calendar" title={`Reflect on ${formatMonthName(reflectOn)}`} subtitle="Look back at the month" onPress={() => router.push({ pathname: '/reflection', params: { month: reflectOn } })} /> : null}
      {needsIntention ? <ListRow icon="edit" title={`Set your intention for ${formatMonthName(today.slice(0, 7))}`} subtitle="What do you want to set aside?" onPress={() => router.push('/intention')} divider={false} /> : null}
    </View>
  );
}

function DebtNotice({ d, onPress }: { d: DashboardSummary; onPress: () => void }) {
  if (d.debts.dueBeforePayday <= 0) return null;
  return (
    <NoticeCard title="Payments due before payday">
      <AppText variant="body" tone="secondary">{formatMoney(d.debts.dueBeforePayday)} is due before your next salary. It is already left out of your daily figure.</AppText>
      <PrimaryPill label="See debts" onPress={onPress} />
    </NoticeCard>
  );
}

export function HomeScreen() {
  const { dashboard: d } = useApp();
  const router = useRouter();
  if (!d) return null;
  const poolCaption = d.pool.runwayMonths === null ? undefined : `Covers ${formatMonthsCount(d.pool.runwayMonths)}`;
  const salaryCaption = d.salary.amount === null ? `Starts ${formatDate(d.salary.startsOn ?? d.salary.nextPayday)}` : `Next ${formatDate(d.salary.nextPayday)}`;
  return (
    <Screen bottomInset={BOTTOM_BAR_SPACE}>
      <Hero d={d} onPaySalary={() => router.push('/pay-salary')} />
      <View style={styles.floating}>
        <FloatingActionCard items={[
          { icon: 'arrowDown', label: 'Income', onPress: () => router.push('/add-income') },
          { icon: 'wallet', label: 'Pay salary', onPress: () => router.push('/pay-salary') },
          { icon: 'card', label: 'Debts', onPress: () => router.push('/debts') },
          { icon: 'list', label: 'History', onPress: () => router.push('/activity') },
        ]} />
      </View>
      <ContentSheet style={styles.sheet}>
        <DuoRow>
          <DuoCard variant="deep" icon="wallet" label="Salary" amount={d.salary.amount ?? 0} caption={salaryCaption} onPress={() => router.push('/salary')} />
          <DuoCard variant="vivid" icon="shield" label="Pool" amount={d.pool.balance} onPress={() => router.push('/pool')} {...(poolCaption ? { caption: poolCaption } : {})} />
        </DuoRow>
        <View style={styles.stack}><DebtNotice d={d} onPress={() => router.push('/debts')} /></View>
        <MonthInvites />
        <SectionHeader title="Recent spending" />
        {d.recentSpending.length === 0 ? <AppText variant="body" tone="secondary" style={styles.empty}>Nothing yet. Tap + to add your first expense.</AppText> : null}
        {d.recentSpending.map((item, index) => (
          <ListRow
            key={item.id} icon="receipt" title={item.label || CATEGORY_WORDS[item.category]}
            subtitle={`${CATEGORY_WORDS[item.category]} · ${formatDate(item.date)}${item.paidWithCreditLine ? ' · Credit line' : ''}`}
            trailing={formatMoney(item.amount)} trailingAmount={item.amount} divider={index < d.recentSpending.length - 1}
          />
        ))}
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroAction: { marginTop: space.lg, gap: space.sm },
  floating: { marginTop: -CARD_OVERLAP, zIndex: 2 },
  sheet: { marginTop: -(CARD_HEIGHT - CARD_OVERLAP + SEAM_RISE), paddingTop: CARD_HEIGHT - CARD_OVERLAP + SEAM_RISE + space.xl },
  stack: { marginTop: space.lg },
  empty: { paddingHorizontal: GUTTER, marginTop: space.sm },
});
