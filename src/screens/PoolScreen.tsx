/** The Pool: what it holds, the safe surplus, and moving money out of it (USER-FLOWS §16). Vanea never suggests a destination. */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/Buttons';
import { PoolMoveForm } from './PoolMoveForm';
import { KeyValue, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { surplusView } from '@/features/savings/savings-actions';
import { formatMoney, formatMonthsCount } from '@/lib/format';
import { useApp } from '@/state/AppState';

export function PoolScreen() {
  const { snapshot, today } = useApp();
  const router = useRouter();
  const view = surplusView(snapshot, today);
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Pool</AppText>
        </View>
        <AppText variant="hero" tone="onDeep">{formatMoney(view.pool)}</AppText>
        <AppText variant="body" tone="onDeepMuted">Income you haven't paid yourself yet.</AppText>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <View style={styles.block}>
          <KeyValue label="Safe surplus" value={formatMoney(view.safe)} strong />
          {view.runwayNow !== null ? <KeyValue label="Covers" value={formatMonthsCount(view.runwayNow)} /> : null}
          <Note>The safe surplus is what is left above {snapshot.profile!.bufferMonths} months of salary and costs.</Note>
          <PoolMoveForm />
        </View>
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  sheet: { paddingTop: space.xl },
  block: { paddingHorizontal: GUTTER, gap: space.md },
});
