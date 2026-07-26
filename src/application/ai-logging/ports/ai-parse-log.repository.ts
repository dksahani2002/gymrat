export const AI_PARSE_LOG_REPOSITORY = Symbol('AI_PARSE_LOG_REPOSITORY');

export interface CreateAiParseLogInput {
  userId: string;
  modality: 'TEXT' | 'VOICE' | 'OCR';
  provider: string;
  model?: string | null;
  inputHash: string;
  latencyMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  confidence?: number | null;
  success: boolean;
  errorCode?: string | null;
  resultSummary?: unknown;
}

export interface AiParseLogRecord {
  id: string;
  userId: string;
  modality: string;
  provider: string;
  model: string | null;
  inputHash: string;
  latencyMs: number;
  confidence: number | null;
  success: boolean;
  errorCode: string | null;
  resultSummary: unknown;
  createdAt: Date;
}

export interface AiParseLogRepository {
  create(input: CreateAiParseLogInput): Promise<AiParseLogRecord>;
  listForUser(userId: string, limit: number): Promise<AiParseLogRecord[]>;
}
