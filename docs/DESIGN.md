# Vanea — Design System & UX Direction

**Version:** 2.0
**Status:** Draft for review
**Last updated:** 2026-10-09

The visual design is rebuilt around the product philosophy: a calm decision partner, not a recorder.

---

## 1. Design Goal

Vanea should feel calm, premium, editorial, focused, trustworthy, deliberate and financially disciplined.

Avoid: generic fintech dashboards, colorful budgeting games, SaaS admin panels, spreadsheet-like mobile UI, chart-heavy financial terminals.

---

## 2. Primary Visual Principle

```text
ONE NUMBER → CONTEXT → DECISION → ACTION
```

The dominant number is **Available Spending**, never total wealth. Every secondary number must earn its place by answering "so what?".

---

## 3. Voice, Copy & Formatting

### 3.1 Voice

- English, plain, second person ("your Pool", "you may").
- Calm and factual. State what happened, why, and what the user can do.
- Never moralize ("you overspent again!"), never celebrate spending, never pressure ("raise your salary now!").
- Short sentences. One idea per sentence.

### 3.2 Terminology

| Use | Never use in UI |
|---|---|
| Pool | Business account, treasury, ledger |
| Salary, pay yourself | Draw, distribution, payroll |
| Available Spending | Balance, wallet, budget |
| Business cost, subscription | Operating expense, OPEX |
| Salary advance | Self-loan, debt, credit |
| Typical income | Baseline, median |
| Usual swing | Volatility, MAD, standard deviation |
| Runway, "covers N months" | Burn rate |
| Salary review | Score, rating, earning capacity index |

### 3.3 Numbers

All numbers use Indonesian formatting, because every amount is in rupiah:

| Kind | Format | Example |
|---|---|---|
| Money | `Rp` + space + dot-grouped integer | `Rp 4.250.000` |
| Negative money | Minus sign before `Rp` | `−Rp 300.000` |
| Months / ratios | One decimal at most, comma decimal | `2,8 months` |
| Percent | Whole numbers | `5%` |
| Dates | Day, short month, optional year | `25 Oct`, `25 Oct 2026` |

- Use **tabular figures** for all amounts.
- **Full amounts only.** No compact notation (`Rp 5,4M`, `5.4jt`) in v1.
- No fake precision: no decimals on money, no more than one decimal on anything else.

---

## 4. Dashboard

### 4.1 Normal state

```text
AVAILABLE SPENDING
Rp 4.250.000
Rp 141.000 a day until 25 Oct

Salary              Pool
Rp 8.000.000        Rp 14.000.000
                    Covers 1,6 months

[ + Expense ]   [ + Income ]

Recent spending
  Groceries · Needs                 Rp 230.000
  Coffee · Wants                     Rp 45.000

October reflection →
```

- The hero number and the daily allowance are the only large elements.
- "Covers 1,6 months" is the runway (Pool ÷ salary and subscriptions).
- The two primary actions sit within thumb reach at the bottom of the screen.

### 4.2 States

| State | Hero area shows |
|---|---|
| Overspent | `−Rp 300.000` · "You've spent Rp 300.000 more than your salary. Your next salary will cover it." No red background; a single neutral-warning accent on the amount. |
| Salary due | "Payday today · Pay yourself Rp 8.000.000" with a **Pay salary** button above the hero. |
| Pool too small for full salary | Same as Salary due, plus "Your Pool can pay Rp 3.500.000 of it." |
| Pace ahead | One line under the daily allowance: "You've used 62% of this period's money; 40% of the period has passed." |
| Salary pressure | A single card below Salary/Pool (§6.4). Never more than one card at a time. |
| Raise eligible | A quiet line in the Salary block: "Salary review available". No badge, no color, no notification. |

---

## 5. Onboarding

Order: Welcome → Payday → Income history → Current money → Subscriptions → Salary recommendation → Privacy & backup → Dashboard.

- One question per screen. Every step except Payday and Current money can be skipped.
- Income history is a simple list of months (newest first) with one amount field each, labeled "after business costs".
- Current money is split into four fields with short explanations: Pool ("income you haven't paid yourself yet"), Available Spending ("money for your personal spending"), Savings, Investments.
- The privacy screen states plainly: "Your data lives only on this phone. If you uninstall Vanea or lose your phone without a backup, it's gone."

---

## 6. Salary Screens

### 6.1 Recommendation

```text
RECOMMENDED SALARY
Rp 5.300.000

Why this amount
If your 3 weakest months (Rp 3.000.000, Rp 4.000.000, Rp 4.000.000)
came back-to-back, your Pool of Rp 5.000.000 plus that income
could still pay Rp 5.300.000 for 3 months.

Based on 6 months of income. More history makes this more reliable.

[ Use Rp 5.300.000 ]
[ Choose another amount ]
```

Choosing an amount above the recommendation shows a disclosure before confirming:

> **At Rp 6.500.000, your Pool could run out.** If your weakest months repeat, your Pool would be empty in month 2. You can still choose this amount.

### 6.2 Salary review

Evidence is shown as real amounts and months — never scores.

**Eligible**

```text
SALARY REVIEW

Your income has moved up and held there.

Typical income before        Rp 5.300.000
Last 3 months                Rp 6.000.000 · Rp 6.200.000 · Rp 6.400.000
Needed each month            Rp 5.618.000 or more
Same months last year        Rp 5.400.000
Your Pool can support it     Yes, even if your weakest months return

You may increase your salary by up to Rp 250.000 (5%).

[ Increase to Rp 5.250.000 ]
[ Choose a smaller increase ]
[ Keep Rp 5.000.000 ]
```

**Not eligible** — one message per status:

| Status | Message |
|---|---|
| `INSUFFICIENT_DATA` | "We need at least 6 months of income to review your salary. You have 4." |
| `COOLDOWN` | "Your salary changed recently. We'll review it after three full months at this level — in February." |
| `OBSERVING` | "Your income hasn't stayed clearly above its usual level yet. Each of the last 3 months needs to be at least Rp 5.618.000. Your lowest was Rp 5.200.000." |
| `OBSERVING` (volatile) | Adds: "Your income usually moves about 30% from month to month, so an increase needs to be larger than that to count." |
| `SEASONAL_PATTERN` | "This looks like last year's pattern. These same months last year brought Rp 9.800.000 — about the same as now." |
| `NOT_AFFORDABLE` | "Your income is higher, but your Pool can't yet support a 5% raise if your weaker months return." |

### 6.3 Decrease and restore

- Decrease: amount field → impact preview ("Daily allowance after next payday: Rp 120.000 · Runway: 2,1 months") → confirm.
- If a restore ceiling exists: "You can return to Rp 5.000.000 at any time — you paid yourself that in the last 12 months."

### 6.4 Salary pressure card

| Level | Card |
|---|---|
| `THIN_BUFFER` | "Your Pool covers less than one month of salary." (one line, no card) |
| `INFO` | "Your salary is above your typical income of the last 3 months (Rp 4.600.000). At this pace your Pool lasts about 9 months." (one line, no card) |
| `ATTENTION` | Card: "Your Pool may run out in about 5 months." + evidence + "A salary of Rp 4.300.000 would be sustainable." + **Review salary** / **Not now** |
| `SERIOUS` | Same card, wording "in about 2 months". |

Calm typography; one accent color for `ATTENTION` and `SERIOUS`. Never flashing, never full-screen.

### 6.5 Pay salary

```text
PAY SALARY · OCTOBER

Salary                       Rp 8.000.000
Salary advance repayment    −Rp 1.000.000
You receive                  Rp 7.000.000

Pool after payment           Rp 7.000.000

[ Record payment ]
```

Copy reminds the user that Vanea records, it doesn't transfer: "Move the money in your bank app, then record it here."

---

## 7. Reflection & Intention

### 7.1 Start of month — intention

```text
OCTOBER
What do you want to set aside this month?
Rp [            ]

Limit for Wants (optional)
Rp [            ]
```

### 7.2 End of month — reflection

```text
SEPTEMBER REFLECTION

How much did I receive?          Rp 8.000.000
How much did I want to set aside? Rp 1.000.000
How much did I spend?            Rp 6.700.000
  Needs        Rp 3.900.000
  Wants        Rp 1.600.000
  Growth         Rp 600.000
  Unexpected     Rp 600.000
How much did I set aside?        Rp 900.000

Worth noticing
Wants rose from Rp 1.200.000 to Rp 1.600.000 compared with your last 3 months.

How can I improve?
[ free text ]

Notes for each category (optional)
```

- No score, no grade, no streak.
- At most two "Worth noticing" items.
- Intention vs actual is shown as two plain amounts, never as a percentage bar.

---

## 8. Visual Language

### Typography

Numerical readability first: tabular figures, clear size hierarchy (hero amount ≫ section amounts ≫ body), editorial character in headings.

### Color

- Restrained neutral base, one primary accent.
- One semantic warning tone for overspent, `ATTENTION` and `SERIOUS`. No red/green money coloring.
- **Category colors are not used.** Categories are identified by label.
- Light and dark themes, following the system setting.

### Surfaces

Open space, typography and minimal dividers. Group meaningfully. Avoid stacked cards; at most one card on the dashboard (salary pressure).

---

## 9. Interaction Principles

- Awareness before action.
- Explain every consequential decision before it is confirmed.
- Vanea recommends; the user decides.
- Never refuse a real-world record; warn instead.
- Progressive disclosure: "Why this amount" and evidence are one tap away, not hidden.
- No dark patterns. The "decline" option is as visible as "accept".
- Never pressure users to raise their salary, save, invest or reach a Pool target.

---

## 10. Notifications

Local only. Short, factual, and never urgent in tone.

| Notification | Copy |
|---|---|
| Payday | "Payday. Pay yourself Rp 8.000.000 when you're ready." |
| Subscription due | "Figma renews today: Rp 225.000. Tap to record it." |
| New month | "September is done. Take a minute to reflect and set October's intention." |
| Salary pressure (`SERIOUS`) | "Your Pool may run out in about 2 months. Open Vanea to review your salary." |
| Backup | "Your last backup was 34 days ago. Export one to keep your data safe." |

There is no notification for raise eligibility.

---

## 11. Motion

Motion communicates state changes, confirmation, progress or navigation. It never decorates financial information. Respect the system "remove animations" setting.

---

## 12. Error States

Every error explains (1) what happened, (2) why, and (3) what the user can do.

> **Not enough in your Pool**
> You want to pay yourself Rp 5.000.000, but your Pool has Rp 3.500.000.
> You can pay Rp 3.500.000 now and the rest later this period if more income arrives.

> **Can't remove this income**
> Removing it would leave your Pool short by Rp 1.200.000, because part of it has already been paid as salary.
> Vanea will recover the Rp 1.200.000 from your next 3 salaries as a salary advance. You can change the number of periods.

> **Backup couldn't be opened**
> The passphrase doesn't match this file.
> Check the passphrase and try again. Vanea can't recover a forgotten passphrase.

---

## 13. Visual Anti-patterns

Avoid: excessive cards, rainbow category colors, large chart collections, gamified scores, fake precision, compact money notation, dense tables as default, constant warning colors, accounting terminology in the UI.

---

## 14. Accessibility

- WCAG AA contrast in both themes.
- Font scaling up to 200% without clipping amounts; amounts may wrap below their labels.
- Touch targets ≥ 48 dp.
- TalkBack labels read money naturally: "Available spending, 4 million 250 thousand rupiah".
- Meaning is never conveyed by color alone (overspent state also uses the minus sign and text).

---

## 15. Android Behavior

- Thumb-reach primary actions; numeric keypad with live thousands separators for amount fields.
- System back always works and never discards a filled form without confirmation.
- Edge-to-edge layout respecting system insets.
- Do not impose arbitrary tap-count rules when a longer flow materially improves comprehension or safety (salary decisions, imports, reversals).
