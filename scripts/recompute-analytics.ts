/**
 * CLI: recompute analytics snapshots for a user date range.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/recompute-analytics.ts \
 *     --userId <uuid> --from 2026-01-01 --to 2026-07-26
 *
 * Requires the same env vars as the API (.env).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AnalyticsApplicationService } from '../src/application/analytics/analytics.application-service';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const userId = arg('userId');
  const from = arg('from');
  const to = arg('to');
  if (!userId || !from || !to) {
    console.error(
      'Usage: --userId <uuid> --from YYYY-MM-DD --to YYYY-MM-DD',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const analytics = app.get(AnalyticsApplicationService);
    const result = await analytics.recomputeRange({ userId, from, to });
    console.log(JSON.stringify(result));
  } finally {
    await app.close();
  }
}

void main();
