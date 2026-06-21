# Money, Points, and VIP

## Money and Points Are Different Systems

This platform uses both money and points, but they do not behave the same way.

## Money

Money is used as a spendable balance.

When content uses a money condition, the platform may allow the user to purchase access. If the purchase succeeds:

- money is deducted
- an unlock record is stored
- the content stays unlocked for that user account

## Points

Points are usually a threshold-based resource.

When content uses a points condition, the platform usually checks whether the user already has enough points.

Important behavior:

- points are usually not spent to unlock the content
- points are usually not deducted
- no purchase button is needed if the user already meets the threshold

## Why This Matters

Users often expect money and points conditions to behave the same way. They do not.

Think of them like this:

- money = purchase
- points = qualification threshold

## VIP Identity

VIP is group-based and tier-based.

Depending on configuration, VIP can affect:

- content access rules
- discounts on money requirements
- discounts on points requirements
- comment and upload permissions
- article and book creation permissions
- daily login bonuses
- first comment bonuses
- author reward bonuses

## Unified vs Standalone VIP Access

### Unified

VIP users use the same base rule path as everyone else.

### Standalone

VIP users can use a different access rule path for the same object.

This can change both visibility and conditions, not just the discount percentage.

## VIP Discounts

VIP users can receive discounted requirements on supported conditional content.

These discounts can apply even when the content uses unified access rather than standalone VIP access.

## Author Rewards

When a reader first successfully accesses certain kinds of conditional content, the author can receive a reward.

Important notes:

- the reward can be based on money conditions
- the reward can also be based on points conditions
- reader VIP bonuses can increase the author's reward

## Histories

Money and points changes are usually recorded in separate history views so users can inspect why balances changed.
