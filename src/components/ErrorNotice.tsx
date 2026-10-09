import { StyleSheet, View } from 'react-native';
import { ExplainedError } from '@/features/errors';
import { AppText } from './AppText';
import { IconTile } from './IconTile';
import { space } from './theme';

/** What happened, why, and what the user can do (DESIGN §12). Inline, never a red banner. */
export function ErrorNotice({ error }: { error: ExplainedError }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.row}>
      <IconTile icon="alert" tone="caution" size={40} />
      <View style={styles.text}>
        <AppText variant="heading">{error.title}</AppText>
        <AppText variant="body" tone="secondary">{error.what}</AppText>
        {error.next ? <AppText variant="body" tone="secondary">{error.next}</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  text: { flex: 1, gap: space.xs },
});
