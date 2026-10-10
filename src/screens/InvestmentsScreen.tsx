/** Investments (USER-FLOWS §23.6): what you put in is the main number; estimates are dated and secondary. */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton, PrimaryPill } from '@/components/Buttons';
import { ListRow, Note, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { investmentsView } from '@/features/investments/investment-summary';
import { RISK_WORDS, CLASS_WORDS } from '@/features/investments/investment-words';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { useApp } from '@/state/AppState';

export function InvestmentsScreen() {
  const { snapshot, today } = useApp();
  const router = useRouter();
  const view = investmentsView(snapshot, today);
  const { totals } = view;
  const open = view.holdings.filter((h) => h.status === 'open');
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Investments</AppText>
        </View>
        <AppText variant="overline" tone="onDeepMuted">PUT IN</AppText>
        <AppText variant="hero" tone="onDeep">{formatMoney(totals.putIn)}</AppText>
        {totals.estimatedValue !== null ? (
          <AppText variant="body" tone="onDeepMuted">{`Estimated ${formatMoney(totals.estimatedValue)} · as of ${formatDate(totals.oldestEstimate!)}${totals.onPaper === null ? '' : ` · ${totals.onPaper >= 0 ? '+' : ''}${formatMoney(totals.onPaper)} on paper`}`}</AppText>
        ) : null}
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <Note>Never counted as spending money, in your Pool or in your salary.</Note>
        {open.length === 0 ? <Note>No holdings yet.</Note> : null}
        {open.map((h, index) => (
          <ListRow key={h.id} icon="trend" title={h.name}
            subtitle={[CLASS_WORDS[h.assetClass], h.risk ? RISK_WORDS[h.risk] : null, h.estimate ? `${h.estimate.stale ? 'Value last updated ' : 'Estimate as of '}${formatDate(h.estimate.asOf)}` : null].filter(Boolean).join(' · ')}
            trailing={formatMoney(h.putIn)} trailingAmount={h.putIn} divider={index < open.length - 1}
            onPress={() => router.push({ pathname: '/holding/[id]', params: { id: h.id } })} />
        ))}
        {view.allocation.length > 0 ? <SectionHeader title="By asset class" /> : null}
        {view.allocation.map((a) => (
          <ListRow key={a.assetClass} title={CLASS_WORDS[a.assetClass]} subtitle={a.risk ? RISK_WORDS[a.risk] : 'Risk label not set'} trailing={formatPercent(a.share)} divider={false} />
        ))}
        {view.concentrated ? <Note>{`${CLASS_WORDS[view.concentrated.assetClass]} is more than half of what you put in. That is a high-risk class: worth knowing, not a recommendation.`}</Note> : null}
        <View style={styles.action}><PrimaryPill label="Add holding" onPress={() => router.push('/add-holding')} /></View>
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  sheet: { paddingTop: space.lg, paddingBottom: space.giant },
  action: { paddingHorizontal: GUTTER, marginTop: space.xl },
});
