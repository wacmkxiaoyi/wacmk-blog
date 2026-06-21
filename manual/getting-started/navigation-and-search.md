# Navigation and Search

## Top Navigation

After login, the main header usually includes:

- `Home`
- `Articles`
- `Books`
- `Tags`
- a centered search box on most pages
- the user menu in the top-right corner

## User Menu

The user menu can show:

- avatar or avatar fallback
- display name
- current business identity or VIP label
- money balance
- points balance
- profile settings link
- website management link for staff users
- sign-out button

## Search Is Context-Sensitive

The top search box is not a single universal search entry for every content type.

Its destination depends on the page you are currently viewing.

### On Article-Oriented Pages

The search box usually sends the query to the article list.

### On Book Pages

The search box usually sends the query to the book list.

### On Tag Pages

The search box usually sends the query to the tag directory.

## Dedicated Search Page

There is also a dedicated search result page at `/search/`.

That page is focused on article results and can search fields such as:

- title
- summary
- article body
- related book name
- tag name
- author username
- author display name

## Important Search Limitation

The dedicated search page returns article results, not a mixed list of books, tags, attachments, and users.

## Header Differences on Share Pages

Public share pages do not use the same full authenticated header. Their toolbar is intentionally much more limited.
