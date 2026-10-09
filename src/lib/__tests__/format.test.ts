import {
  formatDate, formatDecimal, formatMoney, formatMoneyDigits, formatMoneyInput, formatMonth, formatMonthName,
  formatMonthsCount, formatPercent, parseMoneyInput, speakMoney,
} from '../format';

describe('money', () => {
  it('formats rupiah with dot grouping and no decimals (DESIGN §3.3)', () => {
    expect(formatMoney(4_250_000)).toBe('Rp 4.250.000');
    expect(formatMoney(0)).toBe('Rp 0');
    expect(formatMoney(999)).toBe('Rp 999');
    expect(formatMoney(1_000)).toBe('Rp 1.000');
    expect(formatMoney(12_345_678_901)).toBe('Rp 12.345.678.901');
  });

  it('puts the minus before Rp', () => {
    expect(formatMoney(-300_000)).toBe('−Rp 300.000');
    expect(formatMoneyDigits(-300_000)).toBe('−300.000');
    expect(formatMoneyDigits(8_000_000)).toBe('8.000.000');
  });

  it('parses and formats typed digits live, ignoring any other characters', () => {
    expect(parseMoneyInput('4.250.000')).toBe(4_250_000);
    expect(parseMoneyInput('Rp 4,250,000')).toBe(4_250_000);
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(formatMoneyInput('4250000')).toBe('4.250.000');
    expect(formatMoneyInput('4.25')).toBe('425');
    expect(formatMoneyInput('')).toBe('');
  });

  it('reads money aloud naturally', () => {
    expect(speakMoney(4_250_000)).toBe('4 million 250 thousand rupiah');
    expect(speakMoney(1_000_000)).toBe('1 million rupiah');
    expect(speakMoney(45_000)).toBe('45 thousand rupiah');
    expect(speakMoney(0)).toBe('0 rupiah');
    expect(speakMoney(-300_000)).toBe('minus 300 thousand rupiah');
    expect(speakMoney(1_000_450)).toBe('1 million 450 rupiah');
  });
});

describe('numbers', () => {
  it('uses one decimal at most with a comma', () => {
    expect(formatDecimal(2.8)).toBe('2,8');
    expect(formatDecimal(2.84)).toBe('2,8');
    expect(formatDecimal(2.96)).toBe('3');
    expect(formatDecimal(1)).toBe('1');
    expect(formatMonthsCount(2.8)).toBe('2,8 months');
    expect(formatMonthsCount(1)).toBe('1 month');
    expect(formatMonthsCount(0)).toBe('0 months');
  });

  it('shows whole percents', () => {
    expect(formatPercent(0.62)).toBe('62%');
    expect(formatPercent(0.375)).toBe('38%');
  });
});

describe('dates', () => {
  it('shows day and short month, with the year when asked', () => {
    expect(formatDate('2026-10-25')).toBe('25 Oct');
    expect(formatDate('2026-01-05')).toBe('5 Jan');
    expect(formatDate('2026-10-25', true)).toBe('25 Oct 2026');
  });

  it('names months', () => {
    expect(formatMonth('2026-10')).toBe('Oct 2026');
    expect(formatMonthName('2026-09')).toBe('September');
  });
});
