# AI Logging / Parser — Implementation Notes

Implements Phase 1 AI parse APIs from [05-api-list.md](./05-api-list.md) and [09-workout-logging-flow.md](./09-workout-logging-flow.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/ai/parse-text` | Rules parser → catalog resolve → draft |
| POST | `/ai/parse-voice` | Local store → mock STT → same draft |
| POST | `/ai/parse-image` | 501 stub |
| GET | `/ai/parse-logs` | Recent parse history |

## Provider ports

- `AiWorkoutParserPort` — default `RulesWorkoutParser` (`AI_PARSER_PROVIDER=rules`)
- `ExerciseResolverPort` — alias → exact name → ILIKE suggestions
- `SpeechToTextPort` — `MockSpeechToTextService` (swap for Whisper later)
- `ObjectStoragePort` — local `./storage/voice` (swap for S3 later)

Drafts are **never** auto-persisted. Client confirms via `POST /workouts`.

## Supported text patterns

- `Bench 80kg 5x5`
- `Squat 225lbs 3 sets of 5`
- `Pull ups bodyweight 8,8,6`
- `Weighted pull ups 20kg for 5 reps and 5 sets`
- Multi-exercise with `then` / `followed by`
