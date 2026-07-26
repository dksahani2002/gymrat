# User Profile Module — Implementation Notes

Implements Phase 1 Users/Profile APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me` | Full profile + derived `age` |
| PATCH | `/users/me` | Update biometrics / goals / units / timezone |
| DELETE | `/users/me` | Soft-delete + anonymize PII + revoke sessions |
| GET | `/users/me/preferences` | Units + notification toggles |
| PATCH | `/users/me/preferences` | Update units / notification prefs |

## Soft-delete policy

- Sets `users.status = DELETED` and `deleted_at`
- Anonymizes email to `deleted+{userId}@deleted.local`
- Clears password hash, Google sub, display name, DOB, gender, height, goals
- Revokes all refresh token families

## Paths

- Domain: `src/domain/profile/`
- Use cases: `src/application/profile/`
- HTTP: `src/modules/users/`
