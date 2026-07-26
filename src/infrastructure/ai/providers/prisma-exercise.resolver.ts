import { Injectable } from '@nestjs/common';
import {
  ExerciseResolution,
  ExerciseResolverPort,
  ResolvedExerciseMatch,
} from '../../../application/ai-logging/ports/exercise-resolver.port';
import { PrismaService } from '../../persistence/prisma/prisma.service';

/**
 * Resolves free-text exercise names via alias → exact name → ILIKE contains.
 */
@Injectable()
export class PrismaExerciseResolver implements ExerciseResolverPort {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(rawName: string): Promise<ExerciseResolution> {
    const normalized = rawName.trim().toLowerCase();
    if (!normalized) {
      return { rawName, resolved: null, suggestions: [], ambiguous: false };
    }

    const byAlias = await this.prisma.exerciseAlias.findUnique({
      where: { alias: normalized },
      include: { exercise: true },
    });
    if (byAlias && !byAlias.exercise.deletedAt && byAlias.exercise.isActive) {
      return {
        rawName,
        resolved: {
          id: byAlias.exercise.id,
          name: byAlias.exercise.name,
          slug: byAlias.exercise.slug,
          confidence: 0.97,
        },
        suggestions: [],
        ambiguous: false,
      };
    }

    const exact = await this.prisma.exercise.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        isCustom: false,
        name: { equals: rawName.trim(), mode: 'insensitive' },
      },
    });
    if (exact) {
      return {
        rawName,
        resolved: {
          id: exact.id,
          name: exact.name,
          slug: exact.slug,
          confidence: 0.95,
        },
        suggestions: [],
        ambiguous: false,
      };
    }

    const fuzzy = await this.prisma.exercise.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        isCustom: false,
        OR: [
          { name: { contains: normalized, mode: 'insensitive' } },
          {
            aliases: {
              some: { alias: { contains: normalized, mode: 'insensitive' } },
            },
          },
          {
            slug: {
              contains: normalized.replace(/\s+/g, '-'),
              mode: 'insensitive',
            },
          },
        ],
      },
      take: 5,
      orderBy: { name: 'asc' },
    });

    const suggestions: ResolvedExerciseMatch[] = fuzzy.map((row, index) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      confidence: Math.max(0.4, 0.85 - index * 0.08),
    }));

    if (suggestions.length === 0) {
      return { rawName, resolved: null, suggestions: [], ambiguous: false };
    }

    const top = suggestions[0];
    const second = suggestions[1];
    const ambiguous =
      Boolean(second) && Math.abs(top.confidence - second.confidence) <= 0.08;

    return {
      rawName,
      resolved: ambiguous ? null : top,
      suggestions,
      ambiguous,
    };
  }
}
