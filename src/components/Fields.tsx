/** Input fields: amount with live thousands separators, text, a choice with no default, and a date. */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { DateString, addMonths, dateInMonth, monthOf } from '@/domain/calendar';
import { WEEKDAYS, monthGrid } from '@/lib/calendar-grid';
import { formatDate, formatMonth, formatMoneyInput, parseMoneyInput } from '@/lib/format';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { fonts, radius, space, tabular, useTheme } from './theme';

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      {children}
      {hint ? <AppText variant="caption" tone="faint">{hint}</AppText> : null}
    </View>
  );
}

interface AmountProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  hint?: string;
  /** The big version for the main figure of a screen. */
  large?: boolean;
  autoFocus?: boolean;
}

/** Focus after the screen has finished sliding in: focusing mid-transition scrolls the page sideways on the web. */
const FOCUS_DELAY_MS = 450;

function useDelayedFocus(enabled: boolean | undefined) {
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setTimeout(() => input.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled]);
  return input;
}

export function AmountField({ label, value, onChange, hint, large, autoFocus }: AmountProps) {
  const { colors } = useTheme();
  const input = useDelayedFocus(autoFocus);
  const text = value === null ? '' : formatMoneyInput(String(value));
  return (
    <Labeled label={label} hint={hint}>
      <View style={[styles.input, { backgroundColor: colors.field }, large ? styles.inputLarge : null]}>
        <AppText variant={large ? 'amountLarge' : 'bodyStrong'} tone="faint">Rp</AppText>
        <TextInput
          ref={input}
          accessibilityLabel={label}
          value={text}
          onChangeText={(next) => onChange(parseMoneyInput(next))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.ink400}
          selectionColor={colors.accent}
          style={[styles.textInput, tabular, { color: colors.ink900, fontFamily: fonts.semibold, fontSize: large ? 32 : 18 }]}
        />
      </View>
    </Labeled>
  );
}

interface TextProps2 extends Pick<TextInputProps, 'autoCapitalize' | 'multiline' | 'keyboardType' | 'secureTextEntry'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
}

export function TextField({ label, value, onChangeText, placeholder, hint, multiline, ...rest }: TextProps2) {
  const { colors } = useTheme();
  return (
    <Labeled label={label} hint={hint}>
      <View style={[styles.input, { backgroundColor: colors.field }, multiline ? styles.multiline : null]}>
        <TextInput
          {...rest}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={colors.ink400}
          selectionColor={colors.accent}
          style={[styles.textInput, { color: colors.ink900, fontFamily: fonts.regular, fontSize: 16 }]}
        />
      </View>
    </Labeled>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  /** Null leaves every option unselected: used where there must be no default. */
  value: T | null;
  onChange: (value: T) => void;
  hint?: string;
}

export function Segmented<T extends string>({ label, options, value, onChange, hint }: SegmentedProps<T>) {
  const { colors } = useTheme();
  return (
    <Labeled label={label} hint={hint}>
      <View style={[styles.segmented, { borderColor: colors.line }]} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected ? { backgroundColor: colors.accentSoft } : null]}
            >
              <AppText variant="bodyStrong" style={{ color: selected ? colors.tileIcon : colors.ink600, fontSize: 14 }} numberOfLines={1}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </Labeled>
  );
}

interface DateProps {
  label: string;
  value: DateString;
  onChange: (value: DateString) => void;
  min?: DateString;
  max?: DateString;
}

export function DateField({ label, value, onChange, min, max }: DateProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Labeled label={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value, true)}`}
        onPress={() => setOpen(true)}
        style={[styles.input, { backgroundColor: colors.field }]}
      >
        <AppText variant="bodyStrong" style={styles.dateText}>{formatDate(value, true)}</AppText>
        <Icon name="calendar" size={20} color={colors.ink600} />
      </Pressable>
      <DatePickerSheet
        visible={open}
        value={value}
        min={min}
        max={max}
        onClose={() => setOpen(false)}
        onPick={(picked) => { onChange(picked); setOpen(false); }}
      />
    </Labeled>
  );
}

interface PickerProps {
  visible: boolean;
  value: DateString;
  min?: DateString;
  max?: DateString;
  onClose: () => void;
  onPick: (date: DateString) => void;
}

function DatePickerSheet({ visible, value, min, max, onClose, onPick }: PickerProps) {
  const { colors } = useTheme();
  const [month, setMonth] = useState(monthOf(value));
  const enabled = (date: DateString) => (!min || date >= min) && (!max || date <= max);
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.pickerHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(addMonths(month, -1))} hitSlop={12}>
          <Icon name="chevronLeft" color={colors.ink900} />
        </Pressable>
        <AppText variant="heading">{formatMonth(month)}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(addMonths(month, 1))} hitSlop={12}>
          <Icon name="chevronRight" color={colors.ink900} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => <AppText key={day} variant="caption" tone="faint" style={styles.cell}>{day}</AppText>)}
      </View>
      {monthGrid(month).map((week, index) => (
        <View key={index} style={styles.weekRow}>
          {week.map((day, cell) => <DayCell key={cell} day={day} month={month} selected={value} enabled={enabled} onPick={onPick} />)}
        </View>
      ))}
    </BottomSheet>
  );
}

function DayCell({ day, month, selected, enabled, onPick }: { day: number | null; month: string; selected: DateString; enabled: (date: DateString) => boolean; onPick: (date: DateString) => void }) {
  const { colors } = useTheme();
  if (day === null) return <View style={styles.cell} />;
  const date = dateInMonth(month, day);
  const isSelected = date === selected;
  const allowed = enabled(date);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={formatDate(date, true)}
      accessibilityState={{ selected: isSelected, disabled: !allowed }}
      disabled={!allowed}
      onPress={() => onPick(date)}
      style={[styles.cell, styles.day, isSelected ? { backgroundColor: colors.accent } : null, { opacity: allowed ? 1 : 0.3 }]}
    >
      <AppText variant="bodyStrong" numeric style={{ color: isSelected ? colors.onDeep : colors.ink900 }}>{day}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: { minHeight: 52, borderRadius: radius.sm, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inputLarge: { minHeight: 68 },
  multiline: { minHeight: 88, alignItems: 'flex-start', paddingTop: space.md },
  textInput: { flex: 1, minWidth: 0, outlineWidth: 0, paddingVertical: space.sm, minHeight: 48 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.full, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  dateText: { flex: 1 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  day: { borderRadius: radius.full },
});
