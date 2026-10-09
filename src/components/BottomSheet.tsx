import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { GUTTER, radius, space, useTheme } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** A sheet sliding up from the bottom (28 dp top corners). The system back button closes it first. */
export function BottomSheet({ visible, onClose, title, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.xl }]}>
        <View style={[styles.handle, { backgroundColor: colors.line }]} />
        {title ? <AppText variant="title" style={styles.title}>{title}</AppText> : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,11,26,0.45)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: GUTTER, paddingTop: space.md, gap: space.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space.sm },
  title: { marginBottom: space.xs },
});
