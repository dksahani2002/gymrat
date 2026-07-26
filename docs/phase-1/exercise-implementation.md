# Exercise Catalog — Implementation Notes

Implements Phase 1 Exercise APIs from [05-api-list.md](./05-api-list.md).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/exercises` | Search `q`, filter category/muscle/equipment, cursor pagination |
| GET | `/exercises/:id` | Detail + muscles + aliases |
| GET | `/exercises/categories` | Cached catalog |
| GET | `/exercises/muscles` | Cached catalog |
| GET | `/exercises/equipment` | Cached catalog |
| POST | `/exercises` | Users → custom; Admins → global (unless `asCustom`) |
| PATCH | `/exercises/:id` | Owner or admin |
| DELETE | `/exercises/:id` | Soft delete (owner or admin) |

## Seed

```bash
npx prisma migrate dev
npm run prisma:seed
```

Seeds ~32 common exercises with aliases (e.g. `bench` → Bench Press).

## Caching

Redis key `exercises:catalog:{version}:{categories|muscles|equipment}`  
Writes bump `exercises:catalog:version`.
