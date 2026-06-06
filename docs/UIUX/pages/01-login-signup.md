# Login / Signup — Page

> Unauthenticated entry point. Handles account creation, login, OAuth, and the
> entry to password reset.

## Requirements covered
- FR-01 — Username & password signup + login.
- FR-02 — Google OAuth 2.0 signup + login.
- FR-04 — Password reset entry point (**[GAP]** "Forgot password?" was not in the brief).

## Placement & layout
- Standalone full-screen page; no header bar or chat list.
- Centered card (~400px wide) on the deepest background. App logo/name above the card.
- This is the only route available when unauthenticated; any other route redirects here.

## Structure
The card has two modes toggled by a tab/link: **Log in** and **Sign up**.

### Shared
- App logo + name.
- Mode toggle ("Log in" / "Sign up").
- **Continue with Google** button (FR-02) — full-width, Google branding, sits above
  the email/username form with an "or" divider.
- Error banner area (above the form fields).

### Log in form
- Username (or email) field.
- Password field (with show/hide toggle).
- "Forgot password?" link → opens Password reset request flow (FR-04).
- Primary **Log in** button.
- Footer: "Don't have an account? Sign up" → switches mode.

### Sign up form
- Username field (with availability check on blur/debounce).
- Email field.
- Password field (with show/hide and a strength hint).
- Confirm password field.
- Consent: checkbox or inline text linking Terms of Service + Privacy Policy
  (compliance NFR — must be accepted before submit).
- Primary **Create account** button.
- Footer: "Already have an account? Log in" → switches mode.

### Password reset request (sub-flow, FR-04) **[GAP added]**
- Triggered by "Forgot password?". Replaces the form (or opens a small modal).
- Email field + **Send reset link** button.
- On submit: success message ("If that email exists, we've sent a reset link") —
  worded so it does not reveal whether the account exists.
- The actual reset (set-new-password) screen is reached via the emailed link as a
  separate route `/reset-password?token=…`: new password + confirm + submit.

## States
- **Default** — log in mode.
- **Submitting** — button shows spinner, fields disabled.
- **Field validation errors** — inline under each field (e.g. "Username taken",
  "Passwords don't match", "Password too short").
- **Auth error** — banner ("Incorrect username or password"). Do not specify which.
- **Rate-limited** — banner explaining too many attempts, try again later
  (auth endpoints are rate-limited per NFR).
- **OAuth in progress / OAuth failed** — redirect spinner; error banner on failure.
- **Reset link sent** — confirmation state.

## Interactions
- Enter submits the active form.
- Switching modes preserves nothing sensitive (clears password fields).
- Successful auth stores tokens and redirects to Homepage.
- Username availability check is advisory; final validation is server-side.

## Data needed
- POST credentials → returns access token + sets refresh token.
- Google OAuth redirect/callback handling.
- POST password-reset-request (email).
- POST password-reset-confirm (token + new password).

## Navigation
- **Exit (success)** → Homepage.
- **Forgot password** → reset request sub-flow.
- Reset email link → set-new-password route → back to Log in.

## Notes & open questions
- Decide whether login identifier is username, email, or either.
- Consider "remember me" affecting refresh token lifetime.
