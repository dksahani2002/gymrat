export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Port for password hashing (argon2id).
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
