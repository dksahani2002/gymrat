export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '30', 10),
    googleClientIds: (process.env.GOOGLE_CLIENT_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  },
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  mail: {
    from: process.env.MAIL_FROM ?? 'noreply@gymrat.local',
    logResetTokens: process.env.MAIL_LOG_RESET_TOKENS === 'true',
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '10', 10),
  },
  ai: {
    provider: process.env.AI_PARSER_PROVIDER ?? 'rules',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    voiceStorageDir: process.env.VOICE_STORAGE_DIR ?? './storage/voice',
    maxVoiceBytes: parseInt(process.env.MAX_VOICE_BYTES ?? String(25 * 1024 * 1024), 10),
  },
  overload: {
    lookbackSessions: parseInt(process.env.OVERLOAD_LOOKBACK_SESSIONS ?? '3', 10),
    barbellIncrementKg: parseFloat(process.env.OVERLOAD_BARBELL_INCREMENT_KG ?? '2.5'),
    dumbbellIncrementKg: parseFloat(process.env.OVERLOAD_DUMBBELL_INCREMENT_KG ?? '2'),
    deloadConsecutiveFails: parseInt(process.env.OVERLOAD_DELOAD_FAILS ?? '2', 10),
    deloadPercent: parseFloat(process.env.OVERLOAD_DELOAD_PERCENT ?? '0.10'),
    detrainDays: parseInt(process.env.OVERLOAD_DETRAIN_DAYS ?? '14', 10),
    recentDays: parseInt(process.env.OVERLOAD_RECENT_DAYS ?? '28', 10),
    cacheTtlSec: parseInt(process.env.OVERLOAD_CACHE_TTL_SEC ?? '900', 10),
  },
});
