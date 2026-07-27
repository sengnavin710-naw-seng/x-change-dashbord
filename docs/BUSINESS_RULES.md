# Business Rules

This document records rules confirmed in the current implementation. Do not add a new
meaning for an Excel column or business term until the project owner confirms it.

## Canonical terms

### Opening Balance

Opening Balance is the capital held when the shop started operating. It is reference
information and is configured in THB and MMK. Values are stored as data and are not
hard-coded in the application.

### Currency Exchange Balance

Currency Exchange Balance is the carried-forward exchange balance used as the starting
point for balance movement from a configured calculation date. It is separate from
Opening Balance.

The database retains legacy column names for compatibility, but the UI and documentation
use the confirmed business terms above.

### Base Rate

Base Rate is the shop's purchase-cost rate. Customer buying and selling rates are
derived from the Base Rate:

```text
THB → MMK customer rate = Base Rate + THB → MMK spread
MMK → THB customer rate = Base Rate - MMK → THB spread
```

The rate configuration UI may collect the three business-facing rates and derive both
spreads. A rate becomes applicable according to its effective timestamp and remains
available as historical data.

## Exchange transactions

### THB → MMK

```text
Calculated MMK payout = IN THB / customer rate
Formula Profit (THB) = IN THB - (Calculated MMK payout × Base Rate)
Actual Settlement Profit (THB) = IN THB - (Actual MMK payout × Base Rate)
Settlement Variance (THB) = Actual Settlement Profit - Formula Profit
```

### MMK → THB

```text
Calculated THB payout = IN MMK × customer rate
Formula Profit (THB) = (IN MMK × Base Rate) - Calculated THB payout
Actual Settlement Profit (THB) = (IN MMK × Base Rate) - Actual THB payout
Settlement Variance (THB) = Actual Settlement Profit - Formula Profit
```

The Dashboard profit uses `Formula Profit`. Actual payout, actual settlement profit, and
settlement variance remain separate and do not silently replace formula profit.

If a transaction overrides its applicable spread, the override is recorded and must
include a reason. Editing a transaction recalculates dependent values and refreshes
affected summaries.

## Cash / Bank transactions

Cash/Bank supports THB and MMK in both directions:

- Bank → Cash
- Cash → Bank

```text
Profit = Principal Amount × Fee Rate
Received Amount = Principal Amount + Profit
```

A zero fee rate is valid. Principal is shown once; cash and bank movement columns show
where the principal and received amount move for the selected direction.

## Expenses

- An expense has a date/time, currency, amount, and Particular/Description.
- Expenses are summarized separately in THB and MMK.
- Expenses are not deducted from Exchange Profit or Cash/Bank Profit.
- Expenses do not contribute to Total Profit.

## Profit and summaries

For a selected period:

```text
Profit (THB) = Exchange Formula Profit (THB) + Cash/Bank Profit (THB)
Profit (MMK) = Cash/Bank Profit (MMK)
```

The default Total Profit period is the current month. Date filters can request another
period without changing the independent Summary Details period.

Voided transactions are excluded from balances, profit totals, summaries, and active
transaction history.

## Balance calculation

Current Exchange Balance starts from the configured Currency Exchange Balance and applies
non-voided Exchange transaction movement up to the selected date. Opening Balance remains
reference capital and is not automatically substituted for the carried-forward exchange
balance.

## Corrections and history

- Historical transactions may be corrected.
- Corrections recalculate affected daily, monthly, and selected-period values.
- Updates and voids preserve a `record_revision` entry with the actor, timestamp, reason,
  previous value, and resulting value.
- Records are voided rather than physically deleted by normal application operations.

## Excel compatibility boundary

- Legacy helper columns H and I are not part of the web application.
- The legacy yellow band is not a business entity.
- The application follows confirmed formulas rather than copying broken or missing Excel
  formulas.
- Excel remains a comparison source during validation, not the database of record after
  approved migration.
