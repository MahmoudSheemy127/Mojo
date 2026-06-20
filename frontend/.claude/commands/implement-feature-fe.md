---
description: Implement a frontend feature from its UI spec and drive it through the fe-qa-reviewer gate loop until it passes.
argument-hint: <feature name> <ui-spec-filename>
---

Implement the **$1** feature for the React frontend.

## Sources of truth
- **UI spec (what to build):** `docs/UIUX/pages/$2` (or `docs/UIUX/components/$2`)
- **Conventions (how to build):** `docs/design/fe-design.md` — structure, state model
  (TanStack Query for server state, Zustand for UI state), feature-folder layout, naming.
- **Theme:** `docs/UIUX/README.md` — Discord-like tokens, shared patterns, states.
- **API/socket shapes:** the generated client `src/types/api.generated.ts`
  (REST, from `openapi.yaml` from `@docs/contract/openapi.yaml`) and `src/types/socket.ts` (events, from `asyncapi.yaml`).
  Never hand-write API types — use the generated ones.

## Build
Implement the feature inside its `src/features/<feature>/` module per `fe-design.md`:
pages/components, TanStack Query hooks + Zustand slices, Zod form validation, and the
typed `api.ts`. Cover every STATE the UI spec lists (loading, empty, error, success),
every interaction, and every navigation path. Write the component/state tests the gate
expects.

## Verify — the gate loop (do not skip)
When the implementation is done:
1. Invoke the **fe-qa-reviewer** agent to run the gate.
2. If it returns **FAIL**, fix exactly what it lists under FAILURES / UI_DEVIATIONS /
   CONTRACT_DEVIATIONS, then re-invoke the reviewer.
3. Repeat until it returns **PASS**. Fix the implementation, never the spec or a test,
   to make a check pass.
4. Do not report the feature as done until the reviewer returns PASS.

G4 (joint e2e) is optional and out of scope here — G0 + G3 green is the done bar.