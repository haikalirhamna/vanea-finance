"""Vanea salary engine simulation.

Reference implementation of the salary-engine rules in SYSTEM-OVERVIEW.md §5,
plus the original v1 rule it replaced, run against synthetic income histories.

Run:  python3 docs/simulation/salary_engine_simulation.py

All money is integer rupiah. The script prints Markdown tables; the results
quoted in SYSTEM-OVERVIEW.md §5.8 come from this script with the default seed.
"""

import math
import random
from statistics import median

# ---------------------------------------------------------------------------
# Configuration (mirrors SYSTEM-OVERVIEW.md §5.1)
# ---------------------------------------------------------------------------
SAFETY_MARGIN = 0.05          # recommendation never exceeds 95% of mean net income
WINDOW_MONTHS = 12            # months considered by recommendation / affordability
RECOMMEND_ROUNDING = 50_000   # recommendation rounded down to this
RAISE_ROUNDING = 10_000       # raise amount rounded down to this
MAX_RAISE = 0.05              # max raise per adjustment
MIN_SHIFT = 0.05              # minimum baseline shift
SWING_MULTIPLIER = 1.5        # shift must exceed 1.5x the usual swing
RECENT_MONTHS = 3             # evidence window
MIN_DATA_MONTHS = 6           # gate 1
REFERENCE_MAX_MONTHS = 12     # reference baseline window
WARNING_ATTENTION_MONTHS = 6  # salary pressure "attention" level


def floor_to(value, step):
    return int(value // step * step)


# ---------------------------------------------------------------------------
# Domain functions (SYSTEM-OVERVIEW.md §5)
# ---------------------------------------------------------------------------
def sustainable_salary(months, pool):
    """§5.3 Worst-case sustainable salary (unrounded).

    Largest salary such that, if the worst months of the window arrived
    back-to-back starting today, Pool + income would still cover it, capped at
    95% of mean net income so the Pool is not consumed over time.
    """
    window = months[-WINDOW_MONTHS:]
    cap = (1 - SAFETY_MARGIN) * sum(window) / len(window)
    best = cap
    cumulative = 0
    for k, amount in enumerate(sorted(window), start=1):
        cumulative += amount
        best = min(best, (pool + cumulative) / k)
    return max(0.0, best)


def recommend_salary(months, pool):
    """§5.3 Initial / safe salary recommendation, or None with < 3 months."""
    if len(months) < 3:
        return None
    return floor_to(sustainable_salary(months, pool), RECOMMEND_ROUNDING)


def relative_spread(values):
    """Median absolute deviation divided by the median ("usual swing")."""
    mid = median(values)
    if mid <= 0:
        return 1.0
    return median(abs(v - mid) for v in values) / mid


def evaluate_raise(months, salary, pool, months_since_change):
    """§5.4 Raise eligibility. Returns (status, max_new_salary)."""
    if len(months) < MIN_DATA_MONTHS:
        return "INSUFFICIENT_DATA", None
    if months_since_change < RECENT_MONTHS:
        return "COOLDOWN", None

    recent = months[-RECENT_MONTHS:]
    reference_window = months[:-RECENT_MONTHS][-REFERENCE_MAX_MONTHS:]
    reference = median(reference_window)
    threshold = max(MIN_SHIFT, SWING_MULTIPLIER * relative_spread(reference_window))
    if min(recent) < reference * (1 + threshold):
        return "OBSERVING", None

    if len(months) >= 12 + RECENT_MONTHS:
        same_months_last_year = months[-12 - RECENT_MONTHS:-12]
        if median(recent) < (1 + MIN_SHIFT) * median(same_months_last_year):
            return "SEASONAL_PATTERN", None

    if sustainable_salary(months, pool) < salary * (1 + MAX_RAISE):
        return "NOT_AFFORDABLE", None
    return "ELIGIBLE", salary + floor_to(salary * MAX_RAISE, RAISE_ROUNDING)


def prd_v1_eligible(months):
    """Original PRD v1 rule: median(last 3) >= 1.05 x median(previous 3)."""
    if len(months) < 6:
        return False
    return median(months[-3:]) >= 1.05 * median(months[-6:-3])


# ---------------------------------------------------------------------------
# Synthetic income scenarios (net income per month, rupiah)
# ---------------------------------------------------------------------------
BASE = 5_000_000
SEASON = [0.8, 0.8, 0.9, 1.0, 1.0, 1.9, 2.0, 1.0, 0.9, 0.8, 0.8, 1.1]
HISTORY_MONTHS = 12
LIVE_MONTHS = 24


def _noise(sd):
    return max(0.0, random.gauss(1, sd))


def generate(kind, n=HISTORY_MONTHS + LIVE_MONTHS):
    if kind == "Stable":
        series = [BASE * _noise(0.08) for _ in range(n)]
    elif kind == "Volatile":
        series = [BASE * math.exp(random.gauss(0, 0.45)) for _ in range(n)]
    elif kind == "Seasonal":
        series = [BASE * SEASON[i % 12] * _noise(0.08) for i in range(n)]
    elif kind == "One-off spike":
        series = [BASE * _noise(0.08) for _ in range(n)]
        series[random.randint(HISTORY_MONTHS, n - 1)] *= 3
    elif kind == "Declining":
        series = [BASE * 0.985 ** max(0, i - 11) * _noise(0.08) for i in range(n)]
    elif kind == "Step +20%":
        series = [BASE * (1.2 if i >= 16 else 1) * _noise(0.08) for i in range(n)]
    elif kind == "Step +8%":
        series = [BASE * (1.08 if i >= 16 else 1) * _noise(0.08) for i in range(n)]
    elif kind == "Gradual growth":
        series = [BASE * 1.015 ** max(0, i - 11) * _noise(0.08) for i in range(n)]
    elif kind == "Step +20%, volatile":
        series = [BASE * (1.2 if i >= 16 else 1) * math.exp(random.gauss(0, 0.3)) for i in range(n)]
    else:
        raise ValueError(kind)
    return [int(x) for x in series]


SCENARIOS = [
    ("Stable", False), ("One-off spike", False), ("Seasonal", False),
    ("Volatile", False), ("Declining", False), ("Step +20%", True),
    ("Step +8%", True), ("Gradual growth", True), ("Step +20%, volatile", True),
]


# ---------------------------------------------------------------------------
# Lifecycle simulation
# ---------------------------------------------------------------------------
def run(series, engine, act_on_warnings=False):
    """12 months of history at onboarding, then 24 live months.

    Each live month: net income enters the Pool, salary is paid (capped by
    Pool), then the raise rule is evaluated. The user ALWAYS accepts the
    maximum raise (worst case). With act_on_warnings, the user lowers salary
    to the safe recommendation when salary pressure reaches "attention".
    """
    history = series[:HISTORY_MONTHS]
    pool = int(median(history))                   # opening Pool = one typical month
    salary = recommend_salary(history, pool)
    initial = salary
    months_since_change = 0
    raises = 0
    shortfall_months = 0
    for income in series[HISTORY_MONTHS:]:
        pool += income
        history = history + [income]
        months_since_change += 1
        if pool < salary:
            shortfall_months += 1
        pool -= min(salary, pool)

        if engine == "vanea":
            status, new_salary = evaluate_raise(history, salary, pool, months_since_change)
            if status == "ELIGIBLE":
                salary, months_since_change, raises = new_salary, 0, raises + 1
        elif engine == "prd_v1":
            if prd_v1_eligible(history):
                salary, raises = int(salary * 1.05), raises + 1

        if act_on_warnings:
            typical = median(history[-3:])
            if salary > typical and pool / (salary - typical) <= WARNING_ATTENTION_MONTHS:
                safe = recommend_salary(history, pool)
                if safe is not None and safe < salary:
                    salary = safe  # a decrease does not reset the cooldown (§5.5)
    return raises, shortfall_months, salary / initial


def pct(part, whole):
    return f"{part / whole * 100:.0f}%"


def main(seed=11, n=2000):
    random.seed(seed)
    print("### Fixed examples (gate 3 shift + gate 4 seasonal only)\n")
    print("| Series (Rp million) | PRD v1 | Vanea shift/seasonal gates |")
    print("|---|---|---|")
    examples = {
        "Growth 5, 5.3, 5.7, 6, 6.2, 6.4": [5, 5.3, 5.7, 6, 6.2, 6.4],
        "One-off spike 5, 5.2, 5.1, 15, 5.3, 5.2": [5, 5.2, 5.1, 15, 5.3, 5.2],
        "Volatile 4, 10, 3, 9, 4, 11": [4, 10, 3, 9, 4, 11],
        "Seasonal, 6 months 4, 4, 5, 10, 11, 5": [4, 4, 5, 10, 11, 5],
        "Seasonal, 12 months (same pattern twice)": [4, 4, 5, 10, 11, 5] * 2,
        "Declining 8, 7.5, 7, 6.5, 6, 5.5": [8, 7.5, 7, 6.5, 6, 5.5],
    }
    for label, values in examples.items():
        months = [int(v * 1_000_000) for v in values]
        # Huge Pool and low salary isolate the shift/seasonal gates from affordability.
        status, _ = evaluate_raise(months, 1_000_000, 10**12, months_since_change=99)
        v1 = "eligible" if prd_v1_eligible(months) else "not eligible"
        print(f"| {label} | {v1} | {'eligible' if status == 'ELIGIBLE' else status} |")

    print(f"\n### Lifecycle simulation ({n} histories per scenario, 24 live months)\n")
    print("| Scenario | Should raise? | No raises: shortfall | PRD v1: any raise | PRD v1: shortfall "
          "| Vanea: any raise | Vanea: avg raises | Vanea: salary change | Vanea: shortfall |")
    print("|---|---|---|---|---|---|---|---|---|")
    for kind, should_raise in SCENARIOS:
        histories = [generate(kind) for _ in range(n)]
        none = [run(h, "none") for h in histories]
        v1 = [run(h, "prd_v1") for h in histories]
        va = [run(h, "vanea") for h in histories]
        print(
            f"| {kind} | {'yes' if should_raise else 'no'} "
            f"| {pct(sum(r[1] > 0 for r in none), n)} "
            f"| {pct(sum(r[0] > 0 for r in v1), n)} | {pct(sum(r[1] > 0 for r in v1), n)} "
            f"| {pct(sum(r[0] > 0 for r in va), n)} | {sum(r[0] for r in va) / n:.2f} "
            f"| {(sum(r[2] for r in va) / n - 1) * 100:+.0f}% | {pct(sum(r[1] > 0 for r in va), n)} |"
        )

    print("\n### Salary pressure warning (Vanea engine)\n")
    print("| Scenario | Ignores warnings: shortfall | Acts on 'attention': shortfall |")
    print("|---|---|---|")
    for kind in ["Declining", "Volatile", "Stable"]:
        histories = [generate(kind) for _ in range(n)]
        ignore = [run(h, "vanea") for h in histories]
        act = [run(h, "vanea", act_on_warnings=True) for h in histories]
        print(f"| {kind} | {pct(sum(r[1] > 0 for r in ignore), n)} | {pct(sum(r[1] > 0 for r in act), n)} |")
    print("\nShortfall = share of histories where the Pool could not fund the full salary at least once.")


if __name__ == "__main__":
    main()
