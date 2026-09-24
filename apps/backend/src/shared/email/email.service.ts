import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

/**
 * Log-only stub. This epic has no real email-provider integration — every
 * caller depends on this interface, not the transport, so a real provider
 * can be swapped in later without touching any calling module.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async send(input: SendEmailInput): Promise<void> {
    this.logger.log(
      `[email] to=${input.to} subject="${input.subject}" body="${input.body}"`,
    );
    await Promise.resolve();
  }
}
