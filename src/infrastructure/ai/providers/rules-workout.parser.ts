import { Injectable } from '@nestjs/common';
import {
  AiWorkoutParserPort,
  ParsedExerciseCandidate,
  ParsedSetCandidate,
  RawParseResult,
  WeightUnitHint,
} from '../../../application/ai-logging/ports/ai-workout-parser.port';
import { BusinessError } from '../../../shared/errors/base.error';
import { ErrorCodes } from '../../../shared/errors/error-codes';

/**
 * Deterministic rules-first NL workout parser.
 * Handles common logging patterns without an external LLM.
 */
@Injectable()
export class RulesWorkoutParser implements AiWorkoutParserPort {
  async parse(input: {
    text: string;
    unitHint?: WeightUnitHint;
    locale?: string;
  }): Promise<RawParseResult> {
    const started = Date.now();
    const normalized = this.normalize(input.text);
    if (!normalized) {
      throw new BusinessError(
        'Could not parse workout text',
        ErrorCodes.UNPARSEABLE,
        422,
      );
    }

    const segments = this.splitExercises(normalized);
    const exercises: ParsedExerciseCandidate[] = [];

    for (const segment of segments) {
      const parsed = this.parseSegment(segment, input.unitHint ?? 'KG');
      if (parsed) {
        exercises.push(parsed);
      }
    }

    if (exercises.length === 0) {
      throw new BusinessError(
        'Could not parse workout text',
        ErrorCodes.UNPARSEABLE,
        422,
      );
    }

    return {
      title: undefined,
      exercises,
      providerMeta: {
        provider: 'rules',
        model: 'rules-v1',
        latencyMs: Date.now() - started,
      },
    };
  }

  private normalize(text: string): string {
    return text
      .normalize('NFKC')
      .replace(/\u00d7/g, 'x')
      .replace(/(\d)\s*(kgs?|lbs?)\b/gi, (_, digit: string, unit: string) => {
        const normalizedUnit = unit.toLowerCase().startsWith('lb')
          ? 'lb'
          : 'kg';
        return `${digit} ${normalizedUnit}`;
      })
      .replace(/\bkgs\b/gi, 'kg')
      .replace(/\blbs\b/gi, 'lb')
      .replace(/\bpounds?\b/gi, 'lb')
      .replace(/\bkilograms?\b/gi, 'kg')
      .replace(/\bbody\s*weight\b/gi, 'bodyweight')
      .replace(/\bbw\b/gi, 'bodyweight')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private splitExercises(text: string): string[] {
    return text
      .split(/\b(?:then|followed by|and then|;|\n)\b/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  private parseSegment(
    segment: string,
    unitHint: WeightUnitHint,
  ): ParsedExerciseCandidate | null {
    // Pattern: Name 80kg 5x5  OR  Name 80 kg 5 x 5
    const nxM = segment.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|lb)?\s+(\d+)\s*[x×]\s*(\d+)\s*$/i,
    );
    if (nxM) {
      const rawName = nxM[1].trim();
      const weight = Number(nxM[2]);
      const unit = this.unitFrom(nxM[3], unitHint);
      const left = Number(nxM[4]);
      const right = Number(nxM[5]);
      // Convention: 5x5 => 5 sets of 5 reps (Strong/Hevy style)
      const setsCount = left;
      const reps = right;
      return {
        rawName,
        sets: this.repeatSets(setsCount, { weight, reps, unit }),
      };
    }

    // Pattern: Name 225lbs 3 sets of 5
    const setsOf = segment.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|lb)?\s+(\d+)\s*sets?\s+of\s+(\d+)\s*$/i,
    );
    if (setsOf) {
      return {
        rawName: setsOf[1].trim(),
        sets: this.repeatSets(Number(setsOf[4]), {
          weight: Number(setsOf[2]),
          reps: Number(setsOf[5]),
          unit: this.unitFrom(setsOf[3], unitHint),
        }),
      };
    }

    // Pattern: Name 20kg for 5 reps and 5 sets
    const forRepsSets = segment.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|lb)\s+for\s+(\d+)\s*reps?\s+and\s+(\d+)\s*sets?\s*$/i,
    );
    if (forRepsSets) {
      return {
        rawName: forRepsSets[1].trim(),
        sets: this.repeatSets(Number(forRepsSets[5]), {
          weight: Number(forRepsSets[2]),
          reps: Number(forRepsSets[4]),
          unit: this.unitFrom(forRepsSets[3], unitHint),
        }),
      };
    }

    // Pattern: Name bodyweight 8,8,6
    const bwList = segment.match(/^(.+?)\s+bodyweight\s+([\d,\s]+)\s*$/i);
    if (bwList) {
      const repsList = bwList[2]
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v));
      if (repsList.length === 0) return null;
      return {
        rawName: bwList[1].trim(),
        sets: repsList.map((reps) => ({
          weight: 0,
          reps,
          unit: unitHint,
        })),
      };
    }

    // Pattern: Name 80kg 5,5,5
    const weightRepList = segment.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|lb)\s+([\d,\s]+)\s*$/i,
    );
    if (weightRepList) {
      const repsList = weightRepList[4]
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v));
      if (repsList.length === 0) return null;
      const weight = Number(weightRepList[2]);
      const unit = this.unitFrom(weightRepList[3], unitHint);
      return {
        rawName: weightRepList[1].trim(),
        sets: repsList.map((reps) => ({ weight, reps, unit })),
      };
    }

    // Pattern: Name 3x10 @ 30kg
    const atWeight = segment.match(
      /^(.+?)\s+(\d+)\s*[x×]\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)\s*(kg|lb)?\s*$/i,
    );
    if (atWeight) {
      return {
        rawName: atWeight[1].trim(),
        sets: this.repeatSets(Number(atWeight[2]), {
          reps: Number(atWeight[3]),
          weight: Number(atWeight[4]),
          unit: this.unitFrom(atWeight[5], unitHint),
        }),
      };
    }

    return null;
  }

  private repeatSets(
    count: number,
    template: ParsedSetCandidate,
  ): ParsedSetCandidate[] {
    const safe = Math.min(Math.max(count, 1), 50);
    return Array.from({ length: safe }, () => ({ ...template }));
  }

  private unitFrom(
    raw: string | undefined,
    hint: WeightUnitHint,
  ): WeightUnitHint {
    if (!raw) return hint;
    return raw.toLowerCase().startsWith('lb') ? 'LB' : 'KG';
  }
}
