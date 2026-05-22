# Wacmk Server Authenticator

A lightweight Django website scaffold with MySQL support, environment-based configuration, stdout logging, and a cute anime-inspired login experience.

## Stack

- Django templates
- MySQL via PyMySQL
- Environment variables for runtime configuration
- Standard output logging for Docker-friendly deployment

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
- `/` authenticated dashboard page
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

## Logging

Application and Django logs are configured to use standard output so the app works cleanly in Docker containers and other process-based runtimes.
