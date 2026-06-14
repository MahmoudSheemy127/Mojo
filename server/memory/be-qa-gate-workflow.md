---
name: be-qa-gate-workflow
description: How backend stages are verified — the be-qa-reviewer agent + qa.md gate chain (G0/G1/G2)
metadata:
  type: project
---

Backend implementation stages are verified by the **`be-qa-reviewer` agent**
(`.claude/agents/be-qa-reviewer.md`), not ad-hoc manual checks. It runs the gate commands,
captures exit codes, does REST/realtime contract conformance review, and returns a terse
PASS/FAIL/BLOCKED verdict. It never edits code or weakens a gate.

Gates are defined in `docs/qa/qa.md` and wired as `package.json` scripts:
- **G0 Scaffold** → `npm run gate:scaffold`
- **G1 Schema** → `npm run gate:schema`
- **G2 Feature** → `npm run gate:backend` (contract conformance is the headline; ≥70% cov NF-19)
- **Definition of done** → `npm run gate:be-feature` (G0→G1→G2 chained)
- **G4** is joint/frontend-driven against the real stack — out of scope for backend-only tasks.

**Why:** the user wants verification gate-driven through this agent, not improvised smoke tests.
**How to apply:** when planning/finishing a backend feature, route verification through
be-qa-reviewer at the relevant gate (a feature = G2). Contract specs (`openapi.yaml`/
`asyncapi.yaml`) are authoritative — divergence means the impl is wrong, not the test.

Note: `qa.md`'s `gate:scaffold` includes a `check-contract-specs.mjs` step (and `test:cov` as
`jest --coverage`) that the current `package.json` does not yet have — reconcile if G0 blocks.
Related: [[auth-feature-plan]].