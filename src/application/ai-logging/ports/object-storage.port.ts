export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/**
 * Port for object storage (local filesystem in MVP, S3 later).
 */
export interface ObjectStoragePort {
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ key: string }>;
}
