---
description: Implement a backend feature from the API contract and drive it through the be-qa-reviewer gate loop (G1 schema → G2 logic) until it passes.
argument-hint: <feature name> <contract-domain>
---

Implement the **$1** feature for the NestJS backend (`chat-api/`).

## Sources of truth
- **REST contract (what to build):** `@docs/contract/openapi.yaml` (domain: **$2**) — routes,
  request/response shapes, status codes, error envelope `{ error: { code, message } }`.
- **Socket contract (if the feature emits events):** `../contract/asyncapi.yaml` — event
  names, payloads, rooms.
- **Conventions (how to build):** `docs/design/be-design.md` — module/controller/service
  structure, DTOs (nestjs-zod), guards, the persist-then-broadcast rule, naming.
- **Schema:** `docs/design/prisma-schema-design.md` — Prisma models, constraints, indexes for this feature.

## Build
Work stage by stage; a stage is done only when its gate exits 0.

**Stage 1 — Schema (gate G1).** Add this feature's Prisma models + a migration per
`@prisma-schema-design`, including the constraints that carry business meaning (uniques, FKs). Then invoke
the **be-qa-reviewer** for G1.

**Stage 2 — Feature logic (gate G2).** Implement the module, controller, service, DTOs,
and guards per `@be-design` and the contract. Persist **before** emitting any socket event
(NF-16). Mentions/side-effects that create notifications are wired per the contract. Then
invoke the **be-qa-reviewer** for G2 — its headline check is contract conformance.

Security-sensitive features (auth) must also satisfy: rate limiting (NF-11), password
hashing (argon2, NF-09), and no secrets/message content in logs (NF-15).

## Verify — the gate loop (do not skip)
For each stage:
1. Invoke the **be-qa-reviewer** agent to run that stage's gate (G1, then G2).
2. If it returns **FAIL**, fix exactly what it lists under FAILURES /
   CONTRACT_DEVIATIONS / REALTIME_DEVIATIONS, then re-invoke the reviewer.
3. Repeat until it returns **PASS**. Fix the implementation, never the contract or a
   test, to make a check pass.
4. Do not advance to the next stage, or report the feature done, until the current
   stage's gate returns PASS.

G4 (joint integration) is out of scope here — it needs the frontend driving the real
stack. The done bar for this session is G1 + G2 green (i.e. `gate:be-feature`).
