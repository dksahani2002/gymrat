import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailPort } from '../../application/identity/ports/mail.port';

/**
 * Development mail adapter. Logs messages; swap for SES/SendGrid in production.
 */
@Injectable()
export class LoggingMailService implements MailPort {
  private readonly logger = new Logger(LoggingMailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordReset(email: string, resetToken: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const logTokens = this.configService.get<boolean>('mail.logResetTokens', false);

    this.logger.log(`Password reset email queued for ${email}`);
    if (logTokens) {
      this.logger.warn(`DEV reset link for ${email}: ${resetUrl}`);
    }
  }

  async sendWelcome(email: string, displayName?: string | null): Promise<void> {
    this.logger.log(`Welcome email queued for ${email}${displayName ? ` (${displayName})` : ''}`);
  }
}
