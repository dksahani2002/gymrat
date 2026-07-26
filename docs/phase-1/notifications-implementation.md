# Notifications — Implementation Notes

Implements Phase 1 notification APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/notifications` | Inbox (`unreadOnly`, cursor) + `unreadCount` |
| POST | `/notifications/:id/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |
| GET | `/notifications/preferences` | Prefs |
| PATCH | `/notifications/preferences` | Prefs |
| POST | `/notifications/push-tokens` | Register device token (store only) |

## Event → inbox

| Event | Type | Gated by |
|-------|------|----------|
| `pr.achieved` | `pr.achieved` | `prAlerts` preference |
| `goal.completed` | `goal.completed` | always (in-app) |

Push delivery is Phase 2; tokens are persisted for later senders.
