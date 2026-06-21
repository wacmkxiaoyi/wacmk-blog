# Books and Attachments

## Books

### Who Can Create Books

Book creation can be:

- staff-only
- allowed for non-admin users
- limited to VIP users among non-admin users
- limited by a configured maximum number of books

### What a Book Editor Does

The book editor can manage:

- name
- slug
- summary
- cover image
- visibility
- access scope
- condition rules
- VIP access permission
- VIP condition rules
- structured chapter arrangement

### Chapter Builder

The chapter builder lets users:

- search available articles
- add selected articles
- create groups
- rename groups
- move items up and down
- remove items from the structure

### Structure Rules

The saved chapter structure must stay consistent with the selected article set.

If some referenced articles disappear or become invalid, the structure can be normalized automatically.

### Book Access vs Chapter Access

A book and its chapters are not always governed by the same access result.

A user may pass the book gate but still hit a chapter gate later.

## Attachments

### Important Creation Model

Attachments are usually created through editor workflows rather than through a simple standalone `new attachment` page.

For example, a user may upload or insert an attachment while working in a content editor.

### Attachment Features

Attachments can have:

- title
- file metadata
- access rules
- VIP access rules
- download counts

### Attachment Access Patterns

Attachments can be:

- public
- private
- conditional

Conditional attachments can require:

- money purchase
- points threshold
- password verification

### Attachment Rendering Inside Content

Attachments can also appear as embedded cards inside rendered Markdown content.

Seeing an attachment card does not always mean the file is freely downloadable. The card may still lead into an access check.
