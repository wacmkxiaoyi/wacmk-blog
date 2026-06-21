# Books and Chapters

## What a Book Is

A book is a structured collection of one or more articles.

Books can be used for:

- serialized reading
- grouped tutorials
- paid or gated content collections
- chapter-based libraries

## Book List

The book list shows:

- title
- summary
- cover image
- author
- article count
- access badges
- VIP badge when applicable
- star button

## Book Detail Flow

Opening a book is different from opening a standalone article.

The platform can perform two separate checks:

1. book-level access
2. chapter-level access for the currently selected article

This means a book itself can be accessible while a specific chapter still requires additional access.

## Chapter Selection

The book page can choose a chapter by:

- the chapter requested in the URL query
- or the first accessible chapter if no chapter is requested

## Chapter Navigation

Books can include:

- flat article lists
- grouped chapter sections
- reordered structures created by the book editor

## Book-Only Articles

Some articles are intended to be read only inside book context.

These are often called `book-only` articles.

Important behavior:

- they may not appear in the normal article list
- they may not open as normal standalone article pages
- they can still appear and be readable inside a book

## No Accessible Chapter Case

If a book is visible but no chapter is currently accessible, the page can still open and explain that no accessible articles are available yet.

## Shared Book Pages

A public shared book page is not identical to a normal authenticated book page.

The book may still hide or restrict some chapters depending on chapter-level rules.
