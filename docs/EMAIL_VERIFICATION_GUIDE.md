# Email Verification Implementation Guide

## Overview

We have implemented a secure email verification flow for staff accounts. This ensures that when a staff member (Admin, Assistant, Creator) claims their account, they must verify their email address before accessing the system.

## How it Works

1.  **Triggering Verification**:
    *   When a user registers via `register_parent.html`:
    *   The system checks if their email matches a pre-created Staff profile.
    *   If it does, the system automatically sends a verification email using Appwrite's `account.createVerification()` method.
    *   The user is then logged out and told to check their email.

2.  **Handling the Link**:
    *   The email contains a link pointing to `verify_email.html` with `userId` and `secret` parameters.
    *   The `verify_email.html` page captures these parameters and calls `account.updateVerification()`.
    *   On success, it shows a confirmation message and a link to the login page.

3.  **Enforcing Verification**:
    *   The `DataService.login()` method has been updated.
    *   It now checks `session.emailVerification` (a boolean flag from Appwrite).
    *   If a user has a staff role (`admin`, `assistant`, `creator`) but has NOT verified their email, the login is blocked, and an error is shown.

## Configuration Requirements

For this to work in production, you must ensure your Appwrite instance handles emails correctly:

### 1. Appwrite SMTP Setup
*   **If using Appwrite Cloud**: Email delivery is configured automatically. No action needed.
*   **If using Self-Hosted Appwrite**: You **must** configure the SMTP environment variables in your `.env` file for Appwrite container:
    *   `_APP_SMTP_HOST`
    *   `_APP_SMTP_PORT`
    *   `_APP_SMTP_USERNAME`
    *   `_APP_SMTP_PASSWORD`
    *   `_APP_SMTP_SECURE`
    *   `_APP_SYSTEM_EMAIL_ADDRESS`

### 2. URL Configuration
The verification link relies on the redirect URL provided in the code:
```javascript
const verifyUrl = `${window.location.origin}/verify_email.html`;
```
Ensure `verify_email.html` is deployed to the same directory as your other pages.

## Testing the Flow
1.  **Create Staff**: In Admin Dashboard, create a new "User" with a specific email.
2.  **Claim Account**: Open `parent/register_parent.html` and register with that same email.
3.  **Check Logs**: Open the Console. You should see `📧 [Appwrite] Verification Email Sent`.
4.  **Verify**: Check your email inbox. Click the link. It should open the verification page with a success message.
5.  **Login**: Try to log in. It should now succeed.
