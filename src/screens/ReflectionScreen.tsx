/** End-of-month Kakeibo reflection: the numbers are filled in, the learning is yours (DESIGN §7.2). No score. */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DuoCard, DuoRow } from '@/components/Cards';
import { FormFrame } from '@/components/FormFrame';
import { TextField } from '@/components/Fields';
import { KeyValue, Note, SectionHeader } from '@/components/Rows';
import { space, useTheme } from '@/components/theme';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '@/domain/ledger-types';
import { ReflectionNotes } from '@/data/reflections';
import { saveReflection } from '@/features/reflection/reflection-actions';
import { ReflectionFigures, figuresFor, savedFigures } from '@/features/reflection/reflection-summary';
import { formatMoney, formatMonthName } from '@/lib/format';
import { useApp } from '@/state/AppState';

const WORDS: Record<ExpenseCategory, string> = { needs: 'Needs', wants: 'Wants', growth: 'Growth', unexpected: 'Unexpected' };
const NOTE_KEYS = { needs: 'needsNote', wants: 'wantsNote', growth: 'growthNote', unexpected: 'unexpectedNote' } as const;

function CategoryBars({ figures }: { figures: ReflectionFigures }) {
  const { colors } = useTheme();
  const { spent, totalSpent } = figures.summary;
  return (
    <View style={styles.bars}>
      {EXPENSE_CATEGORIES.map((category) => (
        <View key={category} style={styles.barRow} accessible accessibilityLabel={`${WORDS[category]}, ${formatMoney(spent[category])}`}>
          <AppText variant="body" style={styles.barLabel}>{WORDS[category]}</AppText>
          <View style={[styles.track, { backgroundColor: colors.field }]}>
            <View style={[styles.fill, { backgroundColor: colors.accent, width: `${totalSpent === 0 ? 0 : Math.round((spent[category] / totalSpent) * 100)}%` }]} />
          </View>
          <AppText variant="amount" numeric style={styles.barAmount}>{formatMoney(spent[category])}</AppText>
        </View>
      ))}
    </View>
  );
}

function Figures({ figures }: { figures: ReflectionFigures }) {
  const { summary, intention, highlights, lines } = figures;
  return (
    <>
      <DuoRow>
        <DuoCard variant="deep" icon="arrowDown" label="Received" amount={summary.received} />
        <DuoCard variant="vivid" icon="arrowUp" label="Spent" amount={summary.totalSpent} />
      </DuoRow>
      {intention ? (
        <View style={styles.block}>
          <KeyValue label="How much did I want to set aside?" value={formatMoney(intention.setAsideIntended)} />
          <KeyValue label="How much did I set aside?" value={formatMoney(intention.setAsideActual)} />
          {intention.wantsLimit !== null ? <KeyValue label="Limit for Wants" value={`${formatMoney(intention.wantsSpent)} of ${formatMoney(intention.wantsLimit)}`} /> : null}
        </View>
      ) : <View style={styles.block}><KeyValue label="How much did I set aside?" value={formatMoney(summary.setAside)} /></View>}
      <SectionHeader title="How much did I spend?" />
      <CategoryBars figures={figures} />
      {highlights.length > 0 ? <SectionHeader title="Worth noticing" /> : null}
      <View style={styles.block}>
        {highlights.map((h) => (
          <AppText key={h.category} variant="body">
            {h.isNewSpending
              ? `${WORDS[h.category]} is new: ${formatMoney(h.current)} compared with nothing in your last 3 months.`
              : `${WORDS[h.category]} ${h.delta > 0 ? 'rose' : 'fell'} from ${formatMoney(h.average)} to ${formatMoney(h.current)} compared with your last 3 months.`}
          </AppText>
        ))}
      </View>
      <SectionHeader title="Debts and investments, apart from spending" />
      <View style={styles.block}>
        <KeyValue label="Debt payments" value={formatMoney(lines.debtPayments)} />
        <KeyValue label="Cost of borrowing" value={formatMoney(lines.costOfBorrowing)} />
        <KeyValue label="Investment income" value={formatMoney(lines.investmentIncome)} />
        <KeyValue label="Realized gains or losses" value={formatMoney(lines.realizedGains)} />
      </View>
    </>
  );
}

function SavedNotes({ notes }: { notes: ReflectionNotes }) {
  const rows = [['How can I improve?', notes.improveNote], ...EXPENSE_CATEGORIES.map((c) => [WORDS[c], notes[NOTE_KEYS[c]]])] as [string, string | undefined][];
  return (
    <View style={styles.block}>
      {rows.filter(([, text]) => text).map(([label, text]) => (
        <View key={label}><AppText variant="caption" tone="secondary">{label}</AppText><AppText variant="body">{text}</AppText></View>
      ))}
    </View>
  );
}

export function ReflectionScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const { snapshot, act } = useApp();
  const saved = snapshot.reflections.find((r) => r.month === month && r.completedAt);
  const figures = useMemo(() => (saved ? savedFigures(saved.summarySnapshotJson) : figuresFor(snapshot, month!)), [saved, snapshot, month]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const set = (key: string) => (value: string) => setNotes((current) => ({ ...current, [key]: value }));
  return (
    <FormFrame
      title={`${formatMonthName(month!)} reflection`}
      subtitle={saved ? 'Saved with the numbers as they were.' : undefined}
      submitLabel={saved ? 'Done' : 'Save reflection'}
      onSubmit={async () => (saved ? { ok: true as const, value: undefined } : act((ctx) => saveReflection(ctx, { month: month!, notes: notes as ReflectionNotes })))}
    >
      <Figures figures={figures} />
      {saved ? <SavedNotes notes={saved} /> : (
        <>
          <TextField label="How can I improve?" value={notes.improveNote ?? ''} onChangeText={set('improveNote')} multiline />
          {EXPENSE_CATEGORIES.map((c) => <TextField key={c} label={`${WORDS[c]} (optional)`} value={notes[NOTE_KEYS[c]] ?? ''} onChangeText={set(NOTE_KEYS[c])} />)}
          <Note>There is no score. Notice, then decide what you'd do differently.</Note>
        </>
      )}
    </FormFrame>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  bars: { gap: space.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  barLabel: { width: 92 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  barAmount: { width: 112, textAlign: 'right' },
});
