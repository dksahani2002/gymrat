# 12 — Project Roadmap

## Vision Timeline

```
Phase 1 ── MVP Backend (this repo now)
Phase 2 ── Intelligence & lifestyle tracking
Phase 3 ── Platform, CV, wearables, scale
```

---

## Phase 1 — Foundation (Implement after docs)

**Outcome:** Production-capable API: auth, natural workout logging, history, PRs, analytics, overload suggestions, body metrics, goals, calendar, notifications.

**Exit criteria:** See [14-milestones.md](./14-milestones.md) M1–M5.

---

## Phase 2 — Intelligence Layer (Docs only now)

- AI workout recommendation & recovery engines
- Nutrition, water, sleep, supplements
- Progress photos, body fat
- AI chat coach, habits, recovery score
- Smart notifications, goal prediction
- Templates, imports (Strong/Hevy/CSV)
- Wearable sync **layer** (adapters stubbed)
- Analytics V2, weekly/monthly AI reports

See [../phase-2/README.md](../phase-2/README.md).

---

## Phase 3 — Platform & Scale (Docs only now)

- Computer vision form detection
- Full wearable integrations
- Coach dashboard, marketplace, community
- Subscriptions & payments
- ML warehouse, multi-region, Kafka, feature flags
- Offline sync, DR, deep observability

See [../phase-3/README.md](../phase-3/README.md).

---

## Cross-Phase Technical Evolution

| Concern | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| Events | In-process + BullMQ | Outbox | Kafka |
| AI | Parser providers | Coach + recovery models | CV + predictive ML |
| Deploy | Single ECS service | Split workers | Multi-region |
| Data | OLTP + snapshots | + object media | + warehouse |
| Auth | User/Admin | + entitlements | + org RBAC |
