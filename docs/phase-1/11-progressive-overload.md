# 11 — Progressive Overload Algorithm

## Goal

Recommend the **next working weight / reps** for each exercise from the user's own history — not generic templates.

---

## Inputs

For exercise E and user U:

- Last completed session sets (working sets only)
- Prior N sessions (default N=3)
- Best e1RM / best weight
- Recent RPE if present
- Failure flags
- Days since last performed
- User goal (`STRENGTH` vs `BUILD_MUSCLE` vs `ENDURANCE`)

---

## Core Algorithm (MVP v1)

### Step 1 — Baseline

Take last session's **top working set** (highest weight, then highest reps):

```
baseline = { weightKg, reps, setsCount }
```

If no history → return `insufficient_data` with optional catalog beginner defaults **labeled as generic**.

### Step 2 — Performance classification

Compare last session to previous:

| Condition | Class |
|-----------|-------|
| Hit all target reps at weight W | `SUCCESS` |
| Exceeded reps on ≥50% sets | `OVERPERFORM` |
| Missed reps on ≥50% sets OR any hard failure | `UNDERPERFORM` |
| Mixed | `MIXED` |

If RPE available:
- SUCCESS + avg RPE ≤ 7 → treat as `OVERPERFORM`
- SUCCESS + avg RPE ≥ 9 → treat as `MARGINAL_SUCCESS`

### Step 3 — Prescription rules

Defaults (configurable per goal):

**Hypertrophy / general (default)**
- Target rep range: 6–12 (or last planned range)
- On `SUCCESS` / `OVERPERFORM`: `nextWeight = roundToIncrement(weight + increment)`
- On `MARGINAL_SUCCESS`: hold weight, +1 rep if under range top
- On `UNDERPERFORM`: hold weight, −1–2 reps target OR reduce weight 2.5–5%
- On 2 consecutive `UNDERPERFORM`: deload 10%

**Strength**
- Rep range 1–5
- Increment larger on upper body 2.5kg / lower 5kg (equipment-aware)
- Double progression: add reps to top of range, then add weight and reset reps to bottom

**Endurance**
- Prefer +reps before +load

### Step 4 — Rounding

```
incrementKg = equipmentIncrement(exercise) // barbell 2.5, db 2.0, etc.
roundToIncrement(w) = round(w / incrementKg) * incrementKg
```

Convert to user preferred unit at API boundary.

### Step 5 — Staleness modifier

If `daysSinceLast > 14`: reduce suggested load by 5–10% and flag `detrain_adjust`.

---

## Output Contract

```json
{
  "exerciseId": "...",
  "exerciseName": "Bench Press",
  "suggestion": {
    "weight": 82.5,
    "weightUnit": "KG",
    "reps": 5,
    "sets": 5,
    "rationale": "Last session all sets successful at 80×5; applying +2.5kg."
  },
  "baseline": { "weight": 80, "reps": 5, "sets": 5, "performedAt": "..." },
  "classification": "SUCCESS",
  "confidence": 0.86,
  "flags": []
}
```

---

## Double Progression Detail

```
if reps_last_top_set < targetRepMax:
  suggest same weight, reps = reps_last + 1 (capped)
else:
  suggest weight + increment, reps = targetRepMin
```

---

## Integration Points

- `GET /recommendations/overload` aggregates suggestions for exercises performed in last 28 days
- Cache 15 minutes; bust on `WorkoutCompleted`
- Phase 2 recommendation engine consumes this as a signal among recovery, muscle volume balance, and schedule

---

## Tunables (config / remote flags later)

| Key | Default |
|-----|---------|
| `lookbackSessions` | 3 |
| `secondaryMuscleFactor` | 0.5 |
| `barbellIncrementKg` | 2.5 |
| `dumbbellIncrementKg` | 2.0 |
| `deloadConsecutiveFails` | 2 |
| `deloadPercent` | 0.10 |
| `detrainDays` | 14 |

---

## Testing Strategy

Unit-test pure `OverloadAlgorithm` with fixture histories:
- First-time exercise
- Linear success streak
- Failure then recovery
- RPE gated hold
- Unit conversion LB↔KG rounding
- Detrain after 21 days
