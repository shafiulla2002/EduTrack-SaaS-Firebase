import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  /**
   * Render PDF document buffer for an invoice using frozen snapshot data.
   */
  async generateInvoicePdfBuffer(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const snapshot = invoice.snapshotData || {};
        const companyName = snapshot.companyName || 'EduTrack Inc.';
        const gstNumber = snapshot.gstNumber || 'N/A';
        const calc = snapshot.calculation || {};

        // Header
        doc.fontSize(22).fillColor('#1E293B').text(companyName, { align: 'left' });
        doc.fontSize(10).fillColor('#64748B').text(`GSTIN: ${gstNumber} | Email: ${snapshot.supportEmail || 'support@edutrack.com'}`);
        doc.moveDown(1.5);

        // Divider
        doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#E2E8F0').stroke();
        doc.moveDown(1);

        // Invoice Metadata
        doc.fontSize(16).fillColor('#0F172A').text('TAX INVOICE', { align: 'right' });
        doc.fontSize(10).fillColor('#475569');
        doc.text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'right' });
        doc.text(`Date: ${new Date(invoice.createdDate || Date.now()).toLocaleDateString()}`, { align: 'right' });
        doc.moveDown(1.5);

        // Financial Summary Table
        doc.fontSize(12).fillColor('#0F172A').text('Description', 40, doc.y, { continued: true });
        doc.text('Amount', { align: 'right' });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#334155');
        doc.text('EduTrack SaaS Plan Subscription', 40, doc.y, { continued: true });
        doc.text(`INR ${(Number(invoice.amount) - Number(invoice.gst)).toFixed(2)}`, { align: 'right' });
        doc.moveDown(0.5);

        doc.text('GST (18%)', 40, doc.y, { continued: true });
        doc.text(`INR ${Number(invoice.gst).toFixed(2)}`, { align: 'right' });
        doc.moveDown(1);

        doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#E2E8F0').stroke();
        doc.moveDown(0.8);

        doc.fontSize(13).fillColor('#0F172A').text('Total Paid:', 40, doc.y, { continued: true });
        doc.text(`INR ${Number(invoice.amount).toFixed(2)}`, { align: 'right' });
        doc.moveDown(2);

        // Footer & Bank details
        if (snapshot.bankName) {
          doc.fontSize(10).fillColor('#64748B').text(`Bank Details: ${snapshot.bankName} | A/C: ${snapshot.accountNumber} | IFSC: ${snapshot.ifscCode}`);
        }
        if (snapshot.footer) {
          doc.moveDown(1);
          doc.fontSize(9).fillColor('#94A3B8').text(snapshot.footer, { align: 'center' });
        }

        doc.end();
      } catch (err) {
        this.logger.error(`Error generating PDF for invoice '${invoice.invoiceNumber}': ${err.message}`);
        reject(err);
      }
    });
  }
}
