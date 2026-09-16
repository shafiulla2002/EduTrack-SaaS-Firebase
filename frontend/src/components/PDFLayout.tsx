import React from 'react';
import { GraduationCap } from 'lucide-react';
import { DocumentType, DOCUMENT_PRESETS, PAPER_DIMENSIONS } from '@/lib/pdf';
import { formatDateDDMMYYYY } from '@/lib/date';

export interface PDFLayoutMetadataItem {
  label: string;
  value: string;
}

export interface PDFLayoutProps {
  schoolLogo?: string | null;
  schoolName: string;
  schoolSubtitle?: string;
  reportTitle: string;
  metadata?: PDFLayoutMetadataItem[];
  children: React.ReactNode;
  footerText?: string;
  id?: string;
  documentType?: DocumentType;
  paperSize?: 'a3' | 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
}

export const PDFLayout: React.FC<PDFLayoutProps> = ({
  schoolLogo,
  schoolName,
  schoolSubtitle = 'Powered by Covenant Synergy',
  reportTitle,
  metadata = [],
  children,
  footerText,
  id,
  documentType = 'custom',
  paperSize: overridePaperSize,
  orientation: overrideOrientation,
  margin: overrideMargin,
}) => {
  // Resolve configuration from presets or overrides
  const preset = DOCUMENT_PRESETS[documentType] || DOCUMENT_PRESETS.custom;
  const paperSize = overridePaperSize || preset.paperSize;
  const orientation = overrideOrientation || preset.orientation;
  const margin = overrideMargin !== undefined ? overrideMargin : preset.margin;

  // Compute dimensions dynamically
  const dimensions = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.a4;
  const paperHeightMm = orientation === 'portrait' ? dimensions.height : dimensions.width;
  const minHeightMm = paperHeightMm - (margin * 2);

  return (
    <div
      id={id}
      className="pdf-layout-document w-full p-4 sm:p-8 shadow-sm font-sans flex flex-col gap-4 sm:gap-6"
      style={{
        minHeight: `${minHeightMm}mm`,
        boxSizing: 'border-box',
        width: '100%',
        backgroundColor: '#ffffff',
        color: '#1e293b',
        colorScheme: 'light',
      }}
    >
      {/* ── Document Header Block ── */}
      <div className="border-b-4 border-blue-600 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 text-left min-w-0 flex-1">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            {schoolLogo ? (
              <img src={schoolLogo} alt={schoolName} className="w-full h-full object-contain" />
            ) : (
              <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            )}
          </div>
          <div className="text-left min-w-0 flex-1">
            <h1 className="text-sm sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-tight break-words m-0">
              {schoolName}
            </h1>
            {schoolSubtitle && (
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold italic mt-1 leading-tight m-0">
                {schoolSubtitle}
              </p>
            )}
            <h2 className="text-[11px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider mt-1.5 leading-tight m-0">
              {reportTitle}
            </h2>
          </div>
        </div>
        <div className="text-left sm:text-right text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 w-full sm:w-auto">
          <div>Academic Year: 2026–2027</div>
          <div className="mt-1 font-mono font-medium">Date: {formatDateDDMMYYYY(new Date())}</div>
        </div>
      </div>

      {/* ── Metadata Grid Roster Details ── */}
      {metadata.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-left">
          {metadata.map((item, idx) => (
            <div key={idx} style={{ minWidth: 0 }}>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', lineHeight: 1.4 }}>
                {item.label}
              </span>
              <strong style={{ color: '#1e293b', fontWeight: 800, display: 'block', marginTop: '0.25rem', lineHeight: 1.4 }}>
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
        {children}
      </div>

      {/* ── Document Footer Block ── */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.075em', marginTop: 'auto' }}>
        <div style={{ lineHeight: 1.5, maxWidth: '32rem', textAlign: 'left' }}>
          {footerText || `Official document of ${schoolName}. Secure digital payroll and records integration statement.`}
        </div>
        <div style={{ fontFamily: 'monospace', textAlign: 'right', flexShrink: 0 }}>
          Page 1 of 1
        </div>
      </div>
    </div>
  );
};

export default PDFLayout;
