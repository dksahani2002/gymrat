import { AiLoggingApplicationService } from './ai-logging.application-service';
import { BusinessError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';

describe('AiLoggingApplicationService', () => {
  const parser = {
    parse: jest.fn(),
  };
  const resolver = {
    resolve: jest.fn(),
  };
  const stt = {
    transcribe: jest.fn(),
  };
  const storage = {
    putObject: jest.fn(),
  };
  const logs = {
    create: jest.fn(),
    listForUser: jest.fn(),
  };

  let service: AiLoggingApplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiLoggingApplicationService(
      parser as never,
      resolver as never,
      stt as never,
      storage as never,
      logs as never,
    );
  });

  it('parses text and resolves exercises into a draft', async () => {
    parser.parse.mockResolvedValue({
      exercises: [
        {
          rawName: 'Bench',
          sets: [
            { weight: 80, reps: 5, unit: 'KG' },
            { weight: 80, reps: 5, unit: 'KG' },
          ],
        },
      ],
      providerMeta: { provider: 'rules', model: 'rules-v1', latencyMs: 5 },
    });
    resolver.resolve.mockResolvedValue({
      rawName: 'Bench',
      resolved: {
        id: 'ex-1',
        name: 'Bench Press',
        slug: 'bench-press',
        confidence: 0.97,
      },
      suggestions: [],
      ambiguous: false,
    });
    logs.create.mockResolvedValue({});

    const draft = await service.parseText({
      userId: 'user-1',
      text: 'Bench 80kg 5x5',
    });

    expect(draft.workout.exercises[0].resolvedExercise?.name).toBe(
      'Bench Press',
    );
    expect(draft.workout.exercises[0].sets).toHaveLength(2);
    expect(draft.confidence).toBeCloseTo(0.97);
    expect(logs.create).toHaveBeenCalledWith(
      expect.objectContaining({ modality: 'TEXT', success: true }),
    );
  });

  it('marks unknown exercises with warnings', async () => {
    parser.parse.mockResolvedValue({
      exercises: [
        { rawName: 'Unknown Lift', sets: [{ reps: 10, unit: 'KG' }] },
      ],
      providerMeta: { provider: 'rules', model: 'rules-v1', latencyMs: 1 },
    });
    resolver.resolve.mockResolvedValue({
      rawName: 'Unknown Lift',
      resolved: null,
      suggestions: [],
      ambiguous: false,
    });
    logs.create.mockResolvedValue({});

    const draft = await service.parseText({
      userId: 'user-1',
      text: 'Unknown Lift 10x10',
    });

    expect(draft.workout.exercises[0].resolvedExercise).toBeNull();
    expect(draft.warnings[0]).toContain('Unknown exercise');
  });

  it('parses voice via storage + STT + text pipeline', async () => {
    storage.putObject.mockResolvedValue({ key: 'voice/x.webm' });
    stt.transcribe.mockResolvedValue({
      text: 'Bench 80kg 5x5',
      provider: 'mock-stt',
      latencyMs: 2,
    });
    parser.parse.mockResolvedValue({
      exercises: [
        { rawName: 'Bench', sets: [{ weight: 80, reps: 5, unit: 'KG' }] },
      ],
      providerMeta: { provider: 'rules', model: 'rules-v1', latencyMs: 1 },
    });
    resolver.resolve.mockResolvedValue({
      rawName: 'Bench',
      resolved: {
        id: 'ex-1',
        name: 'Bench Press',
        slug: 'bench-press',
        confidence: 0.97,
      },
      suggestions: [],
      ambiguous: false,
    });
    logs.create.mockResolvedValue({});

    const draft = await service.parseVoice({
      userId: 'user-1',
      buffer: Buffer.from('fake'),
      mimeType: 'audio/webm',
      originalName: 'clip.webm',
    });

    expect(draft.transcript).toBe('Bench 80kg 5x5');
    expect(draft.provider).toContain('mock-stt');
    expect(logs.create).toHaveBeenCalledWith(
      expect.objectContaining({ modality: 'VOICE', success: true }),
    );
  });

  it('returns 501 for OCR stub', () => {
    expect(() => service.parseImage()).toThrow(BusinessError);
    try {
      service.parseImage();
    } catch (error) {
      expect(error).toMatchObject({ code: ErrorCodes.NOT_IMPLEMENTED });
    }
  });
});
