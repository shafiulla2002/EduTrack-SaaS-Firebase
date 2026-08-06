import { Injectable, Logger } from '@nestjs/common';
import { CloudStorageService } from '../common/services/cloud-storage.service';
import { AwsSesService } from '../common/services/aws-ses.service';
import { InvoicePdfService } from '../saas-billing/invoice-pdf.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: CloudStorageService,
    private emailService: AwsSesService,
    private invoicePdfService: InvoicePdfService,
  ) {}

  /**
   * Enqueue background job for Invoice PDF generation, Cloud Storage upload, and Email notification.
   */
  async enqueueInvoiceJobs(invoiceId: string, recipientEmail?: string) {
    this.logger.log(`[Queue] Processing background invoice job for invoice '${invoiceId}'...`);
    setImmediate(async () => {
      try {
        const invoice = await this.prisma.subscriptionInvoice.findUnique({
          where: { id: invoiceId },
        });

        if (!invoice) return;

        // 1. Generate PDF Buffer
        const pdfBuffer = await this.invoicePdfService.generateInvoicePdfBuffer(invoice);

        // 2. Upload to Cloud Storage (AWS S3)
        const filename = `${invoice.invoiceNumber}.pdf`;
        const downloadUrl = await this.storageService.uploadFile(filename, pdfBuffer, 'application/pdf');

        // 3. Update Invoice with download URL
        await this.prisma.subscriptionInvoice.update({
          where: { id: invoiceId },
          data: { downloadUrl, pdfUrl: downloadUrl },
        });

        // 4. Send Email Notification via AWS SES
        if (recipientEmail) {
          await this.emailService.sendEmail({
            to: recipientEmail,
            subject: `Invoice ${invoice.invoiceNumber} - EduTrack Subscription`,
            html: `
              <h2>Thank you for your payment!</h2>
              <p>Your subscription invoice <strong>${invoice.invoiceNumber}</strong> has been generated.</p>
              <p>Total Paid: <strong>INR ${Number(invoice.amount).toFixed(2)}</strong></p>
              <p>You can download your PDF invoice here: <a href="${downloadUrl}">Download Invoice</a></p>
            `,
          });
        }
      } catch (err) {
        this.logger.error(`Background job execution failed for invoice '${invoiceId}': ${err.message}`);
      }
    });
  }
}
