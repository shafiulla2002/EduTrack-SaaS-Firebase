import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export async function generateInvoicePDF(invoiceData: any, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header
      doc.fillColor('#444444')
         .fontSize(20)
         .text('EduTrack SaaS Invoice', 50, 57)
         .fontSize(10)
         .text(`Invoice Number: ${invoiceData.invoiceNumber}`, 200, 50, { align: 'right' })
         .text(`Date: ${new Date(invoiceData.createdDate).toLocaleDateString()}`, 200, 65, { align: 'right' })
         .text(`Status: ${invoiceData.status}`, 200, 80, { align: 'right' })
         .moveDown();

      // Tenant Details
      doc.fillColor('#000000')
         .text(`Billed To: ${invoiceData.tenantName || invoiceData.tenantId}`, 50, 120)
         .moveDown();

      // Table Header
      const tableTop = 200;
      doc.font('Helvetica-Bold');
      doc.text('Plan', 50, tableTop);
      doc.text('Amount', 400, tableTop, { width: 90, align: 'right' });
      
      // Divider
      doc.moveTo(50, tableTop + 15)
         .lineTo(500, tableTop + 15)
         .stroke();

      // Table Row
      doc.font('Helvetica');
      doc.text(invoiceData.planId || 'Premium', 50, tableTop + 30);
      doc.text(`${invoiceData.currency} ${invoiceData.amount}`, 400, tableTop + 30, { width: 90, align: 'right' });

      // GST and Total
      const subtotalTop = tableTop + 70;
      doc.text(`GST (18%): ${invoiceData.currency} ${invoiceData.gst}`, 350, subtotalTop, { align: 'right' });
      doc.font('Helvetica-Bold');
      doc.text(`Total: ${invoiceData.currency} ${Number(invoiceData.amount) + Number(invoiceData.gst)}`, 350, subtotalTop + 20, { align: 'right' });

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
