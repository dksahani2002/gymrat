import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import {
  GoogleAuthPort,
  GoogleIdentity,
} from '../../../application/identity/ports/google-auth.port';
import { AuthenticationError } from '../../../shared/errors/base.error';
import { ErrorCodes } from '../../../shared/errors/error-codes';

/**
 * Verifies Google ID tokens against configured OAuth client IDs.
 */
@Injectable()
export class GoogleAuthService implements GoogleAuthPort {
  private readonly client: OAuth2Client;
  private readonly audiences: string[];

  constructor(private readonly configService: ConfigService) {
    this.audiences = this.configService.get<string[]>(
      'auth.googleClientIds',
      [],
    );
    this.client = new OAuth2Client();
  }

  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    if (this.audiences.length === 0) {
      throw new AuthenticationError(
        'Google OAuth is not configured',
        ErrorCodes.AUTHENTICATION_ERROR,
      );
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audiences,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new AuthenticationError(
          'Invalid Google token payload',
          ErrorCodes.INVALID_TOKEN,
        );
      }

      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        name: payload.name,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        'Invalid Google ID token',
        ErrorCodes.INVALID_TOKEN,
        error,
      );
    }
  }
}
