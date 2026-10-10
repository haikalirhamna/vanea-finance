/** Past months: reflect on one, or read a saved reflection (PRD REF-6). */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/Buttons';
import { ListRow, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { space } from '@/components/theme';
import { pastMonths } from '@/features/reflection/reflection-summary';
import { formatMonth } from '@/lib/format';
import { useApp } from '@/state/AppState';

export function ReflectionsScreen() {
  const { snapshot, today } = useApp();
  const router = useRouter();
  const months = pastMonths(snapshot, today);
  return (
    <Screen>
      <HeroCanvas>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Reflections</AppText>
        </View>
      </HeroCanvas>
      <ContentSheet style={{ paddingTop: space.lg, paddingBottom: space.giant }}>
        {months.length === 0 ? <Note>Your first month hasn't ended yet. Come back next month.</Note> : null}
        {months.map((month, index) => {
          const done = snapshot.reflections.some((r) => r.month === month && r.completedAt);
          return (
            <ListRow key={month} icon="calendar" title={formatMonth(month)} subtitle={done ? 'Saved' : 'Not yet reflected on'}
              onPress={() => router.push({ pathname: '/reflection', params: { month } })} divider={index < months.length - 1} />
          );
        })}
      </ContentSheet>
    </Screen>
  );
}
