# Vanea — Design System & UX Direction

**Version:** 2.2
**Status:** Draft for review
**Last updated:** 2026-10-09

Vanea is a calm decision partner, not a recorder. Version 2.1 gives it a modern visual identity — deep violet gradients, soft curved surfaces, a floating action layer — taken from a reference design (§8.1) and tuned so it stays calm.

---

## 1. Design Goal

Vanea should feel **calm, modern, premium**, focused, trustworthy, deliberate and financially disciplined.

- **Calm** comes from deep tones, generous space, one vivid element per screen and static decoration.
- **Modern** comes from shape: curved hero areas, a content sheet that rises over them, a floating action card, pill buttons, soft depth and a center action button.
- **Not boxes.** Content sits directly on surfaces with space and dividers; cards are reserved for things that deserve to stand out.

Avoid: busy fintech super-app home screens (promo banners, service grids, red badges), colorful budgeting games, SaaS admin panels, spreadsheet-like mobile UI, chart-heavy financial terminals.

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
| Salary advance | Self-loan |
| Debt, credit line, installment loan | Liability, obligation, payable |
| Bill reserve, "set aside for the bill" | Escrow, accrual |
| Cost of borrowing | APR (shown only as "about X% a year") |
| Put in, estimated value, on paper | Cost basis, mark-to-market, unrealized P&L, portfolio worth |
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
╭────────────────────────────────────────╮  ← hero canvas: deep violet gradient + soft glow (top right)
│ Good morning                     [ ◔ ] │     header icon button (notification history)
│                                        │
│           AVAILABLE SPENDING           │     overline, white 72%
│            Rp 4.250.000                │     hero amount, white, tabular; "Rp" smaller
│     Rp 141.000 a day until 25 Oct      │     white 72%
│                                        │
│   ╭────────────────────────────────╮   │  ← floating action card straddles the seam
╰───│  [↓]     [▤]      [⇄]     [◷]  │───╯
    │ Income  Pay salary Debts History│
    ╰────────────────────────────────╯
  ╭──────────────────╮ ╭──────────────────╮  ← duo cards on the content sheet
  │ (◎)           ◯  │ │ (◎)           ◯  │     deep / vivid gradients, static orbs
  │ Salary           │ │ Pool             │
  │ Rp 8.000.000     │ │ Rp 14.000.000    │
  │ Next 25 Oct      │ │ Covers 1,6 months│
  ╰──────────────────╯ ╰──────────────────╯

  Recent spending                   See all     ← rows sit on the sheet, no boxes
  [▢] Groceries · Needs          Rp 230.000
  [▢] Coffee · Wants              Rp 45.000

  October reflection                     →

╭──────[⌂]─────[▥]─────(＋)─────[✎]─────[⋯]──────╮  ← bottom bar; center action with glow
     Home   Salary   Expense  Activity  More
```

- The hero number and the daily allowance are the only large elements.
- "Covers 1,6 months" is the runway (Pool ÷ salary and subscriptions).
- The center action adds an expense (the most frequent action) and sits in thumb reach. A long press opens the add menu: Income, Business cost, Debt payment, Savings.
- The floating action card holds the next most-used destinations. It never holds promotions.

### 4.2 States

| State | Hero area shows |
|---|---|
| Overspent | `−Rp 300.000` in the caution tone for dark surfaces · "You've spent Rp 300.000 more than your salary. Your next salary will cover it." The hero gradient stays the same; no red. |
| Salary due | "Payday today · Pay yourself Rp 8.000.000" with an inverted **Pay salary** pill (white fill, deep violet label) inside the hero, above the amount. |
| Pool too small for full salary | Same as Salary due, plus "Your Pool can pay Rp 3.500.000 of it." |
| Pace ahead | One line under the daily allowance: "You've used 62% of this period's money; 40% of the period has passed." |
| Installments due before payday | The daily-allowance line names them: "Rp 141.000 a day until 25 Oct, after Rp 650.000 in installments due before then." |
| Debt payment ratio above 30% | Not on the dashboard; a calm card in the Debts view (§16.2). |
| Salary pressure | A single pressure card on the sheet, directly under the duo cards (§6.4). Never more than one at a time. |
| Raise eligible | A small quiet pill inside the Salary duo card: "Review available". No badge dot, no glow, no notification. |

---

## 5. Onboarding

Order: Welcome → Payday → Income history → Current money → Subscriptions → Debts → Investments → Salary recommendation → Privacy & backup → Dashboard.

- The Welcome screen uses the hero canvas full-height with the orb motif and one primary pill. Every following step uses the light sheet with a large title.
- One question per screen. A thin progress line at the top (not steps to "complete" or celebrate).
- Every step except Payday and Current money can be skipped.
- Income history is a simple list of months (newest first) with one amount field each, labeled "after business costs".
- Current money is split into four fields with short explanations: Pool ("income you haven't paid yourself yet"), Available Spending ("money for your personal spending"), Savings, Investments.
- The privacy screen states plainly: "Your data lives only on this phone. If you uninstall Vanea or lose your phone without a backup, it's gone."

---

## 6. Salary Screens

The Salary tab opens with a compact hero (current salary and next payday) and the sheet below. A single restrained chart shows monthly net income as rounded bars with the salary as a dashed line (§8.9).

### 6.1 Recommendation

The recommended amount sits in the hero; the explanation sits on the sheet.

```text
RECOMMENDED SALARY
Rp 5.300.000

Why this amount
If your 3 weakest months (Rp 3.000.000, Rp 4.000.000, Rp 4.000.000)
came back-to-back, your Pool of Rp 5.000.000 plus that income
could still pay Rp 5.300.000 for 3 months.

Based on 6 months of income. More history makes this more reliable.

[ Use Rp 5.300.000 ]          ← primary pill
[ Choose another amount ]     ← secondary pill
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

The three decision buttons are **equal-weight secondary pills**: no glow, no gradient, same size. Keeping the salary must look exactly as available as raising it (§9).

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

| Level | Presentation |
|---|---|
| `THIN_BUFFER` | One line under the Pool duo card: "Your Pool covers less than one month of salary." |
| `INFO` | One line: "Your salary is above your typical income of the last 3 months (Rp 4.600.000). At this pace your Pool lasts about 9 months." |
| `ATTENTION` | Pressure card: "Your Pool may run out in about 5 months." + evidence + "A salary of Rp 4.300.000 would be sustainable." + **Review salary** / **Not now** |
| `SERIOUS` | Same card, wording "in about 2 months". |

The pressure card is a white surface (radius 20, soft elevation) with a caution-tinted icon tile on the left. The caution tone appears only in that tile and the key figure — never as a full-color card. Never flashing, never full-screen. **Review salary** and **Not now** are equal-weight secondary pills.

### 6.5 Pay salary

```text
PAY SALARY · OCTOBER

Salary                       Rp 8.000.000
Salary advance repayment    −Rp 1.000.000
You receive                  Rp 7.000.000

Pool after payment           Rp 7.000.000

[ Record payment ]           ← primary pill with glow
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

Presented as a bottom sheet over the dashboard (radius 28 top corners) with a large amount field.

### 7.2 End of month — reflection

```text
SEPTEMBER REFLECTION

╭──────────────────╮ ╭──────────────────╮   ← duo cards (deep / vivid)
│ (↓) Received     │ │ (↑) Spent        │
│ Rp 8.000.000     │ │ Rp 6.700.000     │
╰──────────────────╯ ╰──────────────────╯

How much did I want to set aside?  Rp 1.000.000
How much did I set aside?          Rp 900.000

How much did I spend?
  Needs        Rp 3.900.000   ▬▬▬▬▬▬▬▬▬
  Wants        Rp 1.600.000   ▬▬▬▬
  Growth         Rp 600.000   ▬▬
  Unexpected     Rp 600.000   ▬▬

Worth noticing
Wants rose from Rp 1.200.000 to Rp 1.600.000 compared with your last 3 months.

How can I improve?
[ free text ]

Notes for each category (optional)
```

- No score, no grade, no streak.
- At most two "Worth noticing" items.
- Category share bars are thin, rounded, one violet tint for every category (no category colors). They show proportion of spending only.
- Intention vs actual is shown as two plain amounts, never as a percentage bar.

---

## 8. Visual Language

### 8.1 Reference analysis

The visual base comes from a violet fintech reference (light lavender canvas, deep violet hero, floating white action card, tinted icon tiles, center scan button, dark and vivid duo cards, rounded bar chart, pill buttons with glow).

| From the reference | Vanea's decision |
|---|---|
| Deep violet hero with gradient, white amount | **Take.** The hero canvas holds Available Spending. |
| White action card floating over the hero edge | **Take.** Holds four destinations; never promotions. |
| Large corner radii, content panel with rounded top | **Take.** Content sheet with 28 dp top corners. |
| Soft lavender canvas and soft shadows | **Take.** |
| Tinted rounded icon tiles | **Adapt.** Monochrome violet tints; the reference's red/orange/green/pink icons become one violet. |
| Center circular button with glow in the bottom bar | **Adapt.** Becomes **Add expense**; the only glowing element besides the primary pill. |
| Dark + vivid duo cards with large faded circles | **Adapt.** Salary/Pool and Received/Spent; the vivid card is toned down. |
| Rounded bar chart, income vs expense | **Adapt.** One chart per screen at most: monthly net income vs salary line. |
| Pill primary button with violet glow | **Take.** Only for one primary action per screen. |
| Header icon buttons in rounded squares | **Take.** |
| "Total Balance" as the statistics hero | **Leave.** Total wealth is never the dominant number. |
| Promo & discount banners | **Leave.** No marketing inside a calm finance app. |
| Payment service grid, contacts, send/request money | **Leave.** Vanea records; it does not move money. |
| Avatar photos, notification badges | **Leave.** Initials only if ever needed; no red badges. |

### 8.2 Color

Light theme tokens:

| Token | Hex | Use |
|---|---|---|
| `violet-950` | `#1A0B45` | Hero start, deep duo card |
| `violet-900` | `#26105F` | Deep duo card end, dark text on tints |
| `violet-800` | `#35168A` | Hero end; label on inverted pills |
| `violet-700` | `#4A20B8` | Icons, links, vivid duo card end |
| `violet-600` | `#6230E0` | **Vivid accent**: primary pill, center action, active tab |
| `violet-500` | `#7C52F0` | Gradient highlights, focus ring, hero glow |
| `violet-300` | `#B8A2F7` | Chart bars (past months), share bars |
| `violet-200` | `#D9CCFB` | Disabled accents, chart grid accents |
| `violet-100` | `#ECE6FD` | Icon tile on emphasis, selected chip |
| `violet-50` | `#F5F2FE` | Icon tile background, secondary pill fill |
| `ink-900` | `#15121F` | Primary text |
| `ink-600` | `#5F5A70` | Secondary text |
| `ink-400` | `#9A96A8` | Inactive tab icons, placeholder (never essential text) |
| `line` | `#E9E7F0` | Dividers, outlines |
| `field` | `#EFEDF5` | Input and search fill |
| `canvas` | `#F6F5FA` | Screen background (the sheet) |
| `surface` | `#FFFFFF` | Floating card, pressure card, bottom bar |
| `caution-600` | `#9A5B13` | Caution text on light surfaces |
| `caution-100` | `#FDF1DE` | Caution icon tile |
| `caution-300` | `#F4C27A` | Caution figure on dark surfaces (overspent amount) |
| `on-deep` | `#FFFFFF` | Text on hero and duo cards |
| `on-deep-muted` | `rgba(255,255,255,0.72)` | Secondary text on deep surfaces |

Rules:

- **Saturation budget:** per screen, one vivid element (the primary pill *or* the center action) plus the deep hero. Everything else is neutral or a pale violet tint.
- **Deep before bright.** Large areas use `violet-950`–`violet-800`, never `violet-600`.
- One caution tone (amber) for overspent, `ATTENTION` and `SERIOUS`. **No red or green money**, no green "gain" or red "loss".
- **No category colors.** Categories are identified by label and, where needed, one neutral icon.

### 8.3 Gradients & decoration

| Token | Definition | Use |
|---|---|---|
| `gradient-hero` | Linear 165°, `violet-950` → `violet-800`, plus a radial glow of `violet-500` at 35% opacity centered top-right (radius ≈ 60% of width) | Hero canvas, Welcome screen |
| `gradient-primary` | Linear 135°, `#7C52F0` → `#5626D6` | Primary pill, center action |
| `gradient-deep` | Linear 150°, `violet-950` → `violet-900` | Deep duo card |
| `gradient-vivid` | Linear 150°, `#5A2BD8` → `violet-700` | Vivid duo card (toned down from the reference) |

**Orb motif** (from the reference's faded circles): on deep and vivid surfaces only, one large circle about 1,2× the card height, white at 6% opacity, offset to the bottom-right and clipped by the card; optionally one thin ring (1 dp, white 8%). Orbs are **static**, never animated, and never behind text.

### 8.4 Shape

| Token | Radius | Use |
|---|---|---|
| `radius-xs` | 8 dp | Tags, small chips |
| `radius-sm` | 12 dp | Inputs, search fields, header icon buttons |
| `radius-md` | 16 dp | Icon tiles, list-row icons, small cards |
| `radius-lg` | 20 dp | Floating action card, duo cards, pressure card |
| `radius-xl` | 28 dp | Content sheet and bottom sheets (top corners), bottom bar (top corners) |
| `radius-full` | — | Pill buttons, center action, segmented selectors, chart bars |

Spacing follows a 4 dp grid (4, 8, 12, 16, 20, 24, 32, 40). Screen gutter: 20 dp.

### 8.5 Depth

| Token | Value | Use |
|---|---|---|
| `elevation-0` | none | Lists and text on the sheet |
| `elevation-soft` | `0 2 8 rgba(26,11,69,0.05)` | Pressure card, inputs on focus |
| `elevation-float` | `0 12 32 rgba(26,11,69,0.10)` | Floating action card, bottom bar |
| `glow-primary` | `0 10 24 rgba(98,48,224,0.35)` | Primary pill and center action **only** |

At most one floating layer per region: the floating card *or* a bottom sheet, never stacked cards.

### 8.6 Typography

| Role | Font | Size / line | Notes |
|---|---|---|---|
| Hero amount | Inter Bold | 40 / 48 | Tabular figures, −0,5 letter spacing; the `Rp` prefix at 24 and 72% opacity |
| Screen title | Plus Jakarta Sans SemiBold | 20 / 28 | |
| Section heading | Plus Jakarta Sans SemiBold | 16 / 24 | |
| Amount in rows and cards | Inter SemiBold | 16–22 | Tabular figures |
| Body | Inter Regular | 15 / 22 | |
| Caption | Inter Medium | 13 / 18 | |
| Overline | Inter SemiBold | 12 / 16 | Uppercase, +0,8 letter spacing ("AVAILABLE SPENDING") |

- Inter carries every number (reliable tabular figures). Plus Jakarta Sans — a geometric typeface designed in Jakarta — gives headings their modern character.
- Both fonts are bundled with the app (works offline).

### 8.7 Signature components

| Component | Specification |
|---|---|
| **Hero canvas** | `gradient-hero`, light status-bar icons, content in `on-deep`. Bottom edge hidden by the sheet. |
| **Content sheet** | `canvas` background rising over the hero, `radius-xl` top corners. |
| **Floating action card** | `surface`, `radius-lg`, `elevation-float`, straddles the hero/sheet seam; four items, each an icon tile + caption. |
| **Icon tile** | 48 dp, `radius-md`, `violet-50` fill, 24 dp `violet-700` line icon (1,75 dp stroke). On deep surfaces: white 12% fill, white icon. |
| **Duo cards** | Two side by side, `radius-lg`, `gradient-deep` and `gradient-vivid`, orb motif, a 32 dp circular badge (white 16%) with an icon top-left, label and amount in `on-deep`. |
| **Bottom bar** | `surface`, `radius-xl` top corners, `elevation-float`; four tabs (Home, Salary, Activity, More; the reflection is reached from Home and More from M2) around a 60 dp center action in `gradient-primary` with `glow-primary`, seated in a curved cradle. Active tab `violet-600`, inactive `ink-400`, always with labels. |
| **Primary pill** | 52 dp high, `radius-full`, `gradient-primary`, white label, `glow-primary`. One per screen. On deep surfaces it inverts: white fill, `violet-800` label, no glow. |
| **Secondary pill** | 52 dp, `violet-50` fill, `violet-700` label. Used for equal-weight decisions. |
| **Text button** | `violet-700` label, no fill. |
| **Header icon button** | 40 dp, `radius-sm`; light: `surface` with 1 dp `line`; deep: white 10% fill with white 18% border. |
| **Input / search** | 48 dp, `field` fill, `radius-sm`, no border; focus ring 2 dp `violet-500`. Amount fields use Inter 32 with tabular figures. |
| **Segmented selector** | Pill with 1 dp `line` border ("Month ▾"); selected segment `violet-100`. |
| **List row** | On the sheet without its own box: icon tile, title, secondary line, amount right-aligned; 64 dp; inset divider. |
| **Pressure card** | `surface`, `radius-lg`, `elevation-soft`, caution icon tile, text, two secondary pills. |

### 8.8 Iconography

Rounded line icons, 24 dp, 1,75 dp stroke, one weight throughout. Filled icons only for the active tab. No multicolor or emoji icons.

### 8.9 Charts

- At most **one chart per screen**.
- Rounded pill bars (8 dp wide, `radius-full` tops): past months `violet-300`, the selected or current month `violet-600`.
- The salary appears as a dashed `ink-400` line, labeled at its right end.
- Dashed `line` grid at three levels; no legend unless two series are shown.
- Values appear on tap, not printed on every bar.
- Investment values are never charted on the dashboard or salary screens.

### 8.10 Dark theme

Follows the system setting.

| Token | Dark value |
|---|---|
| `canvas` | `#0F0B1A` |
| `surface` | `#18132A` (floating card, bottom bar, pressure card) |
| `field` | `#221B38` |
| `line` | `rgba(255,255,255,0.08)` |
| `ink-900` / `ink-600` | `#F3F1F8` / `#ADA8BD` |
| `violet-50` (tile) | `rgba(124,82,240,0.16)` |
| Hero and duo gradients | Unchanged |

In dark mode, soft shadows give way to 1 dp `line` borders; `glow-primary` stays.

### 8.11 Implementation notes (Expo)

- Gradients: `expo-linear-gradient`; the radial hero glow and orbs: `react-native-svg`.
- Colored shadows: the React Native `boxShadow` style (New Architecture), because Android `elevation` cannot be tinted.
- The bottom-bar cradle: an SVG path behind the center action.
- Fonts: `expo-font` with the bundled Inter and Plus Jakarta Sans packages.
- All tokens live in one theme module in `src/components` and are the only source of colors, radii, spacing and shadows.

---

## 9. Interaction Principles

- Awareness before action.
- Explain every consequential decision before it is confirmed.
- Vanea recommends; the user decides.
- Never refuse a real-world record; warn instead.
- Progressive disclosure: "Why this amount" and evidence are one tap away, not hidden.
- No dark patterns. The "decline" option is as visible as "accept": decisions that should be neutral use equal-weight secondary pills, never a glowing primary.
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
| Installment due | "Your Kredivo installment of Rp 550.000 is due today." |
| Credit line bill due | "Your PayLater bill is due today: Rp 1.500.000. Rp 1.200.000 is already set aside." |

There is no notification for raise eligibility.

---

## 11. Motion

Motion communicates state changes, confirmation, progress or navigation. It never decorates financial information.

| Moment | Motion |
|---|---|
| App open | The content sheet rises over the hero (250 ms, ease-out) |
| Press | Pills and the center action scale to 0,96 |
| Add flows | Bottom sheets slide up (220 ms) |
| Saved | A short check on the pill, then return |

- Money never counts up or animates its digits.
- Orbs and gradients never move.
- Respect the system "remove animations" setting: everything becomes an instant change.

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

Errors appear inline under the field or as a bottom sheet — never as a red full-width banner. They use `ink-900` text with a caution icon tile.

---

## 13. Visual Anti-patterns

Avoid:

- Grids of identical boxes; cards inside cards; every list row in its own card.
- More than one vivid element per screen; glow on anything but the single primary action.
- Promo banners, service grids, red notification badges.
- Rainbow or per-category colors; green gains and red losses.
- Large chart collections; more than one chart per screen.
- Animated decoration (moving orbs, shimmering gradients, counting numbers).
- Gamified scores, fake precision, compact money notation, dense tables as default.
- Constant warning colors; accounting terminology in the UI.

---

## 14. Accessibility

- WCAG AA contrast in both themes. Checked pairs:

  | Pair | Contrast |
  |---|---|
  | White on `violet-600` (center action, active accents) | 7.0 : 1 |
  | White on `gradient-primary`, lightest stop `#7C52F0` | 4.9 : 1 (AA for the pill label) |
  | White on `violet-950`–`violet-800` (hero) | 17.8–12.9 : 1 |
  | White 72% on `violet-800` (hero secondary text) | ≈ 7.5 : 1 |
  | `ink-600` on `canvas` | 6.1 : 1 |
  | `violet-700` icon on `violet-50` tile | 8.7 : 1 |
  | `caution-600` on `surface` / on `caution-100` | 5.4 : 1 / 4.9 : 1 |
  | `caution-300` on `violet-950` (overspent amount) | 10.9 : 1 |
  | `ink-400` on `surface` | 2.9 : 1 — decorative and inactive only, never essential text |

- Text never sits on an orb or on the glow.
- Font scaling up to 200% without clipping amounts; amounts may wrap below their labels, and the floating card grows taller rather than truncating.
- Touch targets ≥ 48 dp; the center action is 60 dp.
- Focus is shown with a 2 dp `violet-500` ring, not by glow alone.
- TalkBack labels read money naturally: "Available spending, 4 million 250 thousand rupiah".
- Meaning is never conveyed by color alone (overspent also uses the minus sign and text).

---

## 15. Android Behavior

- Edge-to-edge: light status-bar icons over the hero, dark icons over the sheet; transparent navigation bar with the bottom bar above the gesture area.
- Thumb-reach primary actions; numeric keypad with live thousands separators for amount fields.
- System back always works, closes bottom sheets first, and never discards a filled form without confirmation.
- Do not impose arbitrary tap-count rules when a longer flow materially improves comprehension or safety (salary decisions, imports, reversals).

---

## 16. Subscriptions, Debts & Investments Screens

All three live under **More** in the bottom bar and use the same components (§8.7). None of their numbers appear in the dashboard hero.

### 16.1 Subscriptions

```text
SUBSCRIPTIONS                                   [ + ]
Monthly commitments  Rp 725.000                       ← overline + amount on the sheet

[▢] Figma            Monthly      Rp 225.000          ← list rows, no boxes
    Next 15 Nov
[▢] Adobe CC         Yearly     Rp 2.400.000
    Rp 200.000 a month · next 3 Mar · +12% since Jan 2026
```

- **Billing cycle** is a two-option segmented selector (Monthly | Yearly) with **no option preselected**; Save stays disabled until one is chosen.
- "Did the price change?" is a bottom sheet with two equal-weight secondary pills: **Yes, from now on** · **Only this time**.
- The price-change impact uses plain text under the field, never a colored banner.
- Delete is a text button at the bottom of the edit screen; its confirmation is a bottom sheet that states what stays (history, already-paid yearly shares).

### 16.2 Debts

```text
╭──────────────────────────────────────╮  ← compact hero (deep gradient)
│ TOTAL OWED                            │
│ Rp 3.150.000                          │
│ Due this month Rp 1.500.000 · 19% of salary │
╰──────────────────────────────────────╯
  Credit lines
  [▢] PayLater           Owed Rp 1.500.000
      Due 25 Oct · Rp 1.200.000 set aside
  Loans
  [▢] Kredivo 6×         Owed Rp 1.650.000
      Next Rp 550.000 on 2 Nov · 3 of 6 left
  Salary advance
  [▢] From your Pool     Rp 1.000.000 · 1 period left
```

- Above 30%, a calm card under the hero: *"Debt payments take 38% of your salary this month."* Caution icon tile, no advice, no ranking.
- **Loan preview** before saving is a white card (radius 20) with three rows — you receive, you repay, cost of borrowing — and one plain line: *"about 365% a year"*. The cost uses `ink-900`, never red.
- The OJK line sits under the lender field as caption text with an info icon.
- **Bill payment preview** shows the split as two rows (from bill reserve · from Available Spending).
- Debts never use the vivid gradient; the hero is the only deep surface.

### 16.3 Investments

```text
╭──────────────────────────────────────╮  ← compact hero (deep gradient)
│ PUT IN                                │
│ Rp 25.000.000                         │
│ Estimate Rp 27.400.000 · oldest as of 12 Aug │  ← on-deep-muted, smaller
╰──────────────────────────────────────╯
  By asset class                (share of put in)
  Stocks            44%   ▬▬▬▬▬▬▬▬▬   High
  Crypto            32%   ▬▬▬▬▬▬     Very high
  Money market      24%   ▬▬▬▬▬      Low
  "Risk labels describe each asset class in general, not your holdings."

  [▢] BBCA            Put in Rp 11.000.000
      Estimate Rp 12.300.000 · as of 1 Oct · on paper +Rp 1.300.000
```

- **Put in** is always the large number; the estimate is secondary text with its date. Values older than 90 days add *"last updated 3 months ago"* in `ink-600`.
- **On paper** differences use neutral `ink-600` text with a plus or minus sign: no green, no red, no arrows, no celebration.
- Risk labels are small neutral tags (`radius-xs`, `line` outline). *Very high* is not colored differently from *Low*; the word carries the meaning.
- The concentration note is a single line under the allocation, never a card or notification.
- **Sell** asks "Send the cash to" with two equal-weight pills (Available Spending · Savings) and no preselection.
- No charts of investment value over time in v1, and no investment numbers on the dashboard, salary screens or notifications.
- **Net position** (More → Net position) shows three separate sections — Money, Investments (put in, estimate beside it), Debts — with no grand total.

