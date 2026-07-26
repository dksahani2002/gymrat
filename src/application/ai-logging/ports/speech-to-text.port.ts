export const SPEECH_TO_TEXT = Symbol('SPEECH_TO_TEXT');

/**
 * Port for speech-to-text transcription.
 */
export interface SpeechToTextPort {
  transcribe(input: {
    storageKey: string;
    mimeType: string;
  }): Promise<{ text: string; provider: string; latencyMs: number }>;
}
