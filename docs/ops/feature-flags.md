# Soft-launch Feature Flags (M6)

Flags are env-driven (no remote config yet). Read via `ConfigService` under `features.*`.

| Env var | Config path | Default | Effect |
|---------|-------------|---------|--------|
| `FEATURE_SOFT_LAUNCH` | `features.softLaunch` | `false` | Documents soft-launch mode; used for ops dashboards / future gates |
| `FEATURE_VOICE_PARSE` | `features.voiceParse` | `true` | When `false`, `POST /ai/parse-voice` returns 503 |
| `FEATURE_IMAGE_PARSE` | `features.imageParse` | `false` | When `false`, `POST /ai/parse-image` returns 503 (stub otherwise 501) |
| `FEATURE_GOOGLE_AUTH` | `features.googleAuth` | `true` | When `false`, `POST /auth/google` returns 503 |

## Soft-launch profile

```bash
FEATURE_SOFT_LAUNCH=true
FEATURE_VOICE_PARSE=true
FEATURE_IMAGE_PARSE=false
FEATURE_GOOGLE_AUTH=true
```

## Changing flags

1. Update secret/env in the target environment
2. Restart API processes (flags are read at request time from ConfigService)
3. Record change in the deploy / incident channel

No migration required. Flags are safe to flip independently.
