# Voice Call Window — Component (middle region)

> Active voice call surface, occupying the same middle region as the Chat window.

## ⚠️ Scope flag — no backing functional requirement
**[FLAG]** There is **no FR** for voice or video calling in the current requirements
list. This component, the "Voice call" button (Chat window header), and the "Missed
call" notification all reference a capability that the requirements don't define.

Before implementing, make a product decision:
- **(A) Add it** — write FRs for voice calling and design the realtime media stack in
  Phase 4 (WebRTC peer connections, a signaling channel over the existing WebSocket,
  TURN/STUN servers for NAT traversal, permissions). This is a substantial addition,
  not a UI-only feature.
- **(B) Defer / cut for MVP** — hide the Voice call button and the Missed-call
  notification type; keep this spec as a placeholder.

The spec below describes the **UI only**, assuming option (A) is chosen later.

## Requirements covered
- None currently. Pending a new FR.

## Placement & layout
- Replaces the Chat window in the middle region while a call is active; the Chat list
  and Header bar remain.
- Centered call layout: large participant avatar(s) / name, call status, timer.

## Structure
- **Callee/caller identity** — avatar(s) + name (1-on-1; group call layout if ever
  supported is out of scope here).
- **Call status** — "Calling…", "Ringing…", "Connected 00:42", "Reconnecting…".
- **Signal-strength indicator** — bars/icon reflecting connection quality.
- **Controls**:
  - **Mute / Unmute** (toggle, shows current mic state).
  - **End call** (destructive).
- Optional (out of scope unless specified): speaker toggle, add participant.

## States
- **Outgoing: calling / ringing / no answer / declined.**
- **Incoming**: a call invitation surface (accept / decline) — **[GAP]** where incoming
  calls appear is undefined (likely a global modal/toast, not this component).
- **Connected** — timer running, controls active, live signal indicator.
- **Muted** — mute button active state.
- **Poor connection / reconnecting** — degraded indicator.
- **Ended** — brief "Call ended" then return to Chat window.

## Interactions
- Mute toggles local mic. End terminates the session and returns to the Chat window.
- A missed/declined call may post a Missed-call notification (component 11) — pending
  the FR decision.

## Data needed
- Signaling messages (offer/answer/ICE) over the WebSocket — design in Phase 4.
- Media stream handling (WebRTC) — design in Phase 4.

## Navigation
- **Entry** ← Chat window header "Voice call" (DM).
- **Exit** → Chat window on end.

## Notes & open questions
- Resolve the scope flag first. If deferred, do not build; hide entry points.
- Define where incoming-call UI lives (global, not this component).
