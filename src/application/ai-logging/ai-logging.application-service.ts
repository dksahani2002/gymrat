import { createHash, randomUUID } from 'crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AI_PARSE_LOG_REPOSITORY } from './ports/ai-parse-log.repository';
import type { AiParseLogRepository } from './ports/ai-parse-log.repository';
import { AI_WORKOUT_PARSER } from './ports/ai-workout-parser.port';
import type {
  AiWorkoutParserPort,
  WeightUnitHint,
} from './ports/ai-workout-parser.port';
import { EXERCISE_RESOLVER } from './ports/exercise-resolver.port';
import type { ExerciseResolverPort } from './ports/exercise-resolver.port';
import { OBJECT_STORAGE } from './ports/object-storage.port';
import type { ObjectStoragePort } from './ports/object-storage.port';
import { SPEECH_TO_TEXT } from './ports/speech-to-text.port';
import type { SpeechToTextPort } from './ports/speech-to-text.port';
import { BusinessError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';

export interface ParsedWorkoutDraft {
  confidence: number;
  ambiguous: Array<{
    rawName: string;
    suggestions: Array<{ id: string; name: string; confidence: number }>;
  }>;
  workout: {
    title: string | null;
    exercises: Array<{
      rawName: string;
      resolvedExercise: {
        id: string;
        name: string;
        confidence: number;
      } | null;
      sets: Array<{
        weight?: number;
        reps?: number;
        weightUnit: WeightUnitHint;
        rpe?: number;
      }>;
      notes?: string;
    }>;
  };
  warnings: string[];
  transcript?: string;
  provider: string;
  model: string;
  latencyMs: number;
}

/**
 * Orchestrates NL/voice parse → exercise resolve → draft (no workout persistence).
 */
@Injectable()
export class AiLoggingApplicationService {
  constructor(
    @Inject(AI_WORKOUT_PARSER) private readonly parser: AiWorkoutParserPort,
    @Inject(EXERCISE_RESOLVER) private readonly resolver: ExerciseResolverPort,
    @Inject(SPEECH_TO_TEXT) private readonly stt: SpeechToTextPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(AI_PARSE_LOG_REPOSITORY) private readonly logs: AiParseLogRepository,
  ) {}

  async parseText(input: {
    userId: string;
    text: string;
    unitHint?: WeightUnitHint;
    locale?: string;
  }): Promise<ParsedWorkoutDraft> {
    return this.parseAndLog({
      userId: input.userId,
      text: input.text,
      unitHint: input.unitHint,
      locale: input.locale,
      modality: 'TEXT',
    });
  }

  async parseVoice(input: {
    userId: string;
    buffer: Buffer;
    mimeType: string;
    originalName: string;
    unitHint?: WeightUnitHint;
    locale?: string;
  }): Promise<ParsedWorkoutDraft> {
    const started = Date.now();
    const ext = this.extensionFor(input.mimeType, input.originalName);
    const key = `voice-uploads/${input.userId}/${randomUUID()}${ext}`;
    await this.storage.putObject({
      key,
      body: input.buffer,
      contentType: input.mimeType,
    });

    const transcript = await this.stt.transcribe({
      storageKey: key,
      mimeType: input.mimeType,
    });

    const draft = await this.parseAndLog({
      userId: input.userId,
      text: transcript.text,
      unitHint: input.unitHint,
      locale: input.locale,
      modality: 'VOICE',
      providerOverride: transcript.provider,
    });

    draft.transcript = transcript.text;
    draft.latencyMs = Date.now() - started;
    draft.warnings = [...draft.warnings, `stt:${transcript.provider}`];
    return draft;
  }

  parseImage(): never {
    throw new BusinessError(
      'OCR workout parsing is not implemented yet',
      ErrorCodes.NOT_IMPLEMENTED,
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  async listLogs(userId: string, limit = 20) {
    const rows = await this.logs.listForUser(
      userId,
      Math.min(Math.max(limit, 1), 100),
    );
    return rows.map((row) => ({
      id: row.id,
      modality: row.modality,
      provider: row.provider,
      model: row.model,
      confidence: row.confidence,
      success: row.success,
      errorCode: row.errorCode,
      latencyMs: row.latencyMs,
      resultSummary: row.resultSummary,
      createdAt: row.createdAt,
    }));
  }

  private async parseAndLog(input: {
    userId: string;
    text: string;
    unitHint?: WeightUnitHint;
    locale?: string;
    modality: 'TEXT' | 'VOICE';
    providerOverride?: string;
  }): Promise<ParsedWorkoutDraft> {
    const started = Date.now();
    const inputHash = this.hash(input.text);

    try {
      const raw = await this.parser.parse({
        text: input.text,
        unitHint: input.unitHint,
        locale: input.locale,
      });
      const draft = await this.toDraft(raw);
      draft.latencyMs = Date.now() - started;
      if (input.providerOverride) {
        draft.provider = `${input.providerOverride}+${draft.provider}`;
      }

      await this.logs.create({
        userId: input.userId,
        modality: input.modality,
        provider: draft.provider,
        model: draft.model,
        inputHash,
        latencyMs: draft.latencyMs,
        promptTokens: raw.providerMeta.promptTokens,
        completionTokens: raw.providerMeta.completionTokens,
        confidence: draft.confidence,
        success: true,
        resultSummary: {
          exerciseCount: draft.workout.exercises.length,
          ambiguousCount: draft.ambiguous.length,
        },
      });

      return draft;
    } catch (error) {
      const code =
        error instanceof BusinessError
          ? error.code
          : ErrorCodes.AI_PROVIDER_ERROR;
      await this.logs.create({
        userId: input.userId,
        modality: input.modality,
        provider: input.providerOverride ?? 'unknown',
        inputHash,
        latencyMs: Date.now() - started,
        success: false,
        errorCode: code,
      });

      if (error instanceof BusinessError) {
        throw error;
      }
      throw new BusinessError(
        'AI provider failed to parse workout text',
        ErrorCodes.AI_PROVIDER_ERROR,
        HttpStatus.BAD_GATEWAY,
        error,
      );
    }
  }

  private async toDraft(
    raw: Awaited<ReturnType<AiWorkoutParserPort['parse']>>,
  ): Promise<ParsedWorkoutDraft> {
    const ambiguous: ParsedWorkoutDraft['ambiguous'] = [];
    const warnings: string[] = [];
    const exercises: ParsedWorkoutDraft['workout']['exercises'] = [];
    let confidenceSum = 0;

    for (const candidate of raw.exercises) {
      const resolution = await this.resolver.resolve(candidate.rawName);
      if (resolution.ambiguous) {
        ambiguous.push({
          rawName: candidate.rawName,
          suggestions: resolution.suggestions.map((s) => ({
            id: s.id,
            name: s.name,
            confidence: s.confidence,
          })),
        });
        warnings.push(`Ambiguous exercise: "${candidate.rawName}"`);
      } else if (!resolution.resolved) {
        warnings.push(`Unknown exercise: "${candidate.rawName}"`);
        if (resolution.suggestions.length > 0) {
          ambiguous.push({
            rawName: candidate.rawName,
            suggestions: resolution.suggestions.map((s) => ({
              id: s.id,
              name: s.name,
              confidence: s.confidence,
            })),
          });
        }
      } else {
        confidenceSum += resolution.resolved.confidence;
      }

      exercises.push({
        rawName: candidate.rawName,
        resolvedExercise: resolution.resolved
          ? {
              id: resolution.resolved.id,
              name: resolution.resolved.name,
              confidence: resolution.resolved.confidence,
            }
          : null,
        sets: candidate.sets.map((set) => ({
          weight: set.weight,
          reps: set.reps,
          weightUnit: set.unit ?? 'KG',
          rpe: set.rpe,
        })),
        notes: candidate.notes,
      });
    }

    const confidence =
      raw.exercises.length > 0
        ? Math.round((confidenceSum / raw.exercises.length) * 1000) / 1000
        : 0;

    return {
      confidence,
      ambiguous,
      workout: {
        title: raw.title ?? null,
        exercises,
      },
      warnings,
      provider: raw.providerMeta.provider,
      model: raw.providerMeta.model,
      latencyMs: raw.providerMeta.latencyMs,
    };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private extensionFor(mimeType: string, originalName: string): string {
    if (originalName.includes('.')) {
      return originalName.slice(originalName.lastIndexOf('.'));
    }
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('wav')) return '.wav';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
    return '.bin';
  }
}
