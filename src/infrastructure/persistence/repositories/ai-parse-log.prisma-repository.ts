import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AiParseLogRecord,
  AiParseLogRepository,
  CreateAiParseLogInput,
} from '../../../application/ai-logging/ports/ai-parse-log.repository';
import { PrismaService } from '../../persistence/prisma/prisma.service';

@Injectable()
export class AiParseLogPrismaRepository implements AiParseLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAiParseLogInput): Promise<AiParseLogRecord> {
    const row = await this.prisma.aiParseLog.create({
      data: {
        userId: input.userId,
        modality: input.modality,
        provider: input.provider,
        model: input.model ?? null,
        inputHash: input.inputHash,
        latencyMs: input.latencyMs,
        promptTokens: input.promptTokens ?? null,
        completionTokens: input.completionTokens ?? null,
        confidence: input.confidence ?? null,
        success: input.success,
        errorCode: input.errorCode ?? null,
        resultSummary:
          input.resultSummary === undefined
            ? undefined
            : (input.resultSummary as Prisma.InputJsonValue),
      },
    });
    return this.toRecord(row);
  }

  async listForUser(
    userId: string,
    limit: number,
  ): Promise<AiParseLogRecord[]> {
    const rows = await this.prisma.aiParseLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: {
    id: string;
    userId: string;
    modality: string;
    provider: string;
    model: string | null;
    inputHash: string;
    latencyMs: number;
    confidence: Prisma.Decimal | null;
    success: boolean;
    errorCode: string | null;
    resultSummary: Prisma.JsonValue | null;
    createdAt: Date;
  }): AiParseLogRecord {
    return {
      id: row.id,
      userId: row.userId,
      modality: row.modality,
      provider: row.provider,
      model: row.model,
      inputHash: row.inputHash,
      latencyMs: row.latencyMs,
      confidence: row.confidence ? Number(row.confidence) : null,
      success: row.success,
      errorCode: row.errorCode,
      resultSummary: row.resultSummary,
      createdAt: row.createdAt,
    };
  }
}
