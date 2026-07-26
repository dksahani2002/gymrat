# Workout Module — Implementation Notes

Implements Phase 1 Workout APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/workouts` | Nested create + optional `idempotencyKey` / `completed` |
| GET | `/workouts` | History with cursor, status, from/to |
| GET | `/workouts/:id` | Detail |
| PATCH | `/workouts/:id` | Meta and/or full exercise graph replace |
| DELETE | `/workouts/:id` | Soft delete |
| POST | `/workouts/:id/complete` | Emits `workout.completed` |
| POST/PATCH/DELETE | nested exercises & sets | Incremental edits |

## Invariants

- Positions unique per workout; set numbers unique per exercise
- Completing requires ≥1 non-warmup set
- Ownership enforced on every mutation
- `weightKg` normalized on write (LB → kg)

## Events

- `workout.completed` — consumed later by PRs / analytics
- `workout.deleted` — analytics invalidation later
