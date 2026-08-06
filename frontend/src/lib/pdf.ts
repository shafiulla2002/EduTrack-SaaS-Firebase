import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type DocumentType =
  | 'report-card'
  | 'invoice'
  | 'receipt'
  | 'marksheet'
  | 'certificate'
  | 'payslip'
  | 'custom';

export interface DocumentPreset {
  paperSize: 'a3' | 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  margin: number;
}

export const PAPER_DIMENSIONS = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  letter: { width: 215.9, height: 279.4 }
};

export const DOCUMENT_PRESETS: Record<DocumentType, DocumentPreset> = {
  'report-card': { paperSize: 'a4', orientation: 'portrait', margin: 12 },
  'invoice': { paperSize: 'a4', orientation: 'portrait', margin: 12 },
  'receipt': { paperSize: 'a4', orientation: 'portrait', margin: 12 },
  'marksheet': { paperSize: 'a4', orientation: 'portrait', margin: 12 },
  'certificate': { paperSize: 'a4', orientation: 'landscape', margin: 16 },
  'payslip': { paperSize: 'a4', orientation: 'portrait', margin: 12 },
  'custom': { paperSize: 'a4', orientation: 'portrait', margin: 12 },
};

export interface ExportPDFOptions {
  element: HTMLElement;
  filename: string;
  documentType?: DocumentType;
  paperSize?: 'a3' | 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  scale?: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

export class PDFService {
  /**
   * Preloads all fonts and image elements inside the target container to ensure complete rendering.
   */
  private static async preloadResources(element: HTMLElement): Promise<void> {
    // 1. Wait for custom web fonts to be ready
    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        await document.fonts.ready;
      } catch (err) {
        console.warn('Font loading failed or timed out:', err);
      }
    }

    // 2. Wait for all nested images to load completely
    const images = Array.from(element.querySelectorAll('img'));
    const imageLoadPromises = images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => {
          console.warn(`Failed to preload image: ${img.src}`);
          resolve(); // Resolve anyway to avoid blocking the PDF process
        };
      });
    });

    await Promise.all(imageLoadPromises);
  }

  /**
   * Generates a direct PDF download from a DOM element using high DPI rendering and A4 slicing.
   */
  static async export(options: ExportPDFOptions): Promise<void> {
    const {
      element,
      filename,
      documentType = 'custom',
      paperSize: overridePaperSize,
      orientation: overrideOrientation,
      margin: overrideMargin,
      scale = 2,
      metadata = {},
    } = options;

    if (!element) {
      throw new Error('PDF Export Error: Element is required.');
    }

    // Resolve document presets
    const preset = DOCUMENT_PRESETS[documentType] || DOCUMENT_PRESETS.custom;
    const paperSize = overridePaperSize || preset.paperSize;
    const orientation = overrideOrientation || preset.orientation;
    const margin = overrideMargin !== undefined ? overrideMargin : preset.margin;

    // Preload image and font assets
    await this.preloadResources(element);

    try {
      // Calculate dynamic dimensions based on paper config
      const dimensions = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;
      const paperWidthMm = orientation === 'portrait' ? dimensions.width : dimensions.height;
      const paperHeightMm = orientation === 'portrait' ? dimensions.height : dimensions.width;

      // Rendering width based on standard 96 DPI
      const renderingWidthPx = Math.round(paperWidthMm * 3.7795);

      // Capture canvas
      const canvas = await html2canvas(element, {
        scale: scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // 1. Force light mode at the document root level of the cloned DOM
          const htmlEl = clonedDoc.documentElement;
          if (htmlEl) {
            htmlEl.classList.remove('dark', 'theme-dark');
            htmlEl.removeAttribute('data-theme');
            htmlEl.style.colorScheme = 'light';
            htmlEl.style.backgroundColor = '#ffffff';
          }
          const bodyEl = clonedDoc.body;
          if (bodyEl) {
            bodyEl.classList.remove('dark', 'theme-dark');
            bodyEl.removeAttribute('data-theme');
            bodyEl.style.backgroundColor = '#ffffff';
          }

          // 2. Clear dark mode class from the cloned target element and all its ancestors
          const clonedElement = clonedDoc.getElementById(element.id) || 
                                (element.id ? clonedDoc.querySelector(`#${element.id}`) : null) ||
                                clonedDoc.querySelector('.pdf-layout-document') ||
                                clonedDoc.querySelector('[id*="-pdf-element"]');

          if (clonedElement) {
            let parentNode: HTMLElement | null = clonedElement as HTMLElement;
            while (parentNode) {
              parentNode.classList.remove('dark', 'theme-dark');
              parentNode.removeAttribute('data-theme');
              parentNode.classList.add('pdf-theme');
              if (parentNode.classList.contains('print-card') || parentNode.classList.contains('fee-receipt-sheet') || parentNode.id === 'invoice-pdf-element' || parentNode.id === 'payslip-pdf-element') {
                parentNode.style.backgroundColor = '#ffffff';
                parentNode.style.color = '#1e293b';
              }
              parentNode = parentNode.parentElement;
            }

            // 3. Strip dark mode and theme-dark classes from all descendants of the target element
            const descendants = clonedElement.querySelectorAll('.dark, .theme-dark, [data-theme="dark"], [class*="dark:"]');
            descendants.forEach((desc) => {
              desc.classList.remove('dark', 'theme-dark');
              desc.removeAttribute('data-theme');
              desc.classList.add('pdf-theme');
            });
          }

          // 4. Force a clean rendering width dynamically based on paper size to ensure consistent DPI ratio
          if (clonedElement) {
            const el = clonedElement as HTMLElement;
            el.style.width = `${renderingWidthPx}px`;
            el.style.maxWidth = 'none';
            el.style.minWidth = `${renderingWidthPx}px`;
            el.style.minHeight = '0px'; // Allow natural layout expansion
          }

          // 5. Hide printing-excluded components in cloned DOM before rasterizing
          const hiddenElements = clonedDoc.querySelectorAll('.print-hidden, .print\\:hidden, button');
          hiddenElements.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: paperSize,
      });

      // Embed PDF metadata
      pdf.setProperties({
        title: metadata.title || filename.replace(/_/g, ' '),
        author: metadata.author || 'EduTrack SaaS Platform',
        subject: metadata.subject || 'Official School Document',
        keywords: metadata.keywords || 'EduTrack, School Report, PDF',
        creator: 'EduTrack PDF Service',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const contentWidth = pdfWidth - (margin * 2);
      let contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      const pageHeightLimit = pdfHeight - (margin * 2);
      
      // Calculate total overflow
      const overflowMm = contentHeight - pageHeightLimit;

      // Smart Scaling Policy: scale down if overflow is <= 10% of the printable page height
      let scaleRatio = 1.0;
      const overflowThreshold = pageHeightLimit * 0.10; // 10% overflow limit

      if (overflowMm > 0 && overflowMm <= overflowThreshold) {
        scaleRatio = pageHeightLimit / contentHeight;
        contentHeight = pageHeightLimit;
      }

      // Development Diagnostics Logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PDF Diagnostics] ---------------------------------`);
        console.log(`[PDF Diagnostics] Document Type: ${documentType}`);
        console.log(`[PDF Diagnostics] Paper Sizing: ${paperSize} (${orientation})`);
        console.log(`[PDF Diagnostics] Page Dimensions: ${paperWidthMm}mm x ${paperHeightMm}mm`);
        console.log(`[PDF Diagnostics] Margin Size: ${margin}mm`);
        console.log(`[PDF Diagnostics] Printable Limit Height: ${pageHeightLimit.toFixed(2)}mm`);
        console.log(`[PDF Diagnostics] Canvas Dimensions: ${canvas.width}px x ${canvas.height}px`);
        console.log(`[PDF Diagnostics] Raw Content Height: ${((canvas.height * contentWidth) / canvas.width).toFixed(2)}mm`);
        console.log(`[PDF Diagnostics] Scaling Ratio Applied: ${scaleRatio.toFixed(3)}`);
        console.log(`[PDF Diagnostics] Adjusted Content Height: ${contentHeight.toFixed(2)}mm`);
        console.log(`[PDF Diagnostics] Page Overflow: ${overflowMm.toFixed(2)}mm (Threshold: ${overflowThreshold.toFixed(2)}mm)`);
        console.log(`[PDF Diagnostics] ---------------------------------`);
      }

      let heightLeft = contentHeight;
      let position = margin;
      let pageCount = 0;

      // Slice the canvas across multiple pages if it exceeds pageHeightLimit
      while (heightLeft > 0.5) { // 0.5mm fudge margin to avoid empty trailing page splits
        if (pageCount > 0) {
          pdf.addPage(paperSize, orientation);
          position = margin - (pageCount * pageHeightLimit);
        }
        
        pdf.addImage(
          imgData,
          'JPEG',
          margin,
          position,
          contentWidth * scaleRatio,
          ((canvas.height * contentWidth) / canvas.width) * scaleRatio,
          undefined,
          'FAST'
        );
        
        heightLeft -= pageHeightLimit;
        pageCount++;
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error('PDF Service Export Error:', err);
      throw err;
    }
  }

  /**
   * Prompts the user with a beautiful, state-remembering instructions dialog before triggering window.print().
   */
  static async print(): Promise<void> {
    const isDismissed = typeof window !== 'undefined' && localStorage.getItem('print_instructions_dismissed') === 'true';

    if (isDismissed) {
      window.print();
      return;
    }

    return new Promise<void>((resolve) => {
      // Create print warning modal dynamically in document.body
      const modal = document.createElement('div');
      modal.id = 'print-instructions-modal';
      modal.style.position = 'fixed';
      modal.style.inset = '0';
      modal.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
      modal.style.backdropFilter = 'blur(4px)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = '999999';
      modal.style.padding = '1rem';
      modal.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      modal.innerHTML = `
        <div style="background-color: white; border-radius: 1.5rem; border: 1px solid #e2e8f0; padding: 1.75rem; max-width: 28rem; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; gap: 1.25rem; box-sizing: border-box; text-align: left;">
          <div style="display: flex; align-items: center; gap: 0.75rem; color: #f59e0b;">
            <svg style="width: 1.5rem; height: 1.5rem; flex-shrink: 0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 style="font-size: 1.125rem; font-weight: 900; color: #1e293b; margin: 0;">Print / PDF Export Info</h3>
          </div>
          <p style="font-size: 0.8125rem; font-weight: 600; color: #475569; line-height: 1.6; margin: 0;">
            For a clean document without browser details (such as the URL, date, and default headers/footers), please make sure to <strong style="color: #0f172a;">uncheck "Headers and Footers"</strong> in the browser's print preview settings.
          </p>
          <div style="display: flex; align-items: center; gap: 0.5rem; padding-top: 0.25rem;">
            <input type="checkbox" id="dont-show-print-instructions" style="width: 1rem; height: 1rem; border-radius: 0.25rem; border: 1px solid #cbd5e1; color: #2563eb; cursor: pointer;" />
            <label for="dont-show-print-instructions" style="font-size: 0.6875rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; user-select: none;">Don't show this instruction again</label>
          </div>
          <button id="btn-proceed-print" style="width: 100%; padding: 0.75rem; background-color: #2e5bff; color: white; font-weight: 700; border-radius: 0.75rem; font-size: 0.75rem; border: none; cursor: pointer; transition: background-color 0.2s; box-shadow: 0 4px 6px -1px rgba(46, 91, 255, 0.1), 0 2px 4px -1px rgba(46, 91, 255, 0.06); text-align: center;">
            Proceed to Print
          </button>
        </div>
      `;

      document.body.appendChild(modal);

      const proceedBtn = modal.querySelector('#btn-proceed-print');
      const checkbox = modal.querySelector('#dont-show-print-instructions') as HTMLInputElement;

      proceedBtn?.addEventListener('mouseenter', () => {
        (proceedBtn as HTMLElement).style.backgroundColor = '#1d4ed8';
      });
      proceedBtn?.addEventListener('mouseleave', () => {
        (proceedBtn as HTMLElement).style.backgroundColor = '#2e5bff';
      });

      proceedBtn?.addEventListener('click', () => {
        if (checkbox?.checked) {
          localStorage.setItem('print_instructions_dismissed', 'true');
        }
        document.body.removeChild(modal);
        window.print();
        resolve();
      });
    });
  }

  static downloadInvoicePDF(invoice: any): void {
    if (typeof window !== 'undefined') {
      const invId = invoice?.id || invoice?.invoiceNumber || 'INV-001';
      window.alert(`Downloading Invoice ${invId} PDF...`);
    }
  }
}
