# Vanea — User Flows

**Version:** 2.0
**Status:** Draft for review
**Last updated:** 2026-10-09

Each flow lists its steps, outcomes and edge cases. Copy and layout: DESIGN. Rules and formulas: SYSTEM-OVERVIEW.

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
Subscriptions (optional) — name, amount, monthly/yearly, next due date
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

**Outcomes:** profile created; historical months stored as evidence (no Pool effect); opening balances recorded; salary setting `initial` created; calibration runs for the first 3 salary periods.

**Edge cases**

- The user skips history and has no data → no recommendation; calibration lets them adjust as data arrives.
- Opening Pool is 0 → allowed; the first payday may only allow a partial payment.
- Onboarding on payday → the first salary period is the current month.

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
Pool → + Business cost → amount → category (Subscription / Tools / Tax / Other) → date → Save
 ↓
Pool decreases · this month's net income decreases
```

**Edge case:** amount exceeds what the Pool allows → error with the maximum (DESIGN §12). The user can record the income that paid for it first.

---

## 4. Subscriptions

### 4.1 Add or edit

```text
Pool → Subscriptions → + Add → name → amount → monthly/yearly → next due date → Save
```

### 4.2 Due date

```text
Notification on due date: "Figma renews today: Rp 225.000"
 ↓
Tap → prefilled business cost (amount editable)
 ├─ Record → business cost saved; next due date advances
 ├─ Skip this time → next due date advances; nothing recorded
 └─ Cancel subscription → marked inactive
```

Nothing is recorded without confirmation.

---

## 5. Record an Expense

```text
Dashboard → + Expense → amount → category (Needs / Wants / Growth / Unexpected) → Save
 ↓
Available Spending decreases · daily allowance updates
```

Date and note are optional fields below the fold (date defaults to today).

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

```text
Investments → Add contribution → amount → asset label → Save   (Available Spending → Investments)
Investments → Withdraw → amount ≤ balance → asset → Save        (Investments → Available Spending)
```

No market value tracking in v1.

---

## 16. Pool Surplus

```text
Pool → "Safe surplus: Rp 6.000.000" → Move to Savings / Investments → amount
 ├─ ≤ safe surplus → confirm
 └─ > safe surplus → shows runway after the move → confirm or adjust
 ↓
Pool decreases · Savings/Investments increase
```

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
