# Administrator Manual

## Scope

This manual is the operator reference for `wacmk-blog`.

It is based on the current application code, templates, forms, management views, services, and management commands. It is intended for staff users, superusers, and deployment operators.

This application is not just a simple blog. It is a publishing platform with:

- user authentication and registration
- article and book publishing
- attachment-based resource delivery
- conditional access rules
- money, points, and VIP business logic
- audit logging
- background media cleanup
- optional Live2D assistant runtime

## Architecture Summary

### Main Stack

- Django templates
- MySQL through PyMySQL
- dotenv-based environment loading
- stdout logging
- Markdown rendering with custom content extensions
- Pillow for image processing

### Main Functional Areas

- Authentication: login, registration, email verification, password reset
- Authenticated dashboard: home page, statistics, trends, latest content
- Reading: articles, books, tags, search, share pages
- Personal workspace: profile, posts, books, attachments, comments, money, points, user group view
- Management workspace: site settings, users, articles, books, attachments, comments, audit logs

## Deployment

### Requirements

- Python runtime compatible with project dependencies
- MySQL server
- writable `media/` storage
- SMTP service if registration, email verification, or password reset should work

### Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env`.
4. Fill in database, Django, and email values.
5. Create the configured MySQL database.
6. Apply migrations:

```bash
python manage.py migrate
```

7. Create the first superuser:

```bash
python manage.py createsuperuser
```

8. Start the application:

```bash
python manage.py runserver 0.0.0.0:8000
```

## Command Quick Reference

### Daily Development and Operations

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

### Audit Cleanup

```bash
python manage.py cleanup_audit_logs
```

Use this when audit cleanup is enabled and you want to remove expired audit log records based on the configured retention days.

### Unused Media Cleanup

```bash
python manage.py cleanup_unused_media --dry-run
python manage.py cleanup_unused_media
python manage.py cleanup_unused_media --job-id 123
```

Use `--dry-run` first when you want to inspect what would be removed.

The `--job-id` form is used internally by the management UI when a cleanup job is started from the attachments page.

### Locale

```bash
python manage.py makemessages -l en
```

### Vendor Assets

```bash
python scripts/update_vendor_assets.py --verbose
python scripts/update_vendor_assets.py --apply --verbose
python scripts/update_vendor_assets.py --resource fontawesome --apply
python scripts/update_vendor_assets.py --resource katex --apply
python scripts/update_vendor_assets.py --resource live2d_runtime --apply
python scripts/update_vendor_assets.py --apply --allow-major
```

### Common Safe Usage Pattern

For maintenance commands that can delete data or files, prefer this order:

1. back up database and media if necessary
2. run preview or dry-run mode when available
3. run the real command
4. inspect logs and the application UI afterward

## Environment Variables

### Django

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_TIME_ZONE`
- `DJANGO_LOG_LEVEL`
- `APP_NAME`

### Database

- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_HOST`
- `MYSQL_PORT`

### Email

- `EMAIL_BACKEND`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS`
- `DEFAULT_FROM_EMAIL`

### Rate Limiting

- `COMMENT_RATE_LIMIT_PER_MINUTE`

### Important Runtime Notes

- `.env` is loaded automatically from the project root.
- Registration requires both the site setting `enable_register` and a working email configuration.
- Forgot-password requires working email configuration.
- Comment rate limiting is environment-driven, not site-setting-driven.

## Routes and Workspaces

### Public and Authentication Routes

- `/login/`
- `/register/`
- `/forgot-password/` through login-page action
- `/share/<token>/` article share page
- `/book-share/<token>/` book share page

### Authenticated Reading and Profile Routes

- `/`
- `/articles/`
- `/blog/<slug>/`
- `/books/`
- `/book/<slug>/`
- `/search/`
- `/tags/`
- `/tags/<slug>/`
- `/profile/`

### Management Routes

- `/manage/`
- `/manage/basic/`
- `/manage/users/`
- `/manage/posts/`
- `/manage/books/`
- `/manage/attachments/`
- `/manage/comments/`
- `/manage/audit/`

### Django Admin

- `/admin/`

## Staff Trust Model

### What `staff` Means in This Application

The `/manage/...` workspace is an application-level staff workspace. It is separate from Django admin.

If a user has `is_staff=True` or `is_superuser=True`, that user can access the management workspace.

### Important Operational Consequences

- There is no fine-grained section-by-section management permission model.
- Staff broadly receives access to Users, Articles, Books, Attachments, Comments, Audit, and Site Settings.
- Several user-facing restrictions are bypassed for staff in management paths.
- The application assumes staff users are trusted operators.

### Recommendation

- Use `staff` only for operators who should manage application content and users.
- Reserve `superuser` for a very small number of trusted administrators.

## Authentication Operations

### Login

- Users can log in with username or email.
- `Remember me` extends the session to 14 days.
- Without `Remember me`, the session expires when the browser session ends.
- First successful login of the day may grant daily money and points rewards.

### Registration

- Registration is available only when enabled in site settings and email delivery is ready.
- Registration uses 6-digit email verification codes.
- Code expiry and resend cooldown come from site settings.
- New users are added to `normal_user` after successful verification.

### Forgot Password

- Password reset is triggered from the login page.
- The system generates a strong temporary password and emails it immediately.
- If email sending fails, the password is rolled back.
- The response does not reveal whether the account exists.

### Email Change

- Users can change email from profile security.
- Email change uses the same verification-code model as registration.

## Site Settings

The main settings screen is `Website management -> Basic`.

Settings are stored as key/value rows in the database and resolved with code-defined defaults.

### Key Warning

Settings are global and effective immediately. There is no built-in version history, diff view, export feature, or approval workflow.

### Basic Information

- site title
- site icon
- authentication background image
- authenticated-page background image

### Dashboard

- visit trend range: 7, 14, or 30 days

### Registration and User Controls

- enable registration
- code expiry seconds
- code resend seconds
- daily login reward money
- daily login reward points

### VIP Controls

- maximum VIP level
- per-level display name
- money discount
- points discount
- author reward bonus for money
- author reward bonus for points
- daily login bonus money
- daily login bonus points
- first comment bonus money
- first comment bonus points

### Article Controls

- allow non-admin article creation
- non-admin maximum article count
- VIP-only article creation
- post editor autosave enabled
- autosave interval in minutes
- article author reward ratios

### Book Controls

- allow non-admin book creation
- non-admin maximum book count
- VIP-only book creation
- book author reward ratios

### Attachment Controls

- allow user attachment upload
- VIP-only attachment upload
- attachment maximum size in MB
- attachment author reward ratios

### Video Controls

- allow user video upload
- VIP-only video upload
- video maximum size in MB

### Comment Controls

- allow user comment
- VIP-only comment
- first comment reward money
- first comment reward points

### Audit Log Controls

- audit log cleanup enabled
- audit log retention days

## Defaults and Restore Defaults

### Default Behavior

Every setting has a code-defined default in the application.

### Warning About Reset

`Restore defaults` is destructive.

It does not only reset scalar values. It also deletes:

- all persisted `SiteSetting` rows
- stored site icon files
- stored authentication background files
- stored application background files
- Live2D widget bundles
- Live2D Cubism bundles
- extracted Live2D bundle directories

### Deployment Caveat

Because defaults live in code, a future deployment can change what a later reset restores.

## Live2D Administration

### Available Source Types

- CDN
- widget bundle upload
- Cubism runtime bundle upload

### Widget Bundle Rules

- must be uploaded as `.zip`
- must contain `manifest.json` at archive root
- must contain required JS, CSS, and tips files declared by the manifest

### Cubism Bundle Rules

- must be uploaded as `.zip`
- may omit `manifest.json` if `.model3.json` files exist
- all runtime dependencies referenced by each `.model3.json` must exist in the archive

### Bundle Removal and Replacement Rule

If Live2D remains enabled in `widget_bundle` or `cubism_bundle` mode, the form blocks removing the currently active bundle unless a replacement is uploaded in the same save operation.

### Page Group Controls

Live2D can be enabled or disabled by page group:

- home
- article list
- article detail
- book list
- book detail
- tag pages
- search
- profile
- public share pages
- manage pages

### Tips Mode

- builtin
- custom
- hybrid

### Operational Advice

- Test new bundles in a non-production environment first.
- Live2D is desktop-oriented and hidden on narrow viewports.
- Runtime behavior depends on browser support and bundle quality.
- There is no dedicated admin preview/test button.

## Dashboard Behavior

### Important Scope Note

The home dashboard is not staff-only. It is an authenticated dashboard with some staff-only shortcuts.

### Dashboard Data

- article and book traffic in the last 7 days
- total posts
- published posts
- drafts
- tag count
- book count
- attachment count
- author count
- recent activity count
- visit trend chart

### Staff-Specific Affordances

- staff and superusers see article-writing shortcuts from the dashboard

## User Management

### User List

The user list supports:

- search by username, display name, or email
- sorting
- quick role and state inspection
- access to public namecards

### Add User

The `Add user` flow is a JavaScript modal that submits to a JSON endpoint.

Operational implications:

- it is JS-dependent
- it is POST-only
- it reloads the page after success
- no strong no-JS fallback is provided in the UI flow

### Editable Fields

Administrators can manage:

- display name
- email
- password
- active flag
- staff flag
- superuser flag
- business identity / VIP group mapping
- profile fields
- avatar
- money
- points

### High-Risk Role Warning

The management form can grant `is_staff` and `is_superuser`.

This should be treated as a privileged action.

### Identity and Group Model

- `normal_user` is the default business group
- VIP identities are represented through `vip_<level>` groups
- a legacy `vip` group still has compatibility behavior
- username is effectively immutable in this UI

### Money and Points Adjustments

When staff edits balances, the system records deltas through history services rather than replacing balances without history.

There is no dedicated financial ledger workspace beyond the user history screens.

## Article Management

### Article List Tabs

- published
- drafts and revisions
- external links

### Article Creation

Staff can:

- create a blank article
- import from an existing article
- import from a `.md` file

### Revision Workflow

Editing a published article does not always write directly to the live object.

The system supports one revision draft per published article.

Operators can:

- continue editing an existing revision
- discard and recreate the revision from the live article
- publish the revision later

### Markdown Import Constraints

- only `.md` files are supported
- the file must be UTF-8 compatible

### Share Link Rules

Article share links are available only when the article is:

- published
- public
- free of access conditions

If an article later becomes non-public or conditional, its share links are deleted automatically.

## Book Management

### Book Editor Capabilities

- metadata editing
- access-rule editing
- cover image upload
- chapter grouping
- chapter ordering
- chapter search and selection

### Book Structure Rules

The saved structure and selected posts must stay synchronized. Invalid or stale references are normalized away during validation.

### Deletion Behavior

Deleting a book does not delete its articles.

### Share Link Rules

Book share links are allowed only when the book is public and has no access conditions.

If the book becomes non-public or conditional later, share links are deleted automatically.

## Attachment Management

### Attachment List

The staff list supports:

- search by title, filename, or uploader
- sorting
- access summary display
- edit
- download
- delete
- media cleanup start

### Attachment Edit Workflow

Attachment editing is a JavaScript modal and AJAX update flow, not a normal full-page edit form.

### File Replacement and Deletion Warning

Replacing or deleting an attachment immediately affects physical storage.

- old files are removed on replacement
- deleted attachments remove the underlying file
- there is no trash or soft-delete layer

### Validation Limits

- file size uses site settings
- validation is primarily extension- and size-based
- no built-in virus scanning is present

## Media Cleanup

### What It Does

The media cleanup flow scans `MEDIA_ROOT`, compares filesystem content against database and content references, and deletes unreferenced files and directories.

### UI Workflow

1. Open `Website management -> Attachments`.
2. Click `Clean up`.
3. Confirm the action.
4. The application creates a cleanup job row.
5. A background subprocess runs `python manage.py cleanup_unused_media --job-id <id>`.
6. The UI polls job status every 3 seconds.
7. The cleanup button remains disabled while a job is active.

### Important Limits

- only one pending or running cleanup job is allowed at a time
- there is no cancellation UI
- the UI does not expose command dry-run mode
- cleanup is destructive and permanent

### Reference Detection Caveat

The cleanup logic is careful, but reference detection is pattern-based. Highly unusual custom references may be missed.

## Comment Moderation

### Staff Capabilities

- search comments
- edit comments
- delete comments

### Edit Workflow

The comment editor in management is modal- and JavaScript-driven.

### Moderation Scope

Staff moderation is broader than normal user comment permissions. Staff can moderate comments even when public commenting is globally disabled or VIP-only.

## Audit Logs

### Logged Events

- login
- logout
- post create/update/delete
- comment create/update/delete
- profile update
- user create/update/delete
- user asset update

### Audit Search and Sorting

The audit screen supports search and sorting by:

- action
- user
- time

### Clear Audit Logs Warning

`Clear` deletes the entire audit table immediately.

Important caveats:

- irreversible
- no export UI
- no built-in backup step
- the clear action itself is effectively not preserved as a later audit row because the table is wiped

### Action Label Caveat

Some operational events reuse generic post-related audit action labels. Operators should read the message text, not only the action column.

## Scheduled Cleanup Commands

### Audit Logs

```bash
python manage.py cleanup_audit_logs
```

### Unused Media

```bash
python manage.py cleanup_unused_media --dry-run
python manage.py cleanup_unused_media
```

### Scheduling Responsibility

The application does not include an internal scheduler, worker queue, or retry framework.

Use your operating system scheduler.

Examples:

- Linux cron:

```bash
0 3 * * * /path/to/venv/bin/python /path/to/project/manage.py cleanup_audit_logs
```

- Windows Task Scheduler:

```bash
python manage.py cleanup_audit_logs
```

## Access Control Model

### Base Visibility

- `public`
- `private`
- `conditional`

### Supported Condition Types

- `money`
- `points`
- `encrypted`
- `book_only` for articles only

### Critical Semantics

- `money` means the user can spend balance to unlock content
- `points` means the user must already hold enough points; points are not spent
- `encrypted` means password verification is required and remembered per user/object
- `book_only` means the article should be read inside a book context rather than directly

### Unified vs Standalone

- `unified`: VIP and non-VIP use the same base rules
- `standalone`: VIP users can use a separate VIP rule path

### Important VIP Clarification

Standalone VIP access is not just a discount. It can change:

- effective visibility
- effective conditions
- what counts as granted access for a VIP user

### Discount Clarification

VIP discounts can reduce money and points requirements even on unified conditional content.

## Money, Points, Rewards, and Purchases

### User Asset Types

- money
- points

### Daily Login Reward

- once per day
- base reward from site settings
- optional VIP bonus from VIP config

### First Comment Reward

- once per user per article
- replies also count as the first qualifying comment if no earlier comment exists on that article
- base reward from site settings
- optional VIP bonus from VIP config

### Purchases

Only money-based conditions create purchase records.

- articles
- books
- attachments

Points do not create purchase records because points are not spent.

### Author Rewards

Authors can receive one-time rewards when a reader first successfully accesses eligible conditional content.

Important clarifications:

- the reward is based on configured condition values and reward ratios
- points-based author reward can exist even though the reader's points are not deducted
- VIP reader bonuses can increase author rewards

## Share Pages

### What Share Pages Are For

Share pages expose public, condition-free articles or books to external visitors.

### Important Restrictions

- share links are not bypass links for protected content
- interaction is restricted compared to normal authenticated pages
- comments may be visible, but interactive actions are limited on share pages

## JavaScript Dependency Notes

Several major management workflows depend on JavaScript:

- add user
- comment edit
- attachment edit
- book chapter builder
- article revision choice dialog
- share-link dialog
- background cleanup polling
- unsaved-change protection

### Operational Recommendation

Always validate these workflows in a real browser session. Do not assume plain HTML form fallback is sufficient.

## Logging

- application logs go to stdout
- Django logs go to stdout
- log level comes from `DJANGO_LOG_LEVEL`

This is suitable for Docker, service managers, and centralized logging.

## Localization

Generate English locale messages with:

```bash
python manage.py makemessages -l en
```

## Recommended Operating Checklist

### After Deployment

1. Verify `.env` values.
2. Confirm database connectivity.
3. Test login with username and email.
4. Test registration if enabled.
5. Test password reset email.
6. Review site settings.
7. Schedule audit cleanup.

### Before Role Changes

1. Confirm whether `staff` is sufficient.
2. Avoid granting `superuser` unless strictly necessary.
3. Review business identity and VIP group mapping.

### Before Running Destructive Operations

1. Confirm backups for database and media.
2. Review whether a reset or delete affects files on disk.
3. For media cleanup, prefer command-line dry-run before broad production use.

### Before Publishing Access-Controlled Content

1. Test access as a normal user.
2. Test access as a VIP user.
3. Test share-link eligibility.
4. Verify money, points, password, and book-only behavior.
