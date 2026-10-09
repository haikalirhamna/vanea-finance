import { StyleSheet, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { radius, useTheme } from './theme';

interface Props {
  icon: IconName;
  tone?: 'default' | 'caution' | 'onDeep';
  size?: number;
}

/** A rounded tile behind a line icon: one violet tint everywhere, caution only for the one caution card. */
export function IconTile({ icon, tone = 'default', size = 48 }: Props) {
  const { colors } = useTheme();
  const palette = {
    default: { background: colors.tile, icon: colors.tileIcon },
    caution: { background: colors.caution100, icon: colors.caution600 },
    onDeep: { background: colors.onDeepFaint, icon: colors.onDeep },
  }[tone];
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: palette.background }]}>
      <Icon name={icon} size={Math.round(size / 2)} color={palette.icon} />
    </View>
  );
}

const styles = StyleSheet.create({ tile: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' } });
