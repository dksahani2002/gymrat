# Body Weight — Implementation Notes

Implements Phase 1 body-weight APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/body-weight` | Log weight (`unit` KG/LB, optional `recordedAt`) |
| GET | `/body-weight` | History (`from`, `to`, cursor) |
| DELETE | `/body-weight/:id` | Soft delete |

Weights are stored with display `weight`/`unit` plus normalized `weightKg`.  
Events: `body_weight.logged`, `body_weight.deleted`.  
Analytics chart `body_weight_over_time` reads this ledger.
