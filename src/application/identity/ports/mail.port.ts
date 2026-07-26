export const MAIL_PORT = Symbol('MAIL_PORT');

/**
 * Port for transactional email delivery.
 */
export interface MailPort {
  sendPasswordReset(email: string, resetToken: string): Promise<void>;
  sendWelcome(email: string, displayName?: string | null): Promise<void>;
}
