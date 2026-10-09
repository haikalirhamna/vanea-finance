# Vanea — User Flows

**Version:** 2.1
**Status:** Draft for review
**Last updated:** 2026-10-09

Each flow lists its steps, outcomes and edge cases. Copy and layout: DESIGN. Rules and formulas: SYSTEM-OVERVIEW. Flows marked **(M0.1)** cover subscriptions, debts and investments (PRD sections 8.3, 8.12 and 8.13).

**Core UX principle:**

```text
OBSERVE → UNDERSTAND → DECIDE → ACT
```

---

## 1. First Launch & Onboarding

```text
Open Vanea
 ↓
Welcome — what Vanea does, in three lines
 ↓
Payday — pick a day 1–28
 ↓
Income history (optional) — "How many past months can you fill in?" (0–12)
   → one amount per month, after business costs, newest first
   → "Income earlier this month" (before today)
 ↓
Current money — Pool · Available Spending · Savings · Investments
 ↓
Subscriptions (optional) — name, price, monthly or yearly (required, no default), next billing date
 ↓
Debts (optional) — credit lines with their current balance; loans and PayLater installments
   with remaining installments → "Set this balance aside from Available Spending?" (default yes)
 ↓
Investments (optional) — holdings: asset class, amount put in, current estimated value if known
 ↓
Salary recommendation
   ├─ ≥ 3 months of data → recommended amount + "Why this amount"
   └─ < 3 months → guidance: "Start no higher than your weakest recent month"
 ↓
Choose salary
   ├─ At or below recommendation → confirm
   └─ Above recommendation → depletion disclosure → confirm or go back
 ↓
Privacy & backup — data is only on this phone; enable app lock
 ↓
Dashboard
```

**Outcomes:** profile created; historical months stored as evidence (no Pool effect); opening balances recorded (including owed amounts, bill reserves and holdings' put in); salary setting `initial` created; calibration runs for the first 3 salary periods.

**Edge cases**

- The user skips history and has no data → no recommendation; calibration lets them adjust as data arrives.
- Opening Pool is 0 → allowed; the first payday may only allow a partial payment.
- Onboarding on payday → the first salary period is the current month.
- Yearly subscriptions already paid before onboarding are inside the historical net income; they are not spread again.

---

## 2. Record Income

```text
Dashboard → + Income → amount → date (default today) → source (optional) → Save
 ↓
Pool increases · runway updates
```

**Edge cases:** date before onboarding → rejected with "Older income belongs in Income history (Settings)". Future date → rejected.

---

## 3. Record a Business Cost

```text
Pool → + Business cost → amount → category (Subscription / Tools / Tax / Other) → date
 ├─ Subscription → "Billed monthly or yearly?" (required, no default)
 │                → link to a saved subscription, or save as a new one
 └─ Tools / Tax / Other → one-off, nothing more to ask
 ↓
Save → Pool decreases by the full amount
     → net income: full amount this month, or 1/12 per month for 12 months if yearly
```

**Edge case:** amount exceeds what the Pool allows → error with the maximum (DESIGN §12). The user can record the income that paid for it first.

---

## 4. Subscriptions

### 4.1 Add, edit or delete

```text
Pool → Subscriptions → + Add → name → monthly or yearly (required) → price → next billing date → Save
Subscription → Edit → any field → Save
Subscription → Delete → confirmation:
   "Reminders stop and it leaves your monthly commitments.
    Costs already recorded stay in your history." → Delete
```

Adding and deleting are always allowed. A yearly charge already paid keeps counting 1/12 per month after deletion.

### 4.2 Billing date

```text
Notification on the billing date: "Figma renews today: Rp 225.000"
 ↓
Tap → prefilled business cost with the subscription's cycle (amount editable)
 ├─ Record, amount as expected → saved; next billing date advances one cycle
 ├─ Record, amount different → "Did the price change?"
 │     ├─ Yes, from now on → new price effective from this billing date → saved
 │     └─ Only this time  → saved; the price stays
 ├─ Skip this time → next billing date advances; nothing recorded
 └─ Delete subscription → §4.1
```

Nothing is recorded without confirmation.

### 4.3 Announced price change

```text
Subscription → Price → "New price from…" → amount → effective date → Save
 ↓
Impact: "Your monthly commitments rise by Rp 25.000, to Rp 8.725.000. Your Pool still covers 2,8 months."
 ↓
Until that date reminders show the old price; from that date the new one
```

Past costs never change. A yearly subscription's new price applies at its next renewal.

---

## 5. Record an Expense

```text
Dashboard → center action (+) → amount → category (Needs / Wants / Growth / Unexpected) → Save
 ↓
Available Spending decreases · daily allowance updates
```

Date, note and **Paid with** are optional fields below the fold (date defaults to today; Paid with defaults to Available Spending).

| Paid with | Result |
|---|---|
| Available Spending (cash, debit, e-wallet) | Available Spending decreases |
| A credit line (card, PayLater) (M0.1) | Available Spending decreases; the amount moves into the line's bill reserve and is owed on the line |
| Installment purchase (M0.1) | Opens the loan form (§22.2) prefilled with the price; Available Spending drops only as installments are paid; the full price counts in this month's Kakeibo spending |

**Edge cases**

- Expense exceeds Available Spending → saved anyway; dashboard shows the overspent state. Never blocked.
- Wants limit set and exceeded → a quiet line on the Expenses screen: "Wants this month: Rp 1.700.000 of your Rp 1.500.000 limit." No notification.

---

## 6. Pay Salary

```text
Payday notification or "Pay salary" on dashboard
 ↓
Pay Salary screen: salary · advance repayment (if any) · you receive · Pool after
 ↓
Check Pool
```

### Sufficient Pool

```text
Record payment → Pool decreases · Available Spending increases · period marked paid
```

### Insufficient Pool

```text
"Not enough in your Pool" — shows the maximum available
 ↓
User confirms the partial payment
 ↓
Pool = 0 · period marked partially paid
 ↓
Later income in the same period → "Pay the remaining Rp X" (top-up)
```

**Edge cases**

- Period ends partially paid → the remainder is not owed later (no arrears).
- No payment in a period with an active advance → no installment; the advance schedule extends by one period.
- Salary changed during calibration or after a review → the new amount applies to the first unpaid period.

---

## 7. Salary Review

```text
New month begins (first app open)
 ↓
Engine evaluates the five gates (SYSTEM-OVERVIEW §5.4) → snapshot saved
 ↓
Salary screen shows the status (no notification)
```

### Eligible

```text
Salary review: evidence (typical income before, last 3 months, needed amount,
same months last year, affordability)
 ↓
User chooses:
 ├─ Increase to the maximum (+5%, rounded down to Rp 10.000)
 ├─ Choose a smaller increase → amount between current and maximum
 └─ Keep current salary
 ↓
Increase → new salary applies to the first unpaid period · cooldown starts
Keep → nothing changes · next month evaluates again
```

### Not eligible

The Salary screen shows the status message (DESIGN §6.2). There is no action button, only "How reviews work".

**Edge cases**

- The user ignores an eligible review → next month's evaluation marks it `expired` and creates a new one.
- Eligible doesn't guarantee funding → payday still checks the Pool.
- A correction changes past months → the current month is re-evaluated; decided snapshots are kept for history.

---

## 8. Decrease Salary

```text
Salary → Change salary → Decrease → new amount
 ↓
Impact preview: daily allowance after next payday · runway
 ↓
Confirm → new salary applies to the first unpaid period
```

No eligibility check. The previous salary remains restorable for 12 months.

---

## 9. Restore Salary

```text
Salary → "You can return to Rp 5.000.000" → amount ≤ restore ceiling
 ↓
Impact preview (runway, and worst-case disclosure if above current recommendation)
 ↓
Confirm
```

No gates. The cooldown anchor is unchanged.

---

## 10. Salary Pressure Warning

```text
Dashboard load → pressure level computed (SYSTEM-OVERVIEW §5.6)
 ├─ NONE / THIN_BUFFER / INFO → one quiet line
 └─ ATTENTION / SERIOUS → card: "Your Pool may run out in about N months"
        → evidence: typical income · salary · Pool
        → "A salary of Rp X would be sustainable"
        → [Review salary] → Decrease flow (§8), prefilled with Rp X
        → [Not now] → card collapses to one line until next month
 ↓
SERIOUS → also one local notification per month
```

Vanea never lowers the salary itself.

---

## 11. Salary Advance

### 11.1 Create

```text
Salary → Salary advance → amount (≤ salary, ≤ Pool) → periods (1–6)
 ↓
Preview: "Rp 3.000.000 now. Your next 3 salaries will be Rp 1.000.000 lower."
 ↓
Confirm → Pool decreases · Available Spending increases
```

Blocked when an advance is already active: "Repay your current advance first (Rp 1.000.000 left)."

### 11.2 Repayment

Automatic through each period's entitlement (§6). Shown on the Pay Salary screen.

### 11.3 Early repayment

```text
Salary advance → Repay early → amount ≤ outstanding → Confirm
 ↓
Available Spending decreases · Pool increases · same installment, so the advance finishes sooner
```

---

## 12. Income Reversal (refund or chargeback)

```text
Income item → Remove (or Edit amount down)
 ├─ Pool can absorb it → reversal saved · Pool decreases
 └─ Pool can't absorb it
       → explanation (DESIGN §12)
       → remainder becomes a salary advance (default 3 periods, editable 1–6;
         added to the active advance if one exists)
       → Confirm → Pool = 0 · advance created/updated
```

---

## 13. Correct or Delete a Record

```text
Any record → Edit
 ├─ Note / label / category → saved in place
 └─ Amount / date → reversal of original + new corrected record
        (validated like a new record; Pool invariant applies)
Any record → Delete → reversal (with confirmation)
```

History shows the original as "Edited" or "Removed" with a link to its replacement.

Historical income months (Settings → Income history) are edited in place; the salary engine re-evaluates.

---

## 14. Savings

```text
Savings → Set aside → amount → Save            (Available Spending → Savings)
Savings → Withdraw → amount ≤ balance → Save   (Savings → Available Spending)
```

---

## 15. Investments

Replaced by §23 (M0.1): holdings by asset class, put in, estimated values and sales.

---

## 16. Pool Surplus

```text
Pool → "Safe surplus: Rp 6.000.000" → Move to: Savings / an investment holding / a debt (M0.1) → amount
 ├─ ≤ safe surplus → confirm
 └─ > safe surplus → shows runway after the move → confirm or adjust
 ↓
Pool decreases · the destination increases (or the debt's owed amount decreases)
```

Vanea does not suggest which destination. Paying a credit line from the Pool also returns its bill reserve to Available Spending (SYSTEM-OVERVIEW §6.9).

---

## 17. Monthly Intention

```text
1st of month notification or first open of the month
 ↓
"What do you want to set aside this month?" → amount
 ↓
Optional Wants limit → Save (or Skip)
```

---

## 18. Monthly Reflection

```text
New month → "Reflect on September"
 ↓
Pre-filled: received · intended · spent (by category) · set aside
 ↓
Separate lines (M0.1): debt payments · cost of borrowing · investment income · realized gains or losses
 ↓
Worth noticing (up to 2 highlights, from the 4th observed month)
 ↓
"How can I improve?" (free text) · optional category notes
 ↓
Save → snapshot stored
```

No score. Reflection can be completed any time later; it stays available in history.

---

## 19. Backup Export & Import

### Export

```text
Settings → Backup → Export → passphrase (×2) → encrypted file → share sheet
 ↓
User saves it (e.g. Google Drive, Files) · last export date updates
```

### Import

```text
Settings → Backup → Import → pick file → passphrase
 ├─ Wrong passphrase / invalid file → error (DESIGN §12)
 └─ Valid → summary (date range, records, balances)
        → "This will replace all data on this phone" → Confirm
        → data replaced · evaluations re-run
```

---

## 20. App Lock

```text
Open app → biometric or device credential prompt → Dashboard
```

The lock can be disabled in Settings (requires authentication). The lock gates the UI; it never encrypts data with a biometric-bound key.

---

## 21. Change Payday

```text
Settings → Payday → new day (1–28) → applies from the first unpaid period → Confirm
```

---

## 22. Debts (M0.1)

### 22.1 Credit lines (card, PayLater pay-next-month)

```text
Debts → + Credit line → name → type (credit card / PayLater) → statement day → due day → limit (optional) → Save
```

**Pay with the line** — see §5 (Paid with).

**Interest, fees, late fees**

```text
Credit line → Add cost → type (interest / fee / late fee) → amount → Save
 ↓
Available Spending decreases · bill reserve and owed increase · shown later as cost of borrowing
```

**Pay the bill**

```text
Due-date notification or Credit line → Pay bill → amount (default: amount due) → from Available Spending or the Pool
 ↓
Preview: "Rp 1.200.000 comes from the bill reserve; Rp 300.000 from Available Spending (older balance)."
 ↓
Confirm → owed decreases
```

Paying more than is owed is rejected with the owed amount as the maximum.

**Convert a purchase to installments**

```text
Credit line → a purchase → Convert to installments → installment amount → number of installments → first due date
 ↓
Preview: cost of borrowing and approximate yearly rate (e.g. conversion fee)
 ↓
Confirm → the purchase leaves the line and its reserve; the reserved money returns to Available Spending;
          a new installment loan starts. The expense keeps its full price in its original month.
```

### 22.2 Installment loans (online loan, bank loan, installment purchase, PayLater installments, personal)

```text
Debts → + Loan → lender → type → purpose (personal / business) → amount received → installment amount
      → number of installments → monthly or single payment → first due date
      → (online loan) "Registered with OJK?" yes / no / not sure — with the line "Check that the lender is registered with OJK."
 ↓
Before saving: "You receive Rp 2.000.000 and repay Rp 2.600.000 in 30 days.
                This loan costs Rp 600.000 — 30% of what you borrow, about 365% a year."
 ↓
Save
 ├─ Personal cash loan → Available Spending increases
 ├─ Installment purchase → no cash change (the item is an expense, §5)
 └─ Business loan → Pool increases, marked borrowed (not usable for salary)
```

The money received is never income. Recording a loan is never blocked.

**Pay an installment**

```text
Due-date notification or Loan → Pay installment (default: the installment amount)
 ↓
Personal loan → from Available Spending · Business loan → from the Pool
 ↓
Owed decreases · the interest part is shown as cost of borrowing (or a business cost for business loans)
```

**Late fee:** Loan → Add late fee → amount → owed increases. Nothing else changes automatically.

**Early payoff:** Loan → Pay off → amount actually paid → preview "Interest saved: Rp X" → confirm → the loan closes.

### 22.3 Debts view and ratio

```text
Debts → total owed · each debt: owed, next due date and amount, remaining installments, bill reserve (credit lines)
      → salary advance listed separately
      → debt payment ratio this month; above 30% a calm card:
        "Debt payments take 38% of your salary this month."
```

The daily allowance already sets aside personal installments due before the next payday (§5 dashboard line).

---

## 23. Investments (M0.1)

### 23.1 Holdings

```text
Investments → + Holding → name → asset class (shows its general risk label) → platform (optional) → Save
```

Asset classes: time deposit, government bonds, money market fund, fixed income fund, mixed fund, gold, equity fund, stocks, crypto & digital assets, other (user sets the risk label).

### 23.2 Put money in

```text
Holding → Add contribution → amount (after fees) → from Available Spending (or Pool surplus, §16) → Save
 ↓
Put in increases
```

### 23.3 Update the estimated value

```text
Holding → Update value → current value → date (default today) → Save
 ↓
Shown as "estimate · as of 12 Oct"; after 90 days: "value last updated 3 months ago"
```

A value update never changes any money total, the Pool, runway or salary.

### 23.4 Sell or withdraw

```text
Holding → Sell → cash received → sold: all / part (share) → send to: Available Spending or Savings (no default)
 ↓
Preview: "Cost of what you sold: Rp 4.000.000 · Realized gain: Rp 600.000"
 ↓
Confirm → put in decreases by the cost sold · the chosen account increases
```

### 23.5 Dividends, coupons, interest

```text
Holding → Add income → amount → Save → kept with the holding (not Available Spending, not the Pool)
Holding → Withdraw cash → amount → Available Spending or Savings (no default)
```

In-kind income (staking rewards, reinvested dividends, bonus units) → §23.3 value update.

### 23.6 Investments view and net position

```text
Investments → put in (main total) · estimated value and on-paper difference (secondary, neutral)
            · allocation by asset class with risk labels
            · concentration note when a high or very-high-risk class is over 50% of put in
More → Net position → three separate groups: Money · Investments · Debts (never one total)
```

---

## 24. Subscription Price Check at a Glance (M0.1)

| Moment | What Vanea does |
|---|---|
| Billing confirmed with a different amount | Asks "Did the price change?" (§4.2) |
| Announced change saved | Shows the impact on commitments and runway (§4.3) |
| Subscription list | Shows a quiet "+12% since Jan 2026" when the price has changed |
