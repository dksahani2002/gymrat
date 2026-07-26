# 09 — Workout Logging Flow

## Philosophy

Parse → Confirm → Persist → Complete → Derive.

AI never silently writes workouts without a client confirmation step in MVP (reduces hallucination risk). Exception: explicit `autoCommit: true` flag can be added later behind a user preference.

---

## Input Channels

| Channel | Endpoint | Pipeline |
|---------|----------|----------|
| Text | `POST /ai/parse-text` | NLP parser → resolve → draft |
| Voice | `POST /ai/parse-voice` | S3 → STT → NLP parser → draft |
| Manual | `POST /workouts` | Direct structured create |
| OCR (future) | `POST /ai/parse-image` | S3 → OCR → NLP parser → draft |

---

## Text Parsing Pipeline

```
Raw text
  → Normalize (unicode, unit synonyms: kgs→kg, x→×)
  → AiWorkoutParserPort (LLM or rules+LLM hybrid)
  → Candidate exercises + sets
  → ExerciseResolverPort
       1. Exact alias match (case-insensitive)
       2. Exact exercise name
       3. Trigram similarity (pg_trgm)
       4. Embedding similarity (Phase 2 optional)
  → Ambiguity list if top-2 scores within epsilon
  → ParsedWorkoutDraft + confidence
  → AiParseLog persisted
```

### Parser port contract

```typescript
interface AiWorkoutParserPort {
  parse(input: {
    text: string;
    unitHint?: 'KG' | 'LB';
    locale?: string;
  }): Promise<RawParseResult>;
}

interface RawParseResult {
  title?: string;
  exercises: Array<{
    rawName: string;
    sets: Array<{ weight?: number; reps?: number; unit?: 'KG' | 'LB'; rpe?: number }>;
    notes?: string;
  }>;
  providerMeta: { provider: string; model: string; latencyMs: number; tokens?: {...} };
}
```

### Example transforms

| Input | Output sets |
|-------|-------------|
| `Bench 80kg 5x5` | 5 sets × 80kg × 5 reps |
| `Squat 225lbs 3 sets of 5` | 3 × 225 lb × 5 |
| `Pull ups bodyweight 8,8,6` | 3 sets, weight 0/null, reps 8/8/6 |

---

## Voice Pipeline

1. Validate MIME + max size (e.g. 25MB)
2. Upload to S3 `voice-uploads/{userId}/{uuid}`
3. `SpeechToTextPort.transcribe(s3Url)` → text
4. Reuse text pipeline
5. Retention: S3 lifecycle 30 days; log only `inputHash` + transcript length

---

## Persist Workout

`CreateWorkoutHandler`:

1. Validate ownership + DTO
2. Check idempotency key (return existing if replay)
3. Normalize `weightKg` for each set
4. Transaction: workout + exercises + sets
5. If `status=COMPLETED` or follow-up complete call → emit `WorkoutCompleted`

### Aggregate invariants

- Positions unique per workout
- Set numbers unique per workout exercise
- Warmup sets excluded from volume by default (flag)
- Cannot complete empty workout (0 working sets)

---

## Update / Delete

- PATCH replaces nested graph carefully (diff-based or full replace versioned)
- Soft delete workout → enqueue analytics invalidation for affected dates
- Concurrent edits: `updatedAt` optimistic check optional (`If-Match`)

---

## Domain Events After Complete

| Event | Downstream |
|-------|------------|
| `WorkoutCompleted` | PR detection, analytics upsert, streak, overload cache bust, notifications |
| `WorkoutUpdated` (if completed) | Same recompute for date |
| `WorkoutDeleted` | Recompute / subtract snapshots |

---

## Failure Modes

| Failure | Behavior |
|---------|----------|
| AI timeout | 502 + retryable; no draft |
| Low confidence | Return draft + `warnings`; client highlights |
| Unknown exercise | `resolvedExercise: null` + suggestions |
| Idempotent replay | 200 with original workout |
| Partial STT | Return transcript + parse of best effort |

---

## Client UX Contract

1. User speaks/types
2. App shows editable structured cards
3. User taps Save → `POST /workouts`
4. App taps Finish → `POST /workouts/:id/complete`
5. UI polls or receives push for PR celebration

This keeps the backend authoritative while UX stays form-free.
