# Creating and Managing Articles

## Who Can Create Articles

Article creation depends on site policy.

The site may choose one of several models:

- only staff can create articles
- non-admin users can create articles
- only VIP users can create articles among non-admin users
- non-admin users can create articles only up to a configured limit

## Where Users Manage Their Articles

Users who are allowed to create articles typically use `Profile settings -> My articles`.

Staff can also manage articles from the management workspace.

## Ways to Start an Article

The platform can allow three common starting points:

- create a new blank article
- import from an existing article
- import from a `.md` file

## Article Editor Fields

The article editor can include:

- title
- slug
- tags
- summary
- cover image
- allow reprint
- allow quote
- visibility
- access scope
- condition rules
- VIP access permission
- VIP condition rules
- main Markdown content

## Condition Types in Articles

Articles support condition types such as:

- money
- points
- encrypted password
- book-only

## Unified vs Standalone on Articles

If access scope is `unified`, everyone uses the same article rule set.

If access scope is `standalone`, VIP users may use a separate VIP rule set.

## Drafts and Revisions

### Drafts

Unpublished work is saved as a draft.

### Revisions

When editing a published article, the platform can save the changes into a revision draft instead of overwriting the live article immediately.

This helps preserve the published version until the revision is ready.

## Revision Behavior to Understand

- one published article can have a saved revision draft
- editors may be prompted to continue or replace an existing revision
- publishing the revision updates the live article

## Markdown Features in the Editor

The editor can support:

- side-by-side preview
- image upload
- video upload when the site allows it
- attachment insertion
- internal reference insertion
- tables
- callouts
- tabbed blocks
- emoji support
- colored text support

## Autosave and Recovery

If enabled by the site administrator, the editor can save local recovery content in the browser during editing.

Important notes:

- this is browser-side recovery
- it is not the same as server draft history
- it is intended to help with accidental page loss

## Publishing

When ready, use the publish action to turn the article into a live published page.

## Share-Link Eligibility

Published public articles without access conditions may be eligible for external share links.

If the article later becomes restricted, those share links can be invalidated automatically.
