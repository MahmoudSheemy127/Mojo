# Frontend — QA Strategy & Gates

> Gates for the frontend session: **G0** (scaffold) and **G3** (feature UI + state).
> **G4** (joint integration) is **optional** — run it only when explicitly requested and
> the backend is up; it is never required for a feature to be considered done here.
> Each gate is a runnable command whose **exit code is the sole pass/fail signal**: exit 0
> = pass, non-zero = fail. There is no tracker file — the agent reads the gate's own output
> and loops (fix → re-run) until the gate exits 0.
> Tooling is **Vitest** + Testing Library (unit/component/state) and **Playwright** (e2e, G4 only).

## Gate scripts (package.json)
```jsonc
{
  "build":          "tsc --noEmit && vite build",
  "typecheck":      "tsc --noEmit",
  "lint":           "eslint .",
  "test":           "vitest run",
  "test:cov":       "vitest run --coverage",   // threshold ≥70% in vite.config
  "test:e2e":       "playwright test",

  "contract:types": "openapi-typescript ../contract/openapi.yaml -o src/types/api.generated.ts",

  "gate:scaffold":  "npm ci && npm run contract:types && npm run build && npm run typecheck && npm run lint && node scripts/check-structure.mjs",
  "gate:frontend":  "npm run contract:types && npm run typecheck && npm run lint && npm run test:cov",
  "gate:e2e":       "npm run test:e2e",
  "gate:fe-feature":"npm run gate:scaffold && npm run gate:frontend"
}
```

> `contract:types` regenerates the typed API client from `../contract/openapi.yaml` at the
> start of every gate. If the backend changed the contract, the regenerated types break
> compilation and `typecheck` fails — that is the intended drift-detection mechanism.

---

## Gate G0 — Scaffold conformance  *(project-level, runs once)*
```bash
npm run gate:scaffold
```
**Checks:** `npm ci` → `contract:types` (generate `src/types/api.generated.ts` from the
OpenAPI spec) → `build` → `typecheck` → `lint` → `check-structure.mjs` (folders/files vs
`@fe-design`).
**Target:** all exit 0; structure check reports **0 missing items** vs `@fe-design`; the
contract types generate cleanly (the OpenAPI spec exists and is valid).

## Gate G3 — Feature UI + state
```bash
npm run gate:frontend
```
**Checks & targets:**
- `contract:types` + `typecheck` → **0 errors**. Because the API client is typed from the
  contract, any mismatch between the feature's API calls and the contract is a type error
  here. **0 type errors = the feature conforms to the REST contract's shapes.**
- `lint` → **0 errors** (includes `react-hooks/rules-of-hooks` and the no-`any` rule).
- `test:cov` — component + state tests pass; coverage **≥70%**. Tests assert:
  - rendering and the states each `@ui` spec lists (loading, empty, error, success);
  - form validation (Zod schemas reject invalid input per `@ui` / `@contract`);
  - state behavior (optimistic send + rollback, query invalidation, store updates);
  - socket-event handlers update the right cache/store per `@events`.
- **Spec-conformance review** — after the commands pass, the `fe-qa-reviewer` (or a
  spec-reviewer subagent) diffs the implementation against `@ui` and `@contract`/`@events`
  and reports deviations. G3 is PASS only if the gate commands exit 0 **and** the reviewer
  reports **0 unexplained deviations**. Any failing check (a non-zero command or a reported
  deviation) means G3 has not passed — fix and re-run; the loop continues until the gate is clean.

> What G3 does NOT do: it never hits a real network. All API and socket calls are mocked
> at this stage (MSW for REST, a mock socket for events). Real-stack verification is G4.

## Gate G4 — Integration  *(JOINT — OPTIONAL)*
```bash
npm run gate:e2e   # requires the backend up
```
- **Optional.** Run only when explicitly requested and the backend is confirmed up. A
  feature is considered done on the frontend side without G4 (G0 + G3 green is the bar).
- Drives the real UI against the **real backend + socket gateway + Postgres + Redis**,
  never a mock. Playwright config auto-starts the dev server; the backend must be running
  separately.
- **Prerequisite:** backend up and reachable (its API + socket gateway booted). If the
  backend is not up, skip G4 — do not treat its absence as a failure.

---

## Frontend definition of done
```bash
npm run gate:fe-feature   # = gate:scaffold && gate:frontend
```
A feature is done on the frontend side when **G0 and G3 both exit 0** (and the G3
spec-review reports no deviations). G4 is optional and not part of this bar. If any gate
check fails, the feature is not done — fix and re-run until every check is clean.

## Notes on the gates
- **Contract conformance is type-driven.** Unlike the backend (which runs generated
  contract tests against a live server), the frontend proves REST conformance at compile
  time: the client is generated from `openapi.yaml`, so drift cannot type-check. Do not
  hand-write API types — always regenerate.
- **Realtime conformance is test-driven.** Socket-event handlers are unit-tested against
  payloads shaped by `@events`; the live socket round-trip is verified at G4.
- **The spec-conformance review is the FE's headline check** (the analog of the backend's
  contract-test metric). A green test run with UI deviations from `@ui` is still a G3 FAIL.
- **Gate exit codes are the only signal.** There is no tracker file to write or read. A gate
  passes when its command exits 0; it fails otherwise. On failure, fix the implementation and
  re-run the gate — repeat until it exits clean. The agent never records a verdict anywhere;
  the gate's own exit code and output are the record.
