# Progressive Overload — Implementation Notes

Implements [11-progressive-overload.md](./11-progressive-overload.md) and APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/recommendations/overload` | Suggestions for exercises trained in last 28d |
| GET | `/recommendations/overload/:exerciseId` | Single exercise |

## Algorithm (pure `computeOverloadRecommendation`)

1. Baseline = last session top working set (max weight, then max reps)
2. Classify vs prior session target reps (+ RPE gates)
3. Prescribe by goal: hypertrophy (+increment), strength (double progression), endurance (+reps)
4. Deload after consecutive underperforms; detrain haircut after 14+ days
5. Convert to preferred unit at API boundary

Cached in Redis (`overload:{userId}:*`, TTL 15m); bust on `workout.completed` / `workout.deleted`.
