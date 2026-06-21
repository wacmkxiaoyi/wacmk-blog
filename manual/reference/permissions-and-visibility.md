# Permissions and Visibility

## Reading Permissions and Feature Permissions Are Different

This platform separates two ideas:

- whether a user can read or unlock a specific object
- whether a user is allowed to create, upload, or comment at all

## Visibility Modes

- `public`
- `private`
- `conditional`

## Condition Types

- `money`
- `points`
- `encrypted`
- `book_only` for articles

## Effective Visibility

The site can evaluate the same object differently for different users.

For example:

- the author can bypass ordinary restrictions
- staff can bypass many ordinary restrictions
- a VIP user may use a standalone VIP rule path

This is why a document may look public to one user and conditional to another.

## Feature Permissions

Examples of feature permissions include:

- whether non-admin users can create articles
- whether non-admin users can create books
- whether users can upload attachments
- whether users can upload videos
- whether users can comment

These permissions depend on site policy and may also depend on VIP status.

## Missing Button Explanations

If a user cannot see a button described in the manual, common reasons are:

- the feature is disabled globally
- the account is not logged in
- the account is not VIP when the feature is VIP-only
- the account is not staff when the feature is management-only
- the content is private or conditional
- the object is intended for book-only reading context

## Direct Access vs Book Context

Some articles can behave differently depending on where they are opened from.

An article may be:

- unavailable as a direct article page
- visible and readable inside a book

That is normal for book-only content.
