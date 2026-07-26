# 00 — Architecture Decision Records (Phase 1)

Concise ADRs for decisions that constrain implementation.

---

## ADR-001: Modular monolith first

**Decision:** Ship Phase 1 as a NestJS modular monolith with Clean Architecture folders.  
**Why:** Fastest path to correct domain boundaries; extract AI/workers later without rewriting domain.  
**Consequence:** Enforce dependency rules via ESLint; BullMQ workers can share codebase initially (`apps/api` + `apps/worker` optional split in Sprint 7).

---

## ADR-002: Confirm-before-persist for AI

**Decision:** AI endpoints return drafts only; workouts persist via explicit create.  
**Why:** Hallucination and liability control.  
**Consequence:** Client must implement confirmation UX; optional `autoCommit` deferred.

---

## ADR-003: Normalized kg for analytics

**Decision:** Persist display unit + `weight_kg` on sets.  
**Why:** Avoid repeated conversion bugs in analytics.  
**Consequence:** Slight write amplification; conversion utility mandatory in mapper.

---

## ADR-004: Event-driven analytics via BullMQ

**Decision:** Snapshots updated asynchronously per user (concurrency 1).  
**Why:** Completing a workout stays fast; idempotent upserts.  
**Consequence:** Brief read-after-write lag; overview may offer lightweight sync path if UX requires.

---

## ADR-005: Refresh token rotation with family revoke

**Decision:** Opaque refresh tokens, hashed at rest, rotate on use; reuse revokes family.  
**Why:** Industry standard theft detection.  
**Consequence:** Multi-tab clients must handle refresh coordination (single-flight).

---

## ADR-006: Provider port for AI

**Decision:** `AiWorkoutParserPort` + factory (mock/OpenAI/Anthropic).  
**Why:** Swap vendors; test without network.  
**Consequence:** Prompt/versioning lives in infrastructure providers, not domain.

---

## ADR-007: Soft deletes on user content

**Decision:** `deleted_at` + scheduled purge.  
**Why:** Undo, audit, GDPR staged deletion.  
**Consequence:** All queries filter deleted; unique constraints may need partial indexes.

---

## ADR-008: CQRS-lite (not full CQRS bus)

**Decision:** Command/query handlers without mandatory EventStore.  
**Why:** Clarity without Phase 1 complexity.  
**Consequence:** Can introduce dedicated read DB in Phase 2/3.
