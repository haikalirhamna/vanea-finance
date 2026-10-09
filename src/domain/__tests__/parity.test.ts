/**
 * The TypeScript domain must reproduce the Python reference implementation
 * (docs/simulation/salary_engine_simulation.py) exactly.
 * Regenerate fixtures: python3 docs/simulation/salary_engine_simulation.py --export-fixtures <this folder>/fixtures/parity.json
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { addMonths } from '../calendar';
import { amountsOf } from '../income-history';
import { monthlyCommitment } from '../pool';
import { recommendSalary } from '../salary-recommendation';
import { anchorFromMonthsSince, evaluateRaise } from '../salary-review';
import { assessPressure } from '../salary-pressure';
import { median } from '../statistics';
import { series } from './helpers/builders';

interface Fixtures {
  raise: { amounts: number[]; salary: number; pool: number; monthsSinceChange: number; status: string; newSalary: number | null }[];
  recommend: { amounts: number[]; pool: number; recommended: number | null }[];
  lifecycle: { series: number[]; actOnWarnings: boolean; raises: number; shortfallMonths: number; salaryRatio: number }[];
}

const fixtures: Fixtures = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'parity.json'), 'utf8'));
const START = '2020-01';

function evaluate(amounts: number[], salary: number, pool: number, monthsSinceChange: number) {
  const months = series(START, amounts);
  const lastMonth = months[months.length - 1]!.month;
  return evaluateRaise({
    series: months,
    currentSalary: salary,
    pool,
    anchorPeriod: anchorFromMonthsSince(lastMonth, monthsSinceChange),
  });
}

/** The Python `run()` loop, rebuilt from the domain functions. */
function simulate(allIncome: number[], actOnWarnings: boolean) {
  const history = allIncome.slice(0, 12);
  let pool = Math.trunc(median(history));
  let salary = recommendSalary(history, pool)!.amount;
  const initial = salary;
  let monthsSince = 0;
  let raises = 0;
  let shortfallMonths = 0;
  for (const income of allIncome.slice(12)) {
    pool += income;
    history.push(income);
    monthsSince += 1;
    if (pool < salary) shortfallMonths += 1;
    pool -= Math.min(salary, pool);

    const evaluation = evaluate(history, salary, pool, monthsSince);
    if (evaluation.status === 'ELIGIBLE') {
      salary = evaluation.maxNewSalary!;
      monthsSince = 0;
      raises += 1;
    }
    if (actOnWarnings) {
      const pressure = assessPressure({ amounts: history, salary, pool, commitment: monthlyCommitment(salary, []) });
      if (pressure.safeSalary !== null) salary = pressure.safeSalary;
    }
  }
  return { raises, shortfallMonths, salaryRatio: salary / initial };
}

describe('parity with the Python reference implementation', () => {
  it('has fixtures', () => {
    expect(fixtures.raise.length).toBeGreaterThan(500);
    expect(fixtures.lifecycle.length).toBeGreaterThan(200);
  });

  it('recommends the same salary', () => {
    for (const c of fixtures.recommend) {
      expect(recommendSalary(c.amounts, c.pool)?.amount ?? null).toBe(c.recommended);
    }
  });

  it('evaluates raise eligibility identically', () => {
    for (const c of fixtures.raise) {
      const result = evaluate(c.amounts, c.salary, c.pool, c.monthsSinceChange);
      expect({ status: result.status, newSalary: result.maxNewSalary ?? null }).toEqual({
        status: c.status,
        newSalary: c.newSalary,
      });
    }
  });

  it('reproduces 24-month lifecycles (raises, shortfalls and final salary)', () => {
    for (const c of fixtures.lifecycle) {
      const result = simulate(c.series, c.actOnWarnings);
      expect(result.raises).toBe(c.raises);
      expect(result.shortfallMonths).toBe(c.shortfallMonths);
      expect(result.salaryRatio).toBeCloseTo(c.salaryRatio, 9);
    }
  });

  it('uses the same amounts the engine sees', () => {
    expect(amountsOf(series(START, [1, 2, 3]))).toEqual([1, 2, 3]);
    expect(addMonths(START, 1)).toBe('2020-02');
  });
});
