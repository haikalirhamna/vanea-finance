import { useRouter } from 'expo-router';
import { BOTTOM_BAR_SPACE } from '@/components/BottomBar';
import { AppText } from '@/components/AppText';
import { ListRow, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { daysSinceExport } from '@/features/backup/backup-actions';
import { space } from '@/components/theme';
import { useApp } from '@/state/AppState';

export function MoreScreen() {
  const router = useRouter();
  const { snapshot, ctx } = useApp();
  const days = daysSinceExport(snapshot.profile?.lastExportAt, ctx.now());
  const backupNote = days === null ? 'Never backed up' : days === 0 ? 'Backed up today' : `Last backup ${days} days ago`;
  return (
    <Screen bottomInset={BOTTOM_BAR_SPACE}>
      <HeroCanvas><AppText variant="title" tone="onDeep" accessibilityRole="header">More</AppText></HeroCanvas>
      <ContentSheet style={{ paddingTop: space.lg }}>
        <ListRow icon="card" title="Debts" subtitle="Credit lines, PayLater and loans" onPress={() => router.push('/debts')} />
        <ListRow icon="calendar" title="Reflections" subtitle="Look back on a month" onPress={() => router.push('/reflections')} />
        <ListRow icon="download" title="Backup and restore" subtitle={backupNote} onPress={() => router.push('/backup')} />
        <ListRow icon="sliders" title="Settings" subtitle="Payday, reminders" onPress={() => router.push('/settings')} divider={false} />
        <Note>Your data lives only on this phone.</Note>
      </ContentSheet>
    </Screen>
  );
}
