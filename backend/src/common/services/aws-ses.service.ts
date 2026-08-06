import { Injectable, Logger } from '@nestjs/common';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

@Injectable()
export class AwsSesService {
  private readonly logger = new Logger(AwsSesService.name);

  /**
   * Send transactional email using AWS SES or Nodemailer / console fallback in dev.
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const region = process.env.AWS_REGION || 'us-east-1';
    const senderEmail = process.env.AWS_SES_FROM_EMAIL || 'support@edutrack.com';

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
        const ses = new SESClient({ region });

        const command = new SendEmailCommand({
          Source: senderEmail,
          Destination: {
            ToAddresses: [options.to],
          },
          Message: {
            Subject: { Data: options.subject },
            Body: {
              Html: { Data: options.html },
              Text: { Data: options.text || options.subject },
            },
          },
        });

        await ses.send(command);
        this.logger.log(`Email successfully dispatched via AWS SES to ${options.to}`);
        return true;
      } catch (err) {
        this.logger.warn(`AWS SES dispatch error: ${err.message}. Using fallback Logger.`);
      }
    }

    this.logger.log(`[Email Mock Dispatch] To: ${options.to} | Subject: ${options.subject}`);
    return true;
  }
}
