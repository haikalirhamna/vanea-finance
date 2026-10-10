/** The Subscriptions list (USER-FLOWS §4, §24): what each costs per month, and a quiet note when a price has changed. */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton, PrimaryPill } from '@/components/Buttons';
import { ListRow, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { subscriptionList } from '@/features/subscriptions/subscription-summary';
import { formatDate, formatMoney, formatMonth } from '@/lib/format';
import { useApp } from '@/state/AppState';

export function SubscriptionsScreen() {
  const { snapshot, today } = useApp();
  const router = useRouter();
  const { rows, monthlyTotal } = subscriptionList(snapshot, today);
  return (
    <Screen>
      <HeroCanvas>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg }}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Subscriptions</AppText>
        </View>
        <AppText variant="overline" tone="onDeepMuted">PER MONTH</AppText>
        <AppText variant="hero" tone="onDeep">{formatMoney(monthlyTotal)}</AppText>
      </HeroCanvas>
      <ContentSheet style={{ paddingTop: space.lg, paddingBottom: space.giant }}>
        {rows.length === 0 ? <Note>No subscriptions yet. Add the ones you pay from your income.</Note> : null}
        {rows.map((row, index) => {
          const parts = [row.cycle === 'yearly' ? 'Yearly' : 'Monthly', row.dueToday ? 'Due now' : `Next ${formatDate(row.nextBillingDate)}`];
          if (row.change) parts.push(`${row.change.percent > 0 ? '+' : ''}${row.change.percent}% since ${formatMonth(row.change.sinceMonth)}`);
          if (row.upcoming) parts.push(`${formatMoney(row.upcoming.price)} from ${formatDate(row.upcoming.effectiveFrom)}`);
          return (
            <ListRow key={row.id} icon="repeat" title={row.name} subtitle={parts.join(' · ')} trailing={row.price === null ? '' : formatMoney(row.price)}
              trailingAmount={row.price ?? 0} divider={index < rows.length - 1} onPress={() => router.push({ pathname: '/subscription/[id]', params: { id: row.id } })} />
          );
        })}
        <View style={{ paddingHorizontal: GUTTER, marginTop: space.xl }}>
          <PrimaryPill label="Add subscription" onPress={() => router.push('/add-subscription')} />
        </View>
      </ContentSheet>
    </Screen>
  );
}
