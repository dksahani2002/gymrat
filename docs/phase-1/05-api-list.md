# 05 — API List

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <access_token>` unless marked Public  
Standard envelope:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "...", "pagination": {} },
  "error": null
}
```

Error envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable",
    "details": []
  }
}
```

---

## Auth

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | Public | Create account |
| POST | `/auth/login` | Public | Email/password login |
| POST | `/auth/refresh` | Public (refresh cookie/body) | Rotate tokens |
| POST | `/auth/logout` | Auth | Revoke refresh family |
| POST | `/auth/forgot-password` | Public | Send reset email |
| POST | `/auth/reset-password` | Public | Apply reset token |
| POST | `/auth/google` | Public | Exchange Google code/id token |
| GET | `/auth/me` | Auth | Current principal |

### POST `/auth/register`
**Request:** `{ email, password, displayName? }`  
**Validation:** email, password min 8 + complexity  
**Response 201:** `{ user, accessToken, refreshToken }`  
**Errors:** `409 EMAIL_TAKEN`, `400 VALIDATION_ERROR`

### POST `/auth/login`
**Request:** `{ email, password }`  
**Response 200:** tokens + user  
**Errors:** `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED`

### POST `/auth/refresh`
**Request:** `{ refreshToken }`  
**Response 200:** new access + refresh  
**Errors:** `401 TOKEN_REUSE_DETECTED` (revokes family), `401 INVALID_TOKEN`

### POST `/auth/forgot-password`
**Request:** `{ email }`  
**Response 202:** always OK (no email enumeration)

### POST `/auth/google`
**Request:** `{ idToken }` or `{ code, redirectUri }`  
**Response 200/201:** tokens + user

---

## Users / Profile

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me` | Full profile |
| PATCH | `/users/me` | Update profile fields |
| DELETE | `/users/me` | Soft-delete account |
| GET | `/users/me/preferences` | Units, notification prefs |
| PATCH | `/users/me/preferences` | Update prefs |

**PATCH body:** height, gender, DOB, fitnessGoal, activityLevel, timezone, displayName

---

## Exercises

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/exercises` | Search/list (q, category, muscle, cursor) |
| GET | `/exercises/:id` | Detail + muscles + aliases |
| GET | `/exercises/categories` | Categories |
| GET | `/exercises/muscles` | Muscle groups |
| POST | `/exercises` | Admin or custom user exercise |
| PATCH | `/exercises/:id` | Admin update |
| DELETE | `/exercises/:id` | Admin soft delete |

---

## Workouts

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/workouts` | Create workout (+ nested exercises/sets) |
| GET | `/workouts` | History (cursor, from, to, status) |
| GET | `/workouts/:id` | Detail |
| PATCH | `/workouts/:id` | Update metadata / structure |
| DELETE | `/workouts/:id` | Soft delete |
| POST | `/workouts/:id/complete` | Mark completed, enqueue analytics |
| POST | `/workouts/:id/exercises` | Add exercise |
| PATCH | `/workouts/:id/exercises/:exerciseId` | Reorder/notes |
| DELETE | `/workouts/:id/exercises/:exerciseId` | Remove |
| POST | `/workouts/:id/exercises/:exerciseId/sets` | Add set |
| PATCH | `/workouts/:id/sets/:setId` | Update set |
| DELETE | `/workouts/:id/sets/:setId` | Delete set |

### POST `/workouts` example
```json
{
  "title": "Push Day",
  "source": "AI_TEXT",
  "startedAt": "2026-07-26T10:00:00Z",
  "idempotencyKey": "client-uuid",
  "exercises": [
    {
      "exerciseId": "uuid",
      "position": 1,
      "sets": [
        { "setNumber": 1, "reps": 5, "weight": 80, "weightUnit": "KG" },
        { "setNumber": 2, "reps": 5, "weight": 80, "weightUnit": "KG" }
      ]
    }
  ]
}
```

---

## AI Logging

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ai/parse-text` | NL → structured draft |
| POST | `/ai/parse-voice` | Audio upload → draft |
| POST | `/ai/parse-image` | OCR stub (501 or flag) |
| GET | `/ai/parse-logs` | User's recent parse history |

### POST `/ai/parse-text`
**Request:**
```json
{
  "text": "Bench 80kg 5x5 then incline db 30kg 3x10",
  "unitHint": "KG",
  "locale": "en"
}
```
**Response 200:**
```json
{
  "confidence": 0.92,
  "ambiguous": [],
  "workout": {
    "title": null,
    "exercises": [
      {
        "rawName": "Bench",
        "resolvedExercise": {
          "id": "...",
          "name": "Bench Press",
          "confidence": 0.97
        },
        "sets": [
          { "weight": 80, "reps": 5, "weightUnit": "KG" },
          { "weight": 80, "reps": 5, "weightUnit": "KG" },
          { "weight": 80, "reps": 5, "weightUnit": "KG" },
          { "weight": 80, "reps": 5, "weightUnit": "KG" },
          { "weight": 80, "reps": 5, "weightUnit": "KG" }
        ]
      }
    ]
  },
  "warnings": []
}
```
**Auth:** required  
**Rate limit:** stricter (e.g. 30/min)  
**Errors:** `422 UNPARSEABLE`, `502 AI_PROVIDER_ERROR`

### POST `/ai/parse-voice`
`multipart/form-data`: `audio` (webm/m4a/wav), optional `unitHint`  
Pipeline: S3 store → STT → parse-text pipeline → same response shape.

---

## Personal Records

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/personal-records` | List (exerciseId?, type?, from, to) |
| GET | `/personal-records/summary` | Latest PR per exercise |

---

## Analytics

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/analytics/overview` | Streak, frequency, volume summary |
| GET | `/analytics/volume` | Series: period=day\|week\|month\|year |
| GET | `/analytics/volume/exercise/:exerciseId` | Exercise volume series |
| GET | `/analytics/volume/muscle` | Muscle volume breakdown / series |
| GET | `/analytics/estimated-1rm` | e1RM by exercise over time |
| GET | `/analytics/frequency` | Training frequency |
| GET | `/analytics/consistency` | Consistency score |
| GET | `/analytics/duration` | Duration series |
| GET | `/analytics/charts/:chartType` | Normalized chart payload |

**Chart response shape:**
```json
{
  "chartType": "weekly_volume",
  "unit": "kg",
  "points": [{ "x": "2026-W30", "y": 12450.5, "label": "Jul 20" }]
}
```

---

## Progressive Overload

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/recommendations/overload` | Next session suggestions |
| GET | `/recommendations/overload/:exerciseId` | Per-exercise suggestion |

---

## Body Metrics

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/body-weight` | Log weight |
| GET | `/body-weight` | History |
| DELETE | `/body-weight/:id` | Soft delete |
| POST | `/measurements` | Log measurements |
| GET | `/measurements` | History |
| DELETE | `/measurements/:id` | Soft delete |

---

## Goals

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/goals` | Create |
| GET | `/goals` | List |
| GET | `/goals/:id` | Detail + progress |
| PATCH | `/goals/:id` | Update |
| POST | `/goals/:id/complete` | Mark complete |
| DELETE | `/goals/:id` | Soft delete |

---

## Calendar

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/calendar` | `from`/`to` → completed + planned |
| POST | `/calendar/planned` | Create planned marker |
| PATCH | `/calendar/planned/:id` | Update |
| DELETE | `/calendar/planned/:id` | Delete |

---

## Notifications

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/notifications` | Inbox |
| POST | `/notifications/:id/read` | Mark read |
| POST | `/notifications/read-all` | Mark all |
| PATCH | `/notifications/preferences` | Prefs |
| POST | `/notifications/push-tokens` | Register device |

---

## Health

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | Public | Liveness |
| GET | `/health/ready` | Public | DB+Redis readiness |

---

## Status Code Convention

| Code | Use |
|------|-----|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (async) |
| 204 | No content |
| 400 | Validation |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 422 | Unprocessable (AI) |
| 429 | Rate limited |
| 500 | Unexpected |
| 502 | Upstream AI |
| 503 | Dependency down |

---

## Swagger

- OpenAPI 3 via `@nestjs/swagger`
- Bearer auth scheme
- Examples on all DTOs
- Tagged by module
- Published at `/docs` (non-prod) / gated in prod
