# Body Measurements — Implementation Notes

Implements Phase 1 measurement APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/measurements` | Log circumference map (cm) |
| GET | `/measurements` | History (`from`, `to`, cursor) |
| DELETE | `/measurements/:id` | Soft delete |

## Payload

```json
{
  "measurements": { "chest": 102, "waist": 81, "left_arm": 38.5 },
  "recordedAt": "2026-07-26T08:00:00.000Z",
  "notes": "optional"
}
```

Keys: snake_case (`chest`, `waist`, `hips`, `neck`, `left_arm`, … or custom). Values are **centimeters** (1–300). Response includes `unit: "CM"`.

Events: `body_measurement.logged`, `body_measurement.deleted`.
