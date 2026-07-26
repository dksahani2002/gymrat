import { Module } from '@nestjs/common';
import { PersonalRecordsApplicationService } from '../../application/personal-records/personal-records.application-service';
import { PERSONAL_RECORD_REPOSITORY } from '../../domain/personal-record/repositories/personal-record.repository';
import { WORKOUT_REPOSITORY } from '../../domain/workout/repositories/workout.repository';
import { NestEventBus } from '../../infrastructure/events/nest-event-bus';
import { PersonalRecordPrismaRepository } from '../../infrastructure/persistence/repositories/personal-record.prisma-repository';
import { WorkoutPrismaRepository } from '../../infrastructure/persistence/repositories/workout.prisma-repository';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { PersonalRecordsController } from './personal-records.controller';
import { WorkoutCompletedPrListener } from './workout-completed-pr.listener';

@Module({
  controllers: [PersonalRecordsController],
  providers: [
    PersonalRecordsApplicationService,
    WorkoutCompletedPrListener,
    { provide: PERSONAL_RECORD_REPOSITORY, useClass: PersonalRecordPrismaRepository },
    { provide: WORKOUT_REPOSITORY, useClass: WorkoutPrismaRepository },
    { provide: EVENT_BUS, useClass: NestEventBus },
  ],
  exports: [PersonalRecordsApplicationService],
})
export class PersonalRecordsModule {}
