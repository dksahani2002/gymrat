import { Injectable, Logger } from '@nestjs/common';
import { SpeechToTextPort } from '../../../application/ai-logging/ports/speech-to-text.port';

/**
 * Development STT stub. Replace with Whisper/provider in production.
 * Reads optional filename hints encoded in the storage key for tests.
 */
@Injectable()
export class MockSpeechToTextService implements SpeechToTextPort {
  private readonly logger = new Logger(MockSpeechToTextService.name);

  async transcribe(input: {
    storageKey: string;
    mimeType: string;
  }): Promise<{ text: string; provider: string; latencyMs: number }> {
    const started = Date.now();
    this.logger.warn(
      `Mock STT used for ${input.storageKey} (${input.mimeType}). Configure a real provider for production.`,
    );

    // Allow e2e/tests to pass transcript via key suffix: voice/.../transcript__Bench_80kg_5x5.webm
    const match = input.storageKey.match(/transcript__([^/]+)\.[^.]+$/i);
    const text = match
      ? decodeURIComponent(match[1].replace(/_/g, ' '))
      : 'Bench 80kg 5x5';

    return {
      text,
      provider: 'mock-stt',
      latencyMs: Date.now() - started,
    };
  }
}
