# Account Access

## Login

Open `/login/` and enter either:

- your username, or
- your email address

The platform supports both identity types in the same login form.

## Remember Me

If you enable `Remember me`, your session stays active longer.

If you do not enable it, the session is shorter-lived and typically ends with the browser session.

## Daily Login Reward

Depending on site configuration, the first successful login of the day can grant:

- money
- points
- extra VIP bonus rewards if your account has a VIP identity

This reward is automatic. There is no separate claim button.

## Registration

Registration is available only when the site administrator enables it.

### Registration Flow

1. Open `/register/`.
2. Enter username and email.
3. Request a verification code.
4. Enter the code from email.
5. Set and confirm your password.
6. Submit the form.

### Registration Rules

- the email must not already be in use
- the username must not already be in use
- the verification code expires after a limited time
- the resend action has a cooldown

## Password Reset

If email delivery is available, the login page shows a `Forgot password` action.

### Important Behavior

This feature does not send a passive reset link.

Instead, if the reset succeeds, the system immediately:

1. generates a strong temporary password
2. changes the account password
3. emails the temporary password to the account email address

That means the old password stops working after a successful reset.

## Why Password Reset Responses Look Generic

For privacy reasons, the site does not reveal whether the submitted username or email exists.

## Email Change

Users can change their email address from `Profile settings -> Account security`.

If email verification is available, the new email address must be verified with a code before the change is accepted.

## Password Change

Users can also change their password from `Profile settings -> Account security` by entering:

- current password
- new password
- new password confirmation

## Sign Out

Use the user menu in the header and click `Sign out`.
