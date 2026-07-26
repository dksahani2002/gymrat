import { Module } from '@nestjs/common';
import { AnalyticsApplicationService } from '../../application/analytics/analytics.application-service';
import { ANALYTICS_REPOSITORY } from '../../domain/analytics/repositories/analytics.repository';
import { AnalyticsPrismaRepository } from '../../infrastructure/persistence/repositories/analytics.prisma-repository';
import { AnalyticsController } from './analytics.controller';
import { WorkoutAnalyticsListener } from './workout-analytics.listener';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsApplicationService,
    WorkoutAnalyticsListener,
    { provide: ANALYTICS_REPOSITORY, useClass: AnalyticsPrismaRepository },
  ],
  exports: [AnalyticsApplicationService],
})
export class AnalyticsModule {}
