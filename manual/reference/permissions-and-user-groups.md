# Permissions and User Groups

## Main User Classes

The site usually behaves differently for four broad user classes:

- guest visitor
- normal logged-in user
- VIP user
- staff or superuser

## Guest Visitor

Guest visitors usually have the most limited experience.

They may be able to:

- open some public share pages
- see login and registration flows

They usually cannot use the full normal reading workspace or profile workspace.

## Normal Logged-In User

Normal users can usually:

- browse accessible articles and books
- use search and tags
- manage their profile
- comment when allowed
- interact with stars and feedback when allowed

Creation and upload rights still depend on site settings.

## VIP User

VIP users may receive:

- access to VIP-only creation permissions
- upload permissions unavailable to normal users
- discounted conditional requirements
- extra reward bonuses
- separate standalone VIP access rules on some content

## Staff User

Staff users can access the management workspace from the user menu.

They can typically manage:

- site settings
- users
- articles
- books
- attachments
- comments
- audit logs

## Superuser

Superusers can do everything staff users can do, and they also carry broader Django-level administrative power.

## Business Identity

The site may describe the current account using labels such as:

- normal user
- VIP 1
- VIP 2
- higher configured VIP levels

This identity affects both presentation and business rules.

## Why Group Information Matters to Users

The active user group can affect:

- what creation buttons appear
- whether upload features appear
- what discount is shown in access gates
- whether a VIP badge appears on the account summary
- which rewards are granted on login or first comment
