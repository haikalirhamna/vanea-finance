/** Money, investments and debts as three separate groups: never one total (PRD INV-8). */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/Buttons';
import { KeyValue, Note, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { netPosition } from '@/features/investments/investment-summary';
import { formatMoney } from '@/lib/format';
import { useApp } from '@/state/AppState';

export function NetPositionScreen() {
  const { snapshot, today } = useApp();
  const router = useRouter();
  const position = netPosition(snapshot, today);
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Net position</AppText>
        </View>
        <AppText variant="body" tone="onDeepMuted">Three separate groups. Adding them together would hide what is real money.</AppText>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <SectionHeader title="Money" />
        <View style={styles.block}>
          <KeyValue label="Pool" value={formatMoney(position.money.pool)} />
          <KeyValue label="Available Spending" value={formatMoney(position.money.personal)} />
          <KeyValue label="Savings" value={formatMoney(position.money.savings)} />
          <KeyValue label="Total money" value={formatMoney(position.money.total)} strong />
        </View>
        <SectionHeader title="Investments" />
        <View style={styles.block}>
          <KeyValue label="Put in" value={formatMoney(position.investments.putIn)} strong />
          {position.investments.estimatedValue !== null ? <KeyValue label="Estimated value" value={formatMoney(position.investments.estimatedValue)} /> : null}
          <Note>Estimates are your own, dated, and can be far from what you would get if you sold.</Note>
        </View>
        <SectionHeader title="Debts" />
        <View style={styles.block}><KeyValue label="You owe" value={formatMoney(position.debts)} strong /></View>
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  sheet: { paddingTop: space.lg, paddingBottom: space.giant },
  block: { paddingHorizontal: GUTTER, gap: space.sm },
});
