# 16 — Estimated Timeline

## Assumptions

- 2 senior/mid backend engineers
- NestJS + Prisma familiarity
- Client app in parallel (API contracts frozen after Sprint 2)
- AI provider API keys available by Sprint 4
- No major compliance certification in Phase 1 (prepare data handling only)

## Calendar Estimate

| Phase | Duration | Calendar (indicative) |
|-------|----------|------------------------|
| Docs (this deliverable) | 3–5 days | Week 0 |
| Sprint 0 scaffold | 1 week | Week 1 |
| Sprints 1–7 | 14 weeks | Weeks 2–15 |
| Buffer / polish | 2 weeks | Weeks 16–17 |
| **Phase 1 total** | **~16–18 weeks** | |

Single experienced engineer: ~1.6–1.8× calendar (~6–7 months).  
Three engineers: compress to ~12–14 weeks if parallelized (Auth ‖ Catalog after scaffold).

## Effort by Area (person-weeks)

| Area | PW |
|------|-----|
| Scaffold, CI, Docker, shared kernel | 2 |
| Auth + security middleware | 3 |
| Profile | 1 |
| Exercise catalog + seed + search | 2.5 |
| Workouts | 3.5 |
| AI parse text/voice + ports | 3 |
| PRs + analytics engine + charts | 4 |
| Progressive overload | 1.5 |
| Body metrics + goals + calendar | 2.5 |
| Notifications | 1.5 |
| Hardening, load test, deploy | 3 |
| **Total** | **~28 PW** |

## Phase 2 / 3 (order-of-magnitude, not committed)

| Phase | Estimate |
|-------|----------|
| Phase 2 | 4–6 months (2–3 engineers) |
| Phase 3 | 6–12+ months (platform team) |

## Critical Path

```
Scaffold → Auth → Exercises → Workouts → AI Parse → Complete Event
                                              ↓
                                    Analytics ‖ PRs ‖ Overload
                                              ↓
                               Body/Goals/Calendar/Notifications
                                              ↓
                                         Hardening → M5
```

AI Parse and Analytics are the longest poles after Auth; start provider mocks early so workouts e2e does not block.
