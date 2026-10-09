import { monthGrid } from '../calendar-grid';

describe('monthGrid', () => {
  it('starts weeks on Monday and pads with nulls', () => {
    // 1 Oct 2026 is a Thursday.
    const grid = monthGrid('2026-10');
    expect(grid[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(grid[1]).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(grid.at(-1)).toEqual([26, 27, 28, 29, 30, 31, null]);
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it('puts a Monday the 1st in the first column', () => {
    // 1 Jun 2026 is a Monday.
    expect(monthGrid('2026-06')[0]![0]).toBe(1);
  });

  it('handles a Sunday the 1st and February in a leap year', () => {
    // 1 Feb 2026 is a Sunday; 1 Feb 2028 is a Tuesday with 29 days.
    expect(monthGrid('2026-02')[0]).toEqual([null, null, null, null, null, null, 1]);
    const leap = monthGrid('2028-02').flat().filter((day): day is number => day !== null);
    expect(leap).toHaveLength(29);
  });
});
