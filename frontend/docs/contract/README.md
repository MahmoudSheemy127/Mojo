# API Contract — Machine-Readable Specs

Executable contract derived from the human-readable markdown contract. These are the
files the QA gates validate against (`tests/contract` from OpenAPI, `tests/realtime`
from AsyncAPI) and from which the frontend's typed API client is generated.

## Layout

| File | Source markdown | Covers |
|---|---|---|
| `_common.yaml` | `README.md` | Shared schemas, error envelope, security schemes, pagination params, reusable error responses. Referenced by every OpenAPI file. |
| `auth.openapi.yaml` | `auth.md` | Signup, login, refresh, logout, Google OAuth, password reset (FR-01–04) |
| `users.openapi.yaml` | `users.md` | Profile, avatar, presence, search (FR-05, FR-10, FR-11) |
| `contacts.openapi.yaml` | `contacts.md` | Friend requests, remove, block/unblock (FR-06–09) |
| `conversations.openapi.yaml` | `conversations.md` | Session list, open DM, mark read (FR-12, FR-14) |
| `messages.openapi.yaml` | `messages.md` | History, send, delete, attachments (FR-13, FR-16, FR-17) |
| `groups.openapi.yaml` | `groups.md` | Lifecycle, members, roles, invites, leave (FR-18–23) |
| `notifications.openapi.yaml` | `notifications.md` | Feed, count, mark-seen (FR-30) |
| `asyncapi.yaml` | `realtime.md` | All Socket.io events (FR-13–15, FR-30). REST specs cannot express sockets, so realtime lives here. |

## Why split per domain

The markdown contract is split by domain, so these mirror it 1:1 for reviewability and
clean diffs. Each OpenAPI file references the shared `_common.yaml` via relative
`$ref`s (e.g. `./_common.yaml#/components/schemas/SelfUser`), so the shared types are
defined once.

## Bundling into a single `openapi.yaml` (for the gates)

The QA strategy references a single `../contract/openapi.yaml`. Produce it by bundling
the per-domain files (which dereferences the cross-file `$ref`s into one document):

```bash
# Option A — Redocly CLI
npx @redocly/cli bundle auth.openapi.yaml users.openapi.yaml \
  contacts.openapi.yaml conversations.openapi.yaml messages.openapi.yaml \
  groups.openapi.yaml notifications.openapi.yaml \
  -o openapi.yaml

# Option B — keep them separate and point tooling at each file.
```

Note: a clean OpenAPI document has one `paths` object. When bundling, merge the per-domain
`paths` into the single output (Redocly's `join` command does this:
`npx @redocly/cli join *.openapi.yaml -o openapi.yaml`). `_common.yaml` is components-only
(its `paths` is empty) and is pulled in by reference.

## Validating

```bash
# OpenAPI files
npx @redocly/cli lint *.openapi.yaml

# AsyncAPI file
npx @asyncapi/cli validate asyncapi.yaml
```

## Generating the frontend typed client

```bash
# Types from the bundled OpenAPI
npx openapi-typescript openapi.yaml -o ../chat-app/src/types/api.generated.ts

# Socket event types from AsyncAPI (e.g. Modelina, or hand-mirror into types/socket.ts)
```

## Notes on encoded decisions

- **Error envelope**: every non-2xx response uses `ApiError` (`{ error: { code, message } }`).
- **Nullable fields** use OpenAPI 3.1 type arrays (`type: [string, "null"]`).
- **Conversation** is a discriminator union (`dm` | `group`) on `type`.
- **Open FLAGs** from the markdown (group join-approval, last-admin rule, avatar storage)
  are encoded at their documented default with the alternative noted in the operation
  `description`. The `group_join_request` endpoints are marked conditional.
- `_common.yaml` carries a no-op `paths: {}` so it is a valid standalone OpenAPI doc.
