# Vanea — Product Requirements Document

**Version:** 2.0
**Status:** Draft for review
**Owner:** @haikalirhamna
**Last updated:** 2026-10-09

Related documents: [DESIGN](DESIGN.md) · [SCHEMA](SCHEMA.md) · [SYSTEM-OVERVIEW](SYSTEM-OVERVIEW.md) (exact algorithms) · [USER-FLOWS](USER-FLOWS.md)

---

## 1. Overview

Vanea is a local-first Android app for people with variable income. It separates unstable income from personal spending through a **self-determined salary**, and builds financial awareness through calm, explainable numbers and monthly Kakeibo reflection.

> **Vanea helps people decide how much of their income they can safely treat as a personal salary — and shows them, every day, what that means.**

### What makes Vanea different

Most finance apps on the Play Store are **recorders**: they show what you spent. Vanea is a **decision partner**. Every number answers "so what should I do?" and can explain itself:

| A recorder says | Vanea says |
|---|---|
| "You spent Rp 3.000.000 this month." | "You have **Rp 141.000 a day** until payday on 25 Oct." |
| "Income this month: Rp 12.000.000." | "Your Pool covers **2,8 months** of salary and subscriptions." |
| "Income went up." | "Your income has stayed above Rp 5.618.000 for 3 months and your Pool can support it. **You may raise your salary by up to Rp 250.000.**" |
| "Income went down." | "At this pace your Pool runs out in **about 5 months**. A salary of Rp 4.300.000 would be sustainable." |

---

## 2. Problem

People with variable income — freelancers, creators, contractors, side-hustlers — face three linked problems:

1. **Income is mistaken for spending power.** A good month feels like a raise, so spending rises with it. A bad month then becomes a crisis.
2. **No natural "salary".** Employees get a fixed amount on a fixed day. Variable earners have to invent that discipline, and most don't.
3. **No feedback loop.** Recording expenses without reflection rarely changes behavior. Users see *what* happened but not *what it means* or *what to do next*.

---

## 3. Goals & Non-goals

### Goals

1. **G1 — Stable personal pay.** The user pays themselves a predictable salary from a Pool of variable income.
2. **G2 — Awareness, not just records.** Every main number is actionable and explainable (daily allowance, runway, salary review evidence).
3. **G3 — Safe salary decisions.** Recommendations and raises are sustainable through the user's weakest months (validated by simulation: SYSTEM-OVERVIEW §5.8).
4. **G4 — Reflection habit.** A monthly Kakeibo loop: intention at the start of the month, reflection at the end.
5. **G5 — Total privacy.** All data stays on the device, encrypted. No account, no server, no network.

### Non-goals (v1)

- Bank or e-wallet integration, automatic transaction import.
- Moving real money (Vanea only records).
- Automatic salary changes in either direction.
- AI or personalized financial advice; investment advice.
- Budgeting by envelopes or detailed per-category budgets (only an optional Wants limit).
- Gamification: scores, streaks, badges, leaderboards.
- Multi-currency, iOS, cloud sync, multi-device, shared/family use.
- Tax calculation (tax payments can be recorded as a business cost).

---

## 4. Phases

| Phase | Audience | Distribution | Exit criteria |
|---|---|---|---|
| **1 — Personal** | The owner | APK installed on the owner's Android phone | Core loop used daily for 3 months; thresholds re-validated with real data (§12) |
| **2 — Public (free)** | Other Indonesian variable-income earners | Google Play, free, no ads, no in-app purchases | Play closed test passed; P1 requirements done; privacy policy published |

Phase 2 publishing constraints (Google Play, personal developer account):

- One-time US$25 registration fee.
- New personal accounts must run a **closed test with at least 12 testers, opted in for 14 consecutive days**, before production access.
- A privacy policy URL and a Data safety form are required even though Vanea collects no data.

---

## 5. Users

### 5.1 Primary persona — the owner (Phase 1)

- Indonesian, Android user, earns variable income in IDR.
- Pays for several app subscriptions needed for work, out of income.
- Wants to stop treating every payment received as spending money, and to understand their finances better.

### 5.2 Secondary personas (Phase 2)

| Persona | Income pattern | Key need |
|---|---|---|
| Freelancer / creator | Irregular project payments, quiet months | A salary that survives quiet months |
| Seasonal earner | Strong peaks (e.g. Ramadan, holidays, wedding season) | Not mistaking a peak for a raise |
| Commission-based worker | Fixed base + variable commission | Steady pay despite commission swings |
| Side-hustler | Salary + side income | Keeping side income from leaking into spending |

---

## 6. Product Principles

1. **Income is not spending power.** Income goes to the Pool; spending comes from salary.
2. **Vanea recommends; the user decides.** Every salary change is confirmed by the user. Nothing changes automatically.
3. **Stability protects salary; stability alone does not raise it.** Only a sustained, affordable rise in earning capacity justifies a raise.
4. **One good month is not a new normal.** Single spikes, seasonal peaks and volatile swings do not trigger raises.
5. **Raises are capped at 5% per adjustment** and must be affordable through the user's weakest months.
6. **Lowering salary is always allowed** and is never a trap: the user can return to a recent salary without re-qualifying.
7. **The Pool can never be negative.** Personal spending can be, and Vanea says so calmly.
8. **Never refuse a record.** Vanea warns but never blocks recording real-world spending; blocked records create dishonest data.
9. **Explain every consequential number.** No black-box scores, no fake precision.
10. **Reflection over gamification.**
11. **Privacy and local ownership are foundational.**

---

## 7. Core Financial Model

```text
                     ┌──────────── business costs (subscriptions, tools, tax)
                     │
INCOME ──────────▶ POOL ── salary payment ──▶ AVAILABLE SPENDING ── expenses (Needs / Wants / Growth / Unexpected)
                     │   ◀── advance repayment ──┘          │
                     │                                       ├──▶ SAVINGS
                     └── surplus allocation ──▶ SAVINGS / INVESTMENTS
                                                             └──▶ INVESTMENTS
```

| Account | Rule |
|---|---|
| **Pool** | All income enters here. Pays salary and business costs. **Never negative.** |
| **Available Spending** | Personal money. Filled by salary, spent by expenses. **Rolls over** between periods. **May go negative** (overspent). |
| **Savings** | Filled from Available Spending or from Pool surplus. Never negative. |
| **Investments** | Recorded contributions and withdrawals (no market valuation in v1). Never negative. |

All balances are derived from immutable transactions (SYSTEM-OVERVIEW §6).

### 7.1 Glossary (user-facing terms)

| Term | Meaning |
|---|---|
| **Pool** | Income not yet paid to yourself as salary |
| **Salary** | The fixed amount you pay yourself each period |
| **Payday** | The day of the month you pay yourself (1–28) |
| **Available Spending** | Your personal money right now |
| **Daily allowance** | Available Spending divided by days until next payday |
| **Runway** | How many months your Pool covers your salary and subscriptions |
| **Business cost** | Money your work needs: app subscriptions, tools, tax, other |
| **Subscription** | A recurring business cost (monthly or yearly) |
| **Typical income** | The middle value of your recent monthly income, after business costs |
| **Usual swing** | How much your income normally moves month to month |
| **Salary review** | Vanea's monthly check of whether a raise is justified |
| **Salary advance** | Money taken early from your Pool and repaid from future salary |
| **Safe surplus** | Pool money above your buffer (default: 3 months of commitments) |
| **Intention** | What you plan to set aside this month |
| **Reflection** | Your end-of-month review |

Accounting terms (ledger, debit, credit, baseline, median, MAD) never appear in the UI.

---

## 8. Requirements

Priority: **P0** = first personal build · **P1** = before public release · **P2** = later.

### 8.1 Onboarding

| ID | Requirement | Priority |
|---|---|---|
| ONB-1 | Create a local profile with no account and no network. Currency is fixed to IDR. | P0 |
| ONB-2 | Choose payday (day 1–28). | P0 |
| ONB-3 | Optionally enter 0–12 months of **historical net income** (after business costs) as monthly totals, plus "income earlier this month". Historical data is evidence only: it never enters the Pool. | P0 |
| ONB-4 | Enter **current money** as opening balances: Pool, Available Spending, Savings, Investments. | P0 |
| ONB-5 | Optionally add subscriptions (name, amount, monthly/yearly, next due date). | P1 |
| ONB-6 | Show the salary recommendation with its explanation (SYSTEM-OVERVIEW §5.3). With < 3 months of data, show guidance instead. | P0 |
| ONB-7 | The user chooses the salary. Above the recommendation requires seeing the worst-case depletion disclosure. | P0 |
| ONB-8 | Explain that data lives only on this phone, and that uninstalling deletes it unless a backup exists. | P0 |
| ONB-9 | Calibration: during the first 3 salary periods the user may adjust salary freely (no gates, no cap). | P0 |

### 8.2 Income

| ID | Requirement | Priority |
|---|---|---|
| INC-1 | Record income: amount, date (≤ today, ≥ onboarding), source, note. Income enters the Pool. | P0 |
| INC-2 | Reverse income (refund or chargeback). If the Pool cannot absorb it, the remainder becomes an automatic salary advance (SYSTEM-OVERVIEW §6.5). | P0 |
| INC-3 | Income list by month with monthly net totals. | P0 |

### 8.3 Business Costs & Subscriptions

| ID | Requirement | Priority |
|---|---|---|
| BIZ-1 | Record a business cost paid from the Pool: amount, date, category (Subscription, Tools, Tax, Other), note. Subject to the Pool invariant. | P0 |
| BIZ-2 | Business costs reduce monthly net income used by the salary engine. | P0 |
| BIZ-3 | Manage subscriptions: name, amount, cadence (monthly/yearly), next due date, active flag. | P1 |
| BIZ-4 | On the due date, remind the user. One tap confirms and records the business cost (amount editable). Nothing is recorded without confirmation. | P1 |
| BIZ-5 | Show committed monthly costs (monthly + yearly ÷ 12) in the Pool view. Commitments count toward runway. | P1 |

### 8.4 Salary

| ID | Requirement | Priority |
|---|---|---|
| SAL-1 | Salary recommendation using the worst-months test (SYSTEM-OVERVIEW §5.3), with plain-language explanation. | P0 |
| SAL-2 | Pay salary: show the period's entitlement (salary − advance installment). Allow full, partial (limited by Pool) and top-up payments within the period. No arrears. | P0 |
| SAL-3 | Payday reminder notification when the entitlement is unpaid. | P1 |
| SAL-4 | Monthly salary review using the five gates (SYSTEM-OVERVIEW §5.4). Every status has an explanation with real amounts. | P0 |
| SAL-5 | On `ELIGIBLE`: accept up to +5% (rounded down to Rp 10.000), accept a smaller amount, or decline. Never automatic. Never pushed as a notification. | P0 |
| SAL-6 | Decrease salary anytime. Show the impact on daily allowance and runway before confirming. | P0 |
| SAL-7 | Restore salary up to the highest salary of the last 12 months without gates. | P0 |
| SAL-8 | Salary pressure levels (SYSTEM-OVERVIEW §5.6) with the current safe salary. `SERIOUS` sends at most one notification per month. | P0 |
| SAL-9 | Salary history: every change with type, date and reason. Every review snapshot is viewable. | P1 |

### 8.5 Available Spending & Expenses

| ID | Requirement | Priority |
|---|---|---|
| SPD-1 | Dashboard hero number: Available Spending. | P0 |
| SPD-2 | Daily allowance until next payday (SYSTEM-OVERVIEW §7.2). | P0 |
| SPD-3 | Record an expense: amount, date, category (Needs, Wants, Growth, Unexpected), note. Fast entry: amount + category in ≤ 3 taps after opening the form. | P0 |
| SPD-4 | Expenses are never blocked. Negative Available Spending shows a calm overspent state; the next salary covers it. | P0 |
| SPD-5 | Pace message when spending runs > 15 points ahead of time (SYSTEM-OVERVIEW §7.3). | P1 |
| SPD-6 | Recent spending list on the dashboard; full list filterable by month and category. | P0 |

### 8.6 Salary Advance

| ID | Requirement | Priority |
|---|---|---|
| ADV-1 | Create a salary advance: amount ≤ salary and ≤ Pool, term 1–6 periods, no interest. At most one active. | P1 |
| ADV-2 | Installments are withheld automatically from each period's entitlement; shown on the Pay Salary screen. | P1 |
| ADV-3 | Early repayment from Available Spending. | P1 |
| ADV-4 | Show outstanding amount and remaining periods. | P1 |

### 8.7 Savings, Investments & Surplus

| ID | Requirement | Priority |
|---|---|---|
| SAV-1 | Deposit to / withdraw from Savings (from/to Available Spending). Withdrawals ≤ balance. | P1 |
| SAV-2 | Record investment contributions and withdrawals with an asset label. No price tracking. | P1 |
| SAV-3 | Show **safe surplus** = Pool − buffer × monthly commitments (buffer default 3 months, editable). | P1 |
| SAV-4 | Allocate Pool surplus directly to Savings or Investments. Amounts above the safe surplus are allowed after showing the resulting runway. | P1 |

### 8.8 Monthly Intention & Reflection (Kakeibo)

| ID | Requirement | Priority |
|---|---|---|
| REF-1 | At the start of each month, set an intention: amount to set aside, optional Wants limit, optional note. | P1 |
| REF-2 | End-of-month reflection with the four Kakeibo questions: *How much did I receive? How much did I want to set aside? How much did I spend? How can I improve?* The first three are pre-filled from data. | P0 |
| REF-3 | Category notes for Needs, Wants, Growth, Unexpected, plus an overall note. | P0 |
| REF-4 | Up to 2 automatic highlights of meaningful category changes (SYSTEM-OVERVIEW §8). | P1 |
| REF-5 | Intention vs actual, and Wants vs limit, without scores. | P1 |
| REF-6 | Past reflections are readable, including the numbers as they were at reflection time. | P1 |

### 8.9 Corrections

| ID | Requirement | Priority |
|---|---|---|
| COR-1 | "Edit" of amount, date or kind performs reversal + replacement; history shows both. | P0 |
| COR-2 | "Delete" performs a reversal. | P0 |
| COR-3 | Note, labels and categories can be edited in place. | P0 |
| COR-4 | Historical income months can be edited; salary evaluations re-run. | P0 |

### 8.10 Security & Backup

| ID | Requirement | Priority |
|---|---|---|
| SEC-1 | Encrypted database (SQLCipher); key in Android Keystore. | P0 |
| SEC-2 | App lock with biometrics or device credential (on by default, can be disabled). | P1 |
| SEC-3 | Release builds have no INTERNET permission; Android Auto Backup disabled. | P1 |
| BAK-1 | Export an encrypted backup file protected by a passphrase, via the share sheet. | P0 |
| BAK-2 | Import a backup (replace all data after a summary and confirmation). | P0 |
| BAK-3 | Monthly backup reminder when the last export is > 30 days old. | P1 |

### 8.11 Settings

| ID | Requirement | Priority |
|---|---|---|
| SET-1 | Change payday (applies from the next unpaid period). | P0 |
| SET-2 | Toggle each notification type. | P1 |
| SET-3 | Edit buffer months for safe surplus. | P1 |

---

## 9. Scope Summary

**In v1:** income, business costs, subscriptions, Pool, salary recommendation, salary payments, salary review, decrease and restore, salary pressure warnings, Available Spending with daily allowance and pace, expenses in four Kakeibo categories, salary advance, savings, investments (records only), surplus allocation, monthly intention and reflection, historical income, opening balances, corrections, encrypted local storage, app lock, encrypted export/import, local notifications.

**Out of v1:** see §3 Non-goals.

---

## 10. Success Metrics

There is no analytics in the app, by design. Phase 1 metrics come from the owner's own data; Phase 2 metrics come from Google Play Console and voluntary feedback.

### Phase 1 — Personal (first 6 months of use)

| Metric | Target |
|---|---|
| Salary paid (fully or partially) | In ≥ 5 of 6 periods |
| Monthly reflection completed | ≥ 5 of 6 months |
| Expense logging | Expenses recorded in every week of the period |
| Backups | At least one export per month |
| Awareness check (self-reported, monthly) | "I know my daily allowance without opening the app" — yes in the last 3 months |

### Phase 2 — Public

| Metric | Source | Target |
|---|---|---|
| Crash rate (user-perceived) | Android vitals | < 0.5% |
| Rating | Play Console | ≥ 4.5 |
| 30-day retained installers | Play Console | ≥ 25% |
| Qualitative feedback | Email / Play reviews | Recurring themes reviewed monthly |

---

## 11. Non-functional Requirements

| Area | Requirement |
|---|---|
| Platform | Android (minimum version supported by the Expo SDK in use). Expo + React Native New Architecture. |
| Language | English UI. Amounts in IDR formatted `Rp 4.250.000`. |
| Offline | Every feature works offline; release builds have no network permission. |
| Privacy | No data leaves the device except through user-initiated export. |
| Performance | Dashboard < 1.5 s from cold start with 5 years of data. |
| Accessibility | TalkBack labels, font scaling to 200%, 48 dp touch targets, WCAG AA contrast, meaning never conveyed by color alone. |
| Correctness | Domain logic is pure, deterministic and tested (SYSTEM-OVERVIEW §12). |

---

## 12. Release Plan

| Milestone | Content | Phase |
|---|---|---|
| **M0 — Engine** | `src/domain`: ledger, monthly net income, salary engine, pressure, insights. Full test suite, parity with the Python reference simulation. No UI. | 1 |
| **M1 — Core loop** | Onboarding, income, business costs, pay salary, expenses, dashboard (Available Spending, daily allowance, runway), corrections, encrypted DB, export/import. | 1 |
| **M2 — Salary decisions** | Salary review, decrease/restore, calibration, pressure warnings, end-of-month reflection. → **Start daily personal use.** | 1 |
| **M3 — Completeness** | Subscriptions and reminders, salary advance, savings, investments, surplus, intention, highlights, pace, notifications, app lock. | 1 |
| **Validation** | 3 months of real use. Re-run the simulation with real monthly totals; tune constants in `config.ts` if needed. | 1 |
| **M4 — Public readiness** | Copy polish, accessibility pass, privacy policy, Play listing, Data safety form, production build without INTERNET permission. | 2 |
| **M5 — Closed test** | ≥ 12 testers for 14 consecutive days; fix findings. | 2 |
| **M6 — Launch** | Production release on Google Play. | 2 |

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Phone lost, broken or app uninstalled | All data lost | Encrypted export, monthly backup reminder, onboarding warning |
| Backup passphrase forgotten | Backup unusable | Clear warning at export; passphrase confirmation; no recovery by design |
| User stops logging | Numbers become wrong | Fast entry, payday and month-start reminders, never refuse a record |
| Thresholds wrong for real income | Bad recommendations | Simulation-validated defaults; constants centralized; re-validation after 3 months |
| Salary set above recommendation | Pool runs out | Depletion disclosure at choice time; pressure warnings |
| Play closed-test requirement (12 testers × 14 days) | Launch delay | Recruit testers during M4 |
| SQLCipher key loss (Keystore reset) | Database unreadable | Key not bound to biometrics; regular exports |

---

## 14. Open Questions

1. **Multi-currency.** Is any income received in USD (Upwork, PayPal, etc.)? v1 assumes IDR only; foreign income would be recorded at the rupiah amount actually received.
2. **Tax reserve.** Should a percentage of each income be reserved for tax (e.g. PPh final 0.5%)? v1 records tax only as a business cost.
3. **Multiple savings goals.** v1 has one Savings balance. Are named goals needed?
4. **iOS.** When, if ever?
5. **Cloud backup.** Should a later version support saving backups directly to a user-chosen folder (e.g. Google Drive via the system file picker) on a schedule?

---

## 15. Decision Log (changes from v1.0)

| # | Decision | Reason |
|---|---|---|
| 1 | Product renamed **Keel → Vanea**; English UI | Owner decision |
| 2 | Android first with **Expo** / React Native | Owner decision; free personal distribution via APK |
| 3 | Raise rule replaced by the **five gates** | The v1 median rule granted raises to volatile and seasonal income and caused shortfalls in 37–100% of simulated histories |
| 4 | Initial salary uses the **worst-months test** with a 5% safety margin | v1 had no initial-salary algorithm |
| 5 | **Restore** to the highest salary of the last 12 months without gates | Without it, lowering salary becomes a trap |
| 6 | **Available Spending** defined: rolls over, may go negative | v1 had no formula for the main dashboard number |
| 7 | Self-loan simplified to **salary advance** with withheld installments | v1 definition contradicted itself |
| 8 | **Business costs and subscriptions** are paid from the Pool and reduce net income | Owner pays app subscriptions from income |
| 9 | **Surplus allocation** from Pool to savings/investments | Money could otherwise only leave the Pool via salary |
| 10 | Historical income is **evidence only**; **opening balances** added | Historical money is already spent; current money must be captured |
| 11 | **Income reversal** remainder becomes an automatic advance | Keeps the Pool ≥ 0 without hiding the shortfall |
| 12 | **Runway** and **salary pressure levels** replace the undefined decline warning | Gives a calm, explainable trigger |
| 13 | **Daily allowance** and **pace** added | Core awareness differentiator |
| 14 | Kakeibo **start-of-month intention** added | Kakeibo has two moments; v1 had only the end of month |
| 15 | One money format `Rp 4.250.000` | v1 mixed `Rp 4.250.000` and `Rp5,000,000` |
