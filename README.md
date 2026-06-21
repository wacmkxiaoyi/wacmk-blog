# Wacmk Blog Documentation Portal

This repository contains the `wacmk-blog` application and its project documentation.

## Main Documentation

- Administrator manual: [ADMIN_MANUAL.md](./ADMIN_MANUAL.md)
- User manual: [manual/README.md](./manual/README.md)

## What Each Document Is For

### Administrator Manual

Use [ADMIN_MANUAL.md](./ADMIN_MANUAL.md) if you need:

- deployment steps
- environment variable setup
- site settings reference
- user and content management guidance
- audit and media cleanup operations
- Live2D administration notes
- command quick reference

### User Manual

Use [manual/README.md](./manual/README.md) if you need:

- task-based user guidance
- registration and login help
- reading and search guidance
- access-rule explanations
- article, book, and attachment workflows
- comments, rewards, VIP, and visibility explanations

## Recommended Reading Paths

### I am deploying or operating the site

- [ADMIN_MANUAL.md](./ADMIN_MANUAL.md)

### I am a user trying to understand the product

- [manual/README.md](./manual/README.md)

### I need to understand permissions, VIP, money, or points

- [manual/reference/money-points-vip.md](./manual/reference/money-points-vip.md)
- [manual/reference/permissions-and-visibility.md](./manual/reference/permissions-and-visibility.md)
- [manual/reference/permissions-and-user-groups.md](./manual/reference/permissions-and-user-groups.md)

### I want to create or manage content

- [manual/create/articles.md](./manual/create/articles.md)
- [manual/create/books-and-attachments.md](./manual/create/books-and-attachments.md)
- [manual/create/attachments-media-and-imports.md](./manual/create/attachments-media-and-imports.md)

## Runtime Summary

The application is a Django-based publishing platform with:

- articles and books
- attachments and media uploads
- conditional access control
- money, points, and VIP logic
- audit logging
- optional Live2D runtime integration

## Basic Setup Commands

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

For full setup and operational guidance, read [ADMIN_MANUAL.md](./ADMIN_MANUAL.md).
