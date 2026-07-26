# 07 — Sequence Diagrams

## 1. Register + Login

```mermaid
sequenceDiagram
  participant C as Client
  participant API as AuthController
  participant UC as RegisterHandler
  participant Repo as UserRepository
  participant Hash as PasswordHasher
  participant Tok as TokenService
  participant Bus as EventBus

  C->>API: POST /auth/register
  API->>UC: RegisterCommand
  UC->>Repo: findByEmail
  alt email exists
    UC-->>API: ConflictError
  else new user
    UC->>Hash: hash(password)
    UC->>Repo: create(user, profile)
    UC->>Tok: issueAccessAndRefresh
    UC->>Bus: UserRegistered
    UC-->>API: AuthResult
    API-->>C: 201 tokens + user
  end
```

## 2. Refresh Token Rotation

```mermaid
sequenceDiagram
  participant C as Client
  participant API as AuthController
  participant UC as RefreshHandler
  participant RT as RefreshTokenRepository
  participant Redis as Redis

  C->>API: POST /auth/refresh {refreshToken}
  API->>UC: RefreshCommand
  UC->>UC: hash(token)
  UC->>RT: findValid(hash)
  alt missing/expired
    UC-->>C: 401
  else already revoked (reuse)
    UC->>RT: revokeFamily(familyId)
    UC->>Redis: blacklist family
    UC-->>C: 401 TOKEN_REUSE_DETECTED
  else valid
    UC->>RT: revoke(old), create(new, same family)
    UC-->>C: 200 new access + refresh
  end
```

## 3. AI Text Parse → Confirm Workout

```mermaid
sequenceDiagram
  participant C as Client
  participant AI as AiController
  participant Parse as ParseTextHandler
  participant Provider as AiParserPort
  participant Resolve as ExerciseResolver
  participant Log as AiParseLogRepo
  participant W as WorkoutsController
  participant Create as CreateWorkoutHandler
  participant Bus as EventBus
  participant Q as BullMQ

  C->>AI: POST /ai/parse-text
  AI->>Parse: command
  Parse->>Provider: parse(text)
  Provider-->>Parse: raw structured candidates
  Parse->>Resolve: resolve names → exercise IDs
  Parse->>Log: write ai_parse_logs
  Parse-->>C: ParsedWorkoutDraft

  Note over C: User confirms / edits draft

  C->>W: POST /workouts (structured + idempotencyKey)
  W->>Create: CreateWorkoutCommand
  Create-->>C: 201 Workout
  C->>W: POST /workouts/:id/complete
  W->>Bus: WorkoutCompleted
  Bus->>Q: analytics + pr-detection jobs
```

## 4. Workout Complete → Analytics & PR

```mermaid
sequenceDiagram
  participant Bus as EventBus
  participant PR as PrDetectionProcessor
  participant An as AnalyticsProcessor
  participant Streak as StreakService
  participant Notif as NotificationProcessor
  participant DB as PostgreSQL
  participant Cache as Redis

  Bus->>PR: WorkoutCompleted
  PR->>DB: load sets + prior PRs
  PR->>DB: insert new personal_records
  opt new PR
    PR->>Notif: enqueue PR notification
  end

  Bus->>An: WorkoutCompleted
  An->>DB: upsert daily/weekly snapshots
  An->>DB: upsert muscle_volume_daily
  An->>DB: upsert exercise_stats
  An->>Cache: invalidate analytics keys
  An->>Streak: recompute streak
```

## 5. Google OAuth Login

```mermaid
sequenceDiagram
  participant C as Client
  participant API as AuthController
  participant UC as GoogleLoginHandler
  participant Google as Google Token Verify
  participant Repo as UserRepository
  participant Tok as TokenService

  C->>API: POST /auth/google {idToken}
  API->>UC: command
  UC->>Google: verify idToken
  Google-->>UC: email, sub, name
  UC->>Repo: findByGoogleSub OR findByEmail
  alt new
    UC->>Repo: create oauth user + profile
  else existing email without google
    UC->>Repo: link googleSub
  end
  UC->>Tok: issue tokens
  UC-->>C: 200 AuthResult
```

## 6. Progressive Overload Recommendation Read

```mermaid
sequenceDiagram
  participant C as Client
  participant API as RecommendationsController
  participant UC as OverloadQueryHandler
  participant Stats as ExerciseStatRepository
  participant Hist as WorkoutRepository
  participant Algo as OverloadAlgorithm
  participant Cache as Redis

  C->>API: GET /recommendations/overload
  API->>UC: query
  UC->>Cache: get user:overload
  alt hit
    Cache-->>C: cached suggestions
  else miss
    UC->>Stats: list recent exercises
    UC->>Hist: last N sessions per exercise
    UC->>Algo: compute suggestions
    UC->>Cache: set TTL 15m
    UC-->>C: suggestions
  end
```
