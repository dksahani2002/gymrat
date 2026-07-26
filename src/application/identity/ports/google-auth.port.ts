export const GOOGLE_AUTH_PORT = Symbol('GOOGLE_AUTH_PORT');

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Port for verifying Google ID tokens.
 */
export interface GoogleAuthPort {
  verifyIdToken(idToken: string): Promise<GoogleIdentity>;
}
