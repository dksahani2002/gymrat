# 15 — Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | LLM parse hallucinations / wrong exercises | H | H | Confirm-before-save; alias DB; confidence + ambiguity UX; hybrid rules for `NxM` patterns |
| R2 | AI cost spikes at scale | H | M | Cache parses by input hash; rate limits; cheaper model for easy patterns; rules-first preparse |
| R3 | Analytics lag under burst completes | M | M | Per-user queue concurrency; batch recomputes; read-your-writes via sync light path for overview |
| R4 | Refresh token theft | M | H | Rotation + family revoke; secure storage guidance; short access TTL |
| R5 | Schema churn delaying clients | M | M | Version `/api/v1`; expand/contract migrations; contract tests |
| R6 | Exercise catalog quality gaps | H | M | Seed aliases heavily; allow user custom exercises; feedback loop to add aliases |
| R7 | Unit conversion rounding bugs | M | M | Store `weight_kg` normalized; golden tests LB/KG |
| R8 | PII / health data compliance | M | H | Soft delete + purge jobs; audit logs; minimize AI log retention; DPA with AI vendor |
| R9 | Single-region outage | M | H | Phase 1: multi-AZ RDS + Redis; Phase 3 multi-region |
| R10 | Over-scoping Phase 1 | H | H | Strict module list; Phase 2+ docs only; sprint DoD |
| R11 | BullMQ job duplication | M | M | Idempotent upserts; jobId = `analytics:{userId}:{date}` |
| R12 | Google OAuth account linking abuse | L | H | Only link when email_verified; audit; optional re-auth |

## Open Decisions (resolve before/at M0)

1. ECS vs EKS for Phase 1 deploy
2. Refresh transport: body vs HttpOnly cookie
3. AI primary provider (OpenAI vs Anthropic)
4. Minimum exercise seed size
5. Bodyweight exercise volume policy
