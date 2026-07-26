import { Module } from '@nestjs/common';
import { AiLoggingApplicationService } from '../../application/ai-logging/ai-logging.application-service';
import { AI_PARSE_LOG_REPOSITORY } from '../../application/ai-logging/ports/ai-parse-log.repository';
import { AI_WORKOUT_PARSER } from '../../application/ai-logging/ports/ai-workout-parser.port';
import { EXERCISE_RESOLVER } from '../../application/ai-logging/ports/exercise-resolver.port';
import { OBJECT_STORAGE } from '../../application/ai-logging/ports/object-storage.port';
import { SPEECH_TO_TEXT } from '../../application/ai-logging/ports/speech-to-text.port';
import { MockSpeechToTextService } from '../../infrastructure/ai/providers/mock-speech-to-text.service';
import { PrismaExerciseResolver } from '../../infrastructure/ai/providers/prisma-exercise.resolver';
import { RulesWorkoutParser } from '../../infrastructure/ai/providers/rules-workout.parser';
import { AiParseLogPrismaRepository } from '../../infrastructure/persistence/repositories/ai-parse-log.prisma-repository';
import { LocalObjectStorage } from '../../infrastructure/storage/local-object.storage';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [
    AiLoggingApplicationService,
    { provide: AI_WORKOUT_PARSER, useClass: RulesWorkoutParser },
    { provide: EXERCISE_RESOLVER, useClass: PrismaExerciseResolver },
    { provide: SPEECH_TO_TEXT, useClass: MockSpeechToTextService },
    { provide: OBJECT_STORAGE, useClass: LocalObjectStorage },
    { provide: AI_PARSE_LOG_REPOSITORY, useClass: AiParseLogPrismaRepository },
  ],
  exports: [AiLoggingApplicationService],
})
export class AiModule {}
