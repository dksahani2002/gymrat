# 10 — Analytics Engine Design

## Purpose

Derive training intelligence from completed workouts with **event-driven recomputation** and **read-optimized snapshots** so chart APIs stay O(range) not O(all sets).

---

## Architecture

```
WorkoutCompleted / Updated / Deleted
        │
        ▼
  BullMQ analytics queue (per userId concurrency=1)
        │
        ├─ Recompute day D snapshots
        ├─ Recompute week containing D
        ├─ Upsert muscle_volume_daily for D
        ├─ Upsert exercise_stats for touched exercises
        └─ Invalidate Redis keys user:{id}:analytics:*
```

**Why per-user concurrency = 1?** Prevents snapshot race conditions without heavy DB locks.

---

## Metrics Catalog

| Metric | Definition | Storage |
|--------|------------|---------|
| Workout volume | Σ (weightKg × reps) for non-warmup sets | daily/weekly snapshots + on-demand |
| Exercise volume | Same filtered by exercise | query sets or rollup later |
| Weekly / monthly / yearly volume | Sum of daily snapshots in range | snapshots |
| Muscle volume | Attribute set volume to primary muscles (full); secondary × `secondaryFactor` (default 0.5) | `muscle_volume_daily` |
| Average weight | Volume / total reps (working sets) | computed |
| Estimated 1RM | Epley: `w × (1 + reps/30)` for reps ≤ 12; exclude failure/warmup optionally | `exercise_stats` + series query |
| Workout duration | `completedAt - startedAt` or Σ set rests if available | snapshot |
| Training frequency | Workouts / week | weekly snapshot |
| Streak | Consecutive days with ≥1 completed workout (timezone-aware) | Redis + profile cache field optional |
| Consistency | `trainedDays / plannedOrTargetDays` over window (default 28d) | computed |
| PRs | See PR module | `personal_records` |

---

## Volume Formula

```
setVolumeKg = weightKg * reps
workoutVolumeKg = Σ setVolumeKg WHERE is_warmup = false
```

Bodyweight exercises: `weightKg = userBodyWeightKg + externalLoadKg` when flagged on exercise (`isBodyweight`); MVP may use external load only and document limitation.

---

## Estimated 1RM

Primary: **Epley**  
Alternates (config): Brzycki `w × 36/(37-r)`.

Rules:
- Only reps 1–12
- Prefer best e1RM per session then keep max in `exercise_stats`
- Series endpoint returns best e1RM per day/week

---

## Streak Algorithm

```
Given user timezone:
  days = distinct dates(completed workouts) in local TZ
  streak = 0
  cursor = today if trained today else yesterday
  while cursor in days:
    streak++
    cursor -= 1 day
```

Store `current_streak` in Redis with date version key; recompute on event.

---

## Chart API Design

`GET /analytics/charts/:chartType?from=&to=&interval=`

Supported `chartType`:
- `volume_over_time`
- `muscle_volume_breakdown`
- `muscle_volume_over_time`
- `frequency_heatmap`
- `e1rm_over_time`
- `body_weight_over_time`
- `duration_over_time`

Normalized points `{ x, y, label?, meta? }` keep mobile/web chart libs interchangeable.

---

## Caching

| Key | TTL | Invalidate |
|-----|-----|------------|
| `analytics:{userId}:overview` | 5–15 min | workout events |
| `analytics:{userId}:volume:{from}:{to}:{interval}` | 15 min | workout events overlapping range |
| `exercises:catalog:v{version}` | 1h | admin catalog write |

---

## Backfill / Repair

Admin/job: `RecomputeAnalyticsCommand(userId, from, to)`  
Used after bugfixes or import (Phase 2). Idempotent upserts.

---

## Performance Targets (MVP)

| Op | p95 |
|----|-----|
| Complete workout enqueue | < 100ms API |
| Analytics job (typical session) | < 2s |
| Chart read (90d daily) | < 150ms cached / < 400ms uncached |

At millions of users: shard BullMQ by user hash; partition snapshot tables by month; read replicas for analytics GETs.
