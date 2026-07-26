import { Module } from '@nestjs/common';
import { ProgressiveOverloadApplicationService } from '../../application/progressive-overload/progressive-overload.application-service';
import { OVERLOAD_REPOSITORY } from '../../domain/progressive-overload/repositories/overload.repository';
import { OverloadPrismaRepository } from '../../infrastructure/persistence/repositories/overload.prisma-repository';
import { OverloadCacheListener } from './overload-cache.listener';
import { RecommendationsController } from './recommendations.controller';

@Module({
  controllers: [RecommendationsController],
  providers: [
    ProgressiveOverloadApplicationService,
    OverloadCacheListener,
    { provide: OVERLOAD_REPOSITORY, useClass: OverloadPrismaRepository },
  ],
  exports: [ProgressiveOverloadApplicationService],
})
export class RecommendationsModule {}
