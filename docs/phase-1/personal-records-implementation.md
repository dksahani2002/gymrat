# Personal Records — Implementation Notes

Implements Phase 1 PR APIs from [05-api-list.md](./05-api-list.md) and detection from [07-sequence-diagrams.md](./07-sequence-diagrams.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/personal-records` | History (`exerciseId`, `type`, `from`, `to`, cursor) |
| GET | `/personal-records/summary` | Current best per exercise + type |

## Detection

On `workout.completed` (Nest event bus → `emitAsync`):

1. Load workout working sets (skip warmups)
2. Candidate metrics per exercise:
   - `MAX_WEIGHT` — max `weightKg`
   - `MAX_REPS` — max reps
   - `MAX_VOLUME` — Σ(`weightKg × reps`) for the session
   - `ESTIMATED_1RM` — best Epley `w × (1 + reps/30)` for reps 1–12
3. Persist only values that **strictly beat** the prior best
4. Emit `pr.achieved` per new row (notifications later)

Idempotent via unique `(userId, exerciseId, type, workoutId)`.
