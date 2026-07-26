# Calendar — Implementation Notes

Implements Phase 1 calendar APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/calendar?from&to` | Completed + planned by day (max 93d) |
| POST | `/calendar/planned` | Create planned marker |
| PATCH | `/calendar/planned/:id` | Update |
| DELETE | `/calendar/planned/:id` | Soft delete |

## Response shape

```json
{
  "from": "2026-07-01",
  "to": "2026-07-31",
  "timezone": "UTC",
  "days": [
    {
      "date": "2026-07-26",
      "completed": [{ "id": "...", "title": "Push", "durationSec": 3600 }],
      "planned": [{ "id": "...", "title": "Legs", "plannedDate": "2026-07-26" }]
    }
  ]
}
```

Completed dates use the user's profile timezone. Only days with at least one item are returned.
