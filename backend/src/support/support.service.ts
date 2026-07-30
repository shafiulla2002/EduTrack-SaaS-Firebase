import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import * as nodemailer from 'nodemailer';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class SupportService {
  private rateLimitCache = new Map<string, RateLimitRecord>();

  constructor(private prisma: PrismaService) {}

  async createSupportRequest(
    dto: CreateSupportRequestDto,
    ipAddress: string,
    userAgent: string,
  ) {
    // 1. Enforce IP Rate Limiting (max 5 requests per IP per hour)
    const ipKey = ipAddress || 'unknown-ip';
    const now = Date.now();
    const limitDuration = 3600 * 1000; // 1 hour
    const record = this.rateLimitCache.get(ipKey);

    if (record) {
      if (now > record.resetTime) {
        this.rateLimitCache.set(ipKey, { count: 1, resetTime: now + limitDuration });
      } else {
        if (record.count >= 5) {
          throw new HttpException(
            'Too many support requests from this IP. Please try again in an hour.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        record.count++;
      }
    } else {
      this.rateLimitCache.set(ipKey, { count: 1, resetTime: now + limitDuration });
    }

    // 2. Save the support request to the database (Never lose user data)
    const supportRequest = await this.prisma.supportRequest.create({
      data: {
        name: dto.name,
        schoolName: dto.schoolName,
        email: dto.email,
        phone: dto.phone,
        subject: dto.subject,
        message: dto.message,
        ipAddress: ipAddress,
        userAgent: userAgent,
        status: 'OPEN',
        emailSent: false,
      },
    });

    let emailSent = false;

    // 3. Attempt to dispatch emails via SMTP
    try {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpSecure = process.env.SMTP_SECURE === 'true';
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const supportEmail = process.env.SUPPORT_EMAIL || 'mr.shafiulla143@gmail.com';

      if (!smtpHost || !smtpUser || !smtpPass) {
        throw new Error('SMTP credentials not configured in environment variables');
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587', 10),
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Email 1: Alert to support desk
      const companyMailOptions = {
        from: smtpUser,
        to: supportEmail,
        subject: `EduTrack Support Request - ${dto.subject}`,
        text: `Name: ${dto.name}
School Name: ${dto.schoolName}
Email: ${dto.email}
Phone: ${dto.phone}
Subject: ${dto.subject}
Message: ${dto.message}

Submitted On: ${supportRequest.createdAt.toISOString()}
`,
      };

      await transporter.sendMail(companyMailOptions);

      // Email 2: Confirmation / Auto-Acknowledgement to submitter
      const userMailOptions = {
        from: smtpUser,
        to: dto.email,
        subject: 'We have received your support request',
        text: `Hello ${dto.name},

Thank you for contacting EduTrack Support.

We have successfully received your support request.

Reference ID:
${supportRequest.id}

Our support team will review your request and contact you as soon as possible.

Regards,
EduTrack Support
`,
      };

      await transporter.sendMail(userMailOptions);

      // 4. Update the DB flag if sending succeeded
      await this.prisma.supportRequest.update({
        where: { id: supportRequest.id },
        data: { emailSent: true },
      });
      emailSent = true;
    } catch (err) {
      console.error('[SupportService] SMTP Email sending failed:', err);
    }

    return {
      success: true,
      emailSent,
      message: emailSent
        ? 'Your support request has been submitted successfully.\n\nOur support team will contact you shortly.'
        : 'Your request has been saved successfully.\n\nOur support team will review it shortly.',
      data: {
        id: supportRequest.id,
        name: supportRequest.name,
        schoolName: supportRequest.schoolName,
        email: supportRequest.email,
        phone: supportRequest.phone,
        subject: supportRequest.subject,
        message: supportRequest.message,
        status: supportRequest.status,
        emailSent,
        createdAt: supportRequest.createdAt,
      },
    };
  }
}
