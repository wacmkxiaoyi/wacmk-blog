# Wacmk Blog

A lightweight Django website scaffold with MySQL support, environment-based configuration, stdout logging, a cute anime-inspired login experience, and a built-in blog workspace.

## Stack

- Django templates
- MySQL via PyMySQL
- Environment variables for runtime configuration
- Standard output logging for Docker-friendly deployment
- Markdown-powered blog publishing with image upload
- Independent profile and management pages

## Quick Start

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and update the values.
4. Create the MySQL database configured in `.env`.
5. Run migrations:

```bash
python manage.py migrate
```

6. Create a superuser if needed:

```bash
python manage.py createsuperuser
```

7. Start the development server:

```bash
python manage.py runserver 0.0.0.0:8000
```

## Default Routes

- `/login/` login page
- `/register/` registration page when enabled
- `/` authenticated blog home page
- `/blog/<slug>/` article details
- `/search/` article search
- `/profile/` personal settings
- `/manage/` article management
- `/manage/users/` user management
- `/manage/audit/` access audit logs
- `/admin/` Django admin

## Configuration

Important settings are read from environment variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_TIME_ZONE`
- `DJANGO_LOG_LEVEL`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `APP_NAME`
- `ENABLE_REGISTER`
- `EMAIL_BACKEND`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS`
- `DEFAULT_FROM_EMAIL`
- `REGISTER_CODE_EXPIRE_SECONDS`
- `REGISTER_CODE_RESEND_SECONDS`

Registration is available only when `ENABLE_REGISTER=true` and the required email settings are configured. Verification emails use the `APP_NAME` branding value, send both plain text and HTML content, and new users are added to the `normal_user` group after they verify their email code.

When the required email settings are configured, the login page also provides a forgot-password action. It resets the account password to a strong random temporary password and sends it to the user's registered email address without revealing whether the username exists.

The project also includes a reusable global modal layer with tone-specific stacking levels for notice, attention, warning, and error states. Confirm actions are aligned to the right and cancel actions to the left to keep interactions consistent across the site.

## Blog Workspace

After login, users land on a themed blog homepage instead of the old placeholder dashboard.

- Top navigation: home icon, centered search, avatar dropdown
- Personal settings: nickname, email, avatar, password update
- Post management: create, edit, publish, delete posts
- Markdown editor: EasyMDE with side-by-side preview and image upload support
- User management: edit account state and staff permissions
- Audit logs: login/logout, profile updates, post changes, and user maintenance actions

## Audit Log Cleanup

Website management -> Basic settings now includes audit log cleanup controls.

- Enabled by default
- Default retention is 30 days
- Cleanup is executed by the Django management command `python manage.py cleanup_audit_logs`

Recommended scheduling: run the command once per day from your operating system scheduler.

- Linux cron example: `0 3 * * * /path/to/venv/bin/python /path/to/project/manage.py cleanup_audit_logs`
- Windows Task Scheduler example: run `python manage.py cleanup_audit_logs` daily

## Additional Dependencies

- `Markdown` for server-side Markdown rendering
- `Pillow` for avatar and cover image handling

## Logging

Application and Django logs are configured to use standard output so the app works cleanly in Docker containers and other process-based runtimes.
