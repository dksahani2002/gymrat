# 02 — Module Breakdown

## Bounded Contexts

| Context | Owns | Does not own |
|---------|------|--------------|
| Identity | Auth, tokens, OAuth, roles | Profile biometrics |
| Profile | Height, weight prefs, goal, activity | Workouts |
| Exercise Catalog | Canonical exercises, muscles, aliases | User history |
| Workout Logging | Sessions, sets, notes, AI parse intake | Aggregated analytics |
| Analytics | Volume, frequency, streaks, chart APIs | Live session mutation |
| Progressive Overload | Next-set / next-session suggestions | Executing workouts |
| Body Metrics | Body weight, measurements | Nutrition (Phase 2) |
| Goals | Goal definitions & progress | Achievement gamification (P3) |
| Calendar | Training calendar views | External calendar sync (P3) |
| Notifications | In-app + push dispatch | Marketing campaigns |

---

## Module Catalog (Phase 1)

### 1. Auth Module (`modules/auth` + `domain/identity` + `application/identity`)

**Responsibilities**
- Register (email/password), login, logout (refresh revoke)
- Access JWT (short-lived) + rotating refresh tokens (Redis + DB)
- Forgot/reset password
- Google OAuth (authorization code → user upsert)
- RBAC: `USER`, `ADMIN` (coach roles in Phase 3)

**Key ports**
- `UserRepository`, `RefreshTokenRepository`, `PasswordHasher`, `TokenService`, `MailPort`, `OAuthPort`

**Events**
- `UserRegistered`, `PasswordResetRequested`, `RefreshTokenRotated`, `UserLoggedIn`

---

### 2. Users / Profile Module

**Responsibilities**
- Profile CRUD: height, weight, age (or DOB), gender, fitness goal, activity level, preferred units (kg/lb)
- Soft delete account (anonymize PII policy documented)

**Entities**
- `UserProfile`, `UnitPreference` VO

---

### 3. Exercise Module

**Responsibilities**
- Seeded global exercise database
- Search (trigram / full-text + alias match)
- Categories, primary/secondary muscles
- Aliases for AI resolution (`bench` → Bench Press)
- Admin can CRUD; users read-only in MVP (custom exercises optional flag)

**Entities**
- `Exercise`, `MuscleGroup`, `ExerciseMuscle`, `ExerciseAlias`, `Equipment`, `ExerciseCategory`

**Caching**
- Hot catalog in Redis (TTL + version key); invalidate on admin write

---

### 4. Workout Module

**Responsibilities**
- Create / update / soft-delete workouts
- Nested session structure: workout → exercises → sets
- History with cursor pagination
- Notes, duration, started/completed timestamps
- Idempotency key for AI-created workouts

**Aggregates**
- `Workout` (root) contains `WorkoutExercise` and `WorkoutSet`

**Invariants**
- Sets require non-negative weight/reps
- Completed workout must have `completedAt`
- User can only mutate own workouts

---

### 5. AI Logging Module

**Responsibilities**
- `POST /ai/parse-text` — natural language → structured draft
- `POST /ai/parse-voice` — audio → STT → same parser pipeline
- Stub `POST /ai/parse-image` (OCR) — 501 or feature-flagged
- Exercise name resolution against catalog + aliases + fuzzy match
- Confidence scores; ambiguous matches returned for client confirmation

**Ports**
- `AiWorkoutParserPort`
- `SpeechToTextPort`
- `ExerciseResolverPort`

**Design**
```
Client → Controller → ParseWorkoutTextHandler
                         ├─ AiWorkoutParserPort.parse(raw)
                         ├─ ExerciseResolverPort.resolve(candidates)
                         └─ return ParsedWorkoutDraft (not persisted)
```

Persistence is a separate `CreateWorkout` call after user confirms.

---

### 6. Personal Records Module

**Responsibilities**
- Detect PRs on session complete (weight, estimated 1RM, volume, reps@weight)
- List PRs by exercise / date range
- Emit `PersonalRecordAchieved` for notifications

**Jobs**
- `pr-detection` BullMQ processor after `WorkoutCompleted`

---

### 7. Analytics Module

**Responsibilities**
- Materialized / cached metrics: volume (workout/exercise/week/month/year), muscle volume, avg weight, e1RM, duration, frequency, streak, consistency
- Chart-ready series endpoints
- Recompute on workout events (async)

See [10-analytics-engine.md](./10-analytics-engine.md).

---

### 8. Progressive Overload Module

**Responsibilities**
- Suggest next weight/reps from history + recent performance
- Per-exercise recommendation snapshot
- Used by future recommendation engine (Phase 2)

See [11-progressive-overload.md](./11-progressive-overload.md).

---

### 9. Body Metrics Module

**Responsibilities**
- Body weight log (time series)
- Circumference measurements (chest, waist, hips, arms, thighs, neck, custom)
- Soft deletes; chart APIs

---

### 10. Goals Module

**Responsibilities**
- Create goals (strength, body weight, frequency, volume)
- Track progress against analytics snapshots
- Status: `ACTIVE`, `COMPLETED`, `ABANDONED`

---

### 11. Calendar Module

**Responsibilities**
- Month/week views of completed + planned sessions
- Planned sessions are lightweight markers in MVP (full templates in Phase 2)

---

### 12. Notifications Module

**Responsibilities**
- In-app notification store
- Email for password reset / PR highlights (MVP)
- Push tokens stored; push send Phase 2
- Preference toggles

---

### 13. Health / Ops Module

**Responsibilities**
- `GET /health`, `GET /health/ready` (DB + Redis)
- Version / build metadata

---

## Cross-Cutting Infrastructure Modules

| Module | Purpose |
|--------|---------|
| PrismaModule | DB connection, transaction helper |
| RedisModule | Cache + refresh blacklist + rate limit |
| QueueModule | BullMQ producers/consumers |
| AiModule | Provider factory |
| StorageModule | S3 for voice/audio/OCR images |
| LoggingModule | Winston |
| MailModule | Transactional email |

---

## Event Bus (In-Process → Outbox Later)

Phase 1 uses Nest `EventEmitter2` (or custom `EventBusPort`) for:

| Event | Consumers |
|-------|-----------|
| `WorkoutCompleted` | PR detection, analytics recompute, streak update, notifications |
| `WorkoutDeleted` | Analytics invalidate |
| `BodyWeightLogged` | Goal progress |
| `UserRegistered` | Welcome notification, default prefs |
| `PersonalRecordAchieved` | Notification |

Phase 2 introduces transactional outbox + optional Kafka for microservice split.

---

## Dependency Rules

```
modules → application → domain
modules → infrastructure (composition only)
application → domain + ports (interfaces)
infrastructure → implements ports
domain → nothing external
```

Circular Nest module deps are forbidden; prefer shared events or a thin orchestration application service.
