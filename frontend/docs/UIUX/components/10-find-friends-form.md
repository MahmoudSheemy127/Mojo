# Find Friends Form — Component (popup, middle screen)

> Centered popup to search all users by username and send contact requests.

## Requirements covered
- FR-05 — Search users by username (partial match, paginated).
- FR-06 — Send contact/friend requests (accept/decline happen in Notification list).

## Entry points
- Header bar → Find friends.
- Chat list → Find friends.
Both open this same component (README FLAG #2).

## Placement & layout
- Centered modal over dimmed backdrop. Title "Find friends". Close via X / Esc / backdrop.

## Structure
- **Search bar** — search users by username; partial match; debounced (~300ms).
- **Results list** (paginated / infinite scroll) — each row:
  - Avatar + username (+ display name if set).
  - **Action** reflecting relationship state:
    - Not connected → **Add friend** button (FR-06).
    - Request already sent → **Requested** (disabled / cancel option).
    - Already friends → **Friends** tag (or Message shortcut).
    - Blocked / blocked-by → hidden or non-actionable (FR-08 — blocked users can't be
      searched/invited).
  - The current user is excluded from results.

## States
- **Idle** — prompt to start typing ("Search by username").
- **Searching** — inline spinner.
- **No results** — "No users found for '<query>'."
- **Error** — inline error + retry.
- **Sending request** — per-row button spinner → resolves to "Requested".
- **Rate-limited** — message if user searches/requests too aggressively.

## Interactions
- Typing searches live (debounced); paginates on scroll.
- **Add friend** sends a request; row updates to "Requested" optimistically; the target
  receives a Friend invitation notification (component 11). Toast confirms.
- Sending to someone who has already requested you may auto-accept (**decide** the rule).

## Data needed
- GET user search (query, cursor) → results with relationship state per row.
- POST friend request.
- Realtime: target's notification feed; relationship-state updates.

## Navigation
- **Entry** ← Header bar or Chat list.
- **Exit** → closes back to whatever was behind it.

## Notes & open questions
- Confirm search is global (all users) here, vs friend-scoped search used in
  Create group / Invite members. They are different searches — keep them distinct.
- Define behavior when both parties send requests to each other.
- Respect block relationships in results (FR-08).
