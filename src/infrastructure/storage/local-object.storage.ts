import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { ObjectStoragePort } from '../../application/ai-logging/ports/object-storage.port';

/**
 * Local filesystem object storage for voice uploads (S3-compatible port later).
 */
@Injectable()
export class LocalObjectStorage implements ObjectStoragePort {
  constructor(private readonly config: ConfigService) {}

  async putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ key: string }> {
    const root = this.config.get<string>(
      'ai.voiceStorageDir',
      './storage/voice',
    );
    const fullPath = join(root, input.key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.body);
    return { key: input.key };
  }
}
