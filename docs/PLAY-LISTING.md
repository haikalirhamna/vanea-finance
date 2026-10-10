# Vanea — Google Play listing and Data safety

Everything here is a draft for the owner to review and submit; nothing has been submitted.

## Store listing

- **App name:** Vanea
- **Short description (≤ 80):** Pay yourself a steady salary from irregular income. Private, on your phone.
- **Full description:**

  Vanea is for people whose income changes from month to month. Income goes into a Pool; you pay yourself a steady salary from it; Vanea shows what you can spend today and tells you calmly when your salary is running ahead of your income.

  - A salary recommendation based on your weakest months, never your best
  - Available Spending and a daily allowance that already accounts for bills and installments due before payday
  - Business costs, subscriptions (yearly ones spread over 12 months), PayLater, cards and loans, with the real cost of borrowing
  - Investments recorded by what you put in, with dated estimates that never count as spending money
  - Monthly Kakeibo reflection, with no scores or streaks
  - Everything stays on your phone: encrypted database, no account, no analytics, no internet permission
  - Encrypted backup you control

- **Category:** Finance · **Contact email / privacy policy URL:** _owner to provide; publish `docs/PRIVACY.md` at a public URL_
- **Screenshots:** capture on a real device from the production build (Home, Salary, Add expense, Debts, Reflection).

## Data safety form (what the app does)

| Question | Answer |
|---|---|
| Does the app collect or share any of the required user data types? | **No.** No data is collected or shared. |
| Is all user data encrypted in transit? | Not applicable: no data is transmitted. |
| Can users request that their data is deleted? | Data is only on the device; uninstalling or clearing storage deletes it. |
| Does the app use the INTERNET permission? | No (production build). |

Because the app has no network access, the form's collection and sharing sections are all "No".

## Content rating and policies

- Complete the content rating questionnaire (finance tool, no user-generated content, no ads).
- **Financial features declaration:** Vanea is a personal tracker. It does not offer loans, give investment advice, or move money. State this in the declaration.
- Investments are described as the user's own records; asset-class risk labels are general labels for the class, not advice.

## Closed testing requirement

New personal developer accounts must run a closed test with at least 12 testers for 14 consecutive days before applying for production. Recruit testers while M4 finishes.
