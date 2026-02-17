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

6.  **Login success!**

## Developer Mode (No SMTP Required)

Since you are on the **Appwrite Cloud Free Tier** without SMTP access, we have enabled a **Developer Simulation Mode**.

When you register a Staff account:
1.  The system will try to send an email (which might fail or get rate-limited).
2.  **Simultaneously**, a popup alert will appear on your screen saying:
    > "DEVELOPER MODE: Email Simulation... Click OK to open..."
3.  Clicking **OK** will open the `verify_email.html` page in a new tab with the correct `secret` and `userId`.
4.  This simulates the user clicking the link in their email inbox.

This allows you to test the full "Extra Layer of Security" flow without needing a paid email subscription.


### Q: Do I need to setup OAuthProvider.Google?
**No.** Setting up `OAuthProvider.Google` allows users to *log in* with their Google accounts. It has nothing to do with sending system emails (like verification links).

### Common Reasons for Email Failure in Appwrite Cloud:

1.  **Spam Folder**: Check your Spam/Junk folder. Appwrite Cloud's default emails often land there.
2.  **Rate Limiting**: Appwrite Cloud (Free Tier) has strict limits (e.g., 100 emails/day total, 10/hour per IP). If you test too much, you get blocked temporarily.
3.  **Invalid Domain**: Using `file://` protocol or `localhost` redirects might be blocked or fail validation. Always run your site on a local server (e.g., `http://127.0.0.1:5500`).
4.  **Protocol Error**: If you see an error in the console about `file:` protocol, you are running locally without a server. Appwrite requires HTTP/HTTPS redirects.

### Solution: Use Your Own SMTP (e.g., Gmail)
For reliable delivery, configure your own SMTP server in the Appwrite Console.

**How to use Gmail SMTP:**
1.  Go to your Google Account > Security > 2-Step Verification > **App Passwords**.
2.  Create a new App Password (select "Mail" and "Other (Custom name)"). Copy the 16-character password.
3.  In Appwrite Console:
    *   Go to **Project Settings** > **SMTP**.
    *   **Host**: `smtp.gmail.com`
    *   **Port**: `465` or `587`
    *   **Username**: Your Gmail address
    *   **Password**: The 16-char App Password (NOT your login password)
    *   **Secure**: `TLS` (for port 587) or `SSL` (for port 465)
    *   **Sender Email**: Your Gmail address
    *   **Sender Name**: "CubbyCove Admin"
4.  Click **Update**. Now all emails will be sent via your Gmail account.
