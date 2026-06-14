# Create Group Form — Component (popup, middle screen)

> Centered popup to create a new group: set name/icon, pick initial members, create.
> The creator becomes the group's first admin.

## Requirements covered
- FR-18 — Create a group chat and become its admin.
- FR-19 — (Initial) member selection at creation time.

## Entry points
- Chat list → Create group (empty selection).
- Chat window header → Invite members **in a DM**, which opens this form pre-seeded
  with that friend already added as a member.

## Placement & layout
- Centered modal over dimmed backdrop. Title "Create group". Close via X / Esc / backdrop.

## Structure
- **Group icon** uploader (optional; initials/placeholder fallback).
- **Group name** field (required; with counter/validation).
- **Members picker**:
  - **Search bar** — searches the current user's **friends** (debounced).
  - Results rows (avatar + name); selecting adds to a **selected members** list below
    (chips/rows with remove). Pre-seeded members (from the DM entry) appear already
    selected and removable.
  - At least one other member required (or allow empty + invite later — **decide**).
- **Create group** button — disabled until name is valid (and member rule satisfied).

## States
- **Default** — empty form (or pre-seeded with one friend from the DM path).
- **Search: idle / searching / no results / no friends** (empty → point to Find friends).
- **Validation** — inline errors (name required/too long).
- **Icon uploading / invalid file.**
- **Creating** — button spinner; fields disabled.
- **Error** — inline + toast; keep entered data.

## Interactions
- Selecting/deselecting updates the selected list live.
- On **Create**:
  - Group is created; creator is admin (FR-18).
  - Selected members are added or invited per the group/invite policy (see FLAG #3);
    invited users get a Group invitation notification (component 11).
  - Modal closes and the new group's Chat window opens; group appears in Groups list.

## Data needed
- Friends search (scoped to contacts).
- POST create group (name, icon, member ids).
- Realtime: invited members' notifications; current user's group list update.

## Navigation
- **Entry** ← Chat list, or Chat window header (DM → pre-seeded).
- **Exit (success)** → new group Chat window. **(cancel)** → back to prior view.

## Notes & open questions
- Decide minimum members at creation (allow solo group + invite later?).
- Share the **MemberPicker** (search + selected list) with Invite members (component 07)
  to avoid duplicate implementations.
- Confirm members are added directly vs invited (pending approval) — FLAG #3.
