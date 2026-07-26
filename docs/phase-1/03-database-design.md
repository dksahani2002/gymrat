# 03 — Database Design

## Principles

1. **Normalized** OLTP schema in PostgreSQL (3NF where practical).
2. **User-scoped** rows: every user-owned table has `user_id` with FK + index.
3. **Soft deletes** via `deleted_at TIMESTAMPTZ NULL` on mutable user data.
4. **Audit** via append-only `audit_logs` + selective history tables for critical entities.
5. **UUID** primary keys (`uuid_generate_v4()` / Prisma `@default(uuid())`).
6. **UTC** timestamps: `created_at`, `updated_at`, `deleted_at`.
7. **Idempotency** keys on AI-originated creates.
8. **Numeric precision**: weights `DECIMAL(8,2)`, body metrics `DECIMAL(8,2)`, volumes `DECIMAL(14,2)`.

---

## Core Tables (Summary)

### Identity

| Table | Purpose |
|-------|---------|
| `users` | Account, email, password hash, role, oauth ids |
| `refresh_tokens` | Hashed refresh tokens, rotation, revoke |
| `password_reset_tokens` | One-time reset codes |
| `user_profiles` | Biometrics & preferences (1:1 users) |

### Exercise Catalog

| Table | Purpose |
|-------|---------|
| `muscle_groups` | Chest, Back, Quads, … |
| `equipment` | Barbell, Dumbbell, Cable, … |
| `exercise_categories` | Push, Pull, Legs, Cardio, … |
| `exercises` | Canonical exercise |
| `exercise_muscles` | M2M with role PRIMARY/SECONDARY |
| `exercise_aliases` | NLP aliases |

### Workout

| Table | Purpose |
|-------|---------|
| `workouts` | Session header |
| `workout_exercises` | Ordered exercises in session |
| `workout_sets` | Set detail |
| `workout_idempotency_keys` | Dedup AI/client retries |

### PRs & Analytics

| Table | Purpose |
|-------|---------|
| `personal_records` | PR ledger |
| `analytics_daily_snapshots` | Per-user per-day aggregates |
| `analytics_weekly_snapshots` | Weekly rollups |
| `muscle_volume_daily` | Muscle volume series |
| `exercise_stats` | Latest/rolling stats per user-exercise |

### Body & Goals

| Table | Purpose |
|-------|---------|
| `body_weight_entries` | Weight time series |
| `body_measurements` | Circumference entries |
| `goals` | Goal definitions |
| `goal_progress_snapshots` | Optional progress points |

### Calendar & Notifications

| Table | Purpose |
|-------|---------|
| `planned_workouts` | Calendar markers |
| `notifications` | In-app inbox |
| `notification_preferences` | User toggles |
| `device_push_tokens` | FCM/APNs tokens |

### Platform

| Table | Purpose |
|-------|---------|
| `audit_logs` | Who/what/when |
| `ai_parse_logs` | Prompt/response metadata (no secrets) |
| `outbox_events` | Phase 1 optional; required Phase 2 |

---

## Important Columns & Constraints

### `users`
- `email` UNIQUE, CITEXT
- `password_hash` NULL if Google-only
- `google_sub` UNIQUE NULL
- `role` ENUM `USER|ADMIN`
- `status` ENUM `ACTIVE|SUSPENDED|DELETED`
- CHECK: password_hash OR google_sub NOT NULL

### `workouts`
- `user_id`, `title`, `notes`, `started_at`, `completed_at`
- `source` ENUM `MANUAL|AI_TEXT|AI_VOICE|AI_OCR|IMPORT`
- `status` ENUM `IN_PROGRESS|COMPLETED|CANCELLED`
- Partial index on `(user_id, completed_at DESC) WHERE deleted_at IS NULL`

### `workout_sets`
- `set_number`, `reps`, `weight`, `weight_unit` (`KG|LB`)
- `rpe` DECIMAL(3,1) NULL, `duration_sec` NULL
- `is_warmup` BOOLEAN DEFAULT false
- `is_failure` BOOLEAN DEFAULT false
- CHECK weight >= 0, reps >= 0

### Soft delete policy
- Parent soft delete cascades logically: queries always filter `deleted_at IS NULL`
- Hard purge job (30–90 days) for GDPR

---

## Indexing Strategy

| Index | Why |
|-------|-----|
| `workouts(user_id, completed_at DESC)` partial | History feed |
| `workout_exercises(workout_id, position)` | Ordered load |
| `workout_sets(workout_exercise_id, set_number)` | Set order |
| `exercises` GIN trigram on `name` | Search |
| `exercise_aliases(alias)` UNIQUE lower | AI resolve |
| `personal_records(user_id, exercise_id, achieved_at DESC)` | PR list |
| `analytics_daily_snapshots(user_id, date)` UNIQUE | Upsert |
| `body_weight_entries(user_id, recorded_at DESC)` | Charts |
| `refresh_tokens(user_id, token_hash)` | Lookup |
| `audit_logs(actor_id, created_at DESC)` | Forensics |
| `ai_parse_logs(user_id, created_at DESC)` | Cost/debug |

---

## Migration Strategy

1. Prisma Migrate as source of truth (`prisma migrate dev` / `deploy`).
2. Never edit applied migrations; create forward migrations.
3. Expand/contract for breaking changes:
   - Expand: add nullable columns → backfill job → constrain
   - Contract: remove code usage → drop column in later migration
4. Seed catalog exercises in versioned seed scripts (idempotent upserts).
5. CI runs `prisma migrate diff` drift check.

---

## Soft Deletes & Audit

### Soft deletes
All user content tables include `deleted_at`. Repositories apply global filter via Prisma middleware / extension.

### Audit logs
```
audit_logs:
  id, actor_id, action, resource_type, resource_id,
  before_json, after_json, ip, user_agent, request_id, created_at
```

Audited actions (MVP): login failures, password reset, workout delete, profile update, admin exercise mutations, token revoke.

### AI parse logs
Store: model, latency_ms, input_hash, token usage, confidence, resolved exercise ids.  
Do **not** store raw voice indefinitely without retention policy; S3 lifecycle 30 days for audio.

---

## Partitioning (Future-Ready, Not Required MVP)

When `workout_sets` exceeds ~50M rows:
- Partition `analytics_*` by month
- Consider `workout_sets` by `created_at` range

Design IDs and queries to remain partition-friendly (always include time bounds on analytics reads).

---

## Units & Conversion

Store workout set weight in **user-entered unit** + optional `weight_kg` normalized column for analytics.  
Analytics always compute in kg internally; API converts for display preference.

---

## Multi-tenancy Note

Phase 1 is single-user tenancy (`user_id`). Phase 3 coach orgs add `organization_id` without rewriting workout PK strategy (nullable org column + RLS later).
