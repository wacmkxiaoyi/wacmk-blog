# Attachments, Media, and Imports

## Image Uploads

Supported editors can upload images directly.

Image upload availability depends on:

- whether the user is authenticated
- whether the user is in an article or comment editing context
- whether the current workflow allows media upload

## Video Uploads

Video upload is more restricted than image upload.

It depends on site policy such as:

- whether user video upload is enabled
- whether video upload is limited to VIP users
- file size limit
- accepted file extension list

## Attachment Upload Permissions

Attachment upload is separate from normal article creation permission.

The site may:

- disable uploads for normal users
- allow uploads for all eligible users
- restrict uploads to VIP users

## Attachment Management Page

Users can manage their own attachments from `My attachments`, including:

- search
- edit metadata and access rules
- download
- delete

## File Size Limits

Attachment and video uploads use site-wide size limits controlled by the administrator.

## Markdown Imports

Article import from `.md` files is supported in some article-management screens.

Important notes:

- `.md` files are expected
- UTF-8 compatible files work best
- the importer may read front matter such as title, summary, tags, and slug when present

## Import From Existing Article

The platform can also create a new draft by cloning data from an existing article.

Depending on context and permissions, this may copy fields such as:

- summary
- content
- tags
- access settings
- cover image
