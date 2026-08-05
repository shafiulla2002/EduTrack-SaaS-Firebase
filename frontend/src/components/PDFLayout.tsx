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
      className="pdf-layout-document w-full p-8 shadow-sm font-sans flex flex-col gap-6"
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
      <div style={{ borderBottom: '4px solid #2563eb', paddingBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
          <div style={{ width: '4rem', height: '4rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {schoolLogo ? (
              <img src={schoolLogo} alt={schoolName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <GraduationCap style={{ width: '2rem', height: '2rem', color: '#2563eb' }} />
            )}
          </div>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.025em', lineHeight: 1.2, margin: 0 }}>
              {schoolName}
            </h1>
            {schoolSubtitle && (
              <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, fontStyle: 'italic', marginTop: '0.375rem', lineHeight: 1.3, marginBottom: 0 }}>
                {schoolSubtitle}
              </p>
            )}
            <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.075em', marginTop: '0.625rem', lineHeight: 1.2, marginBottom: 0 }}>
              {reportTitle}
            </h2>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.075em' }}>
          <div>Academic Year: 2026–2027</div>
          <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontWeight: 500 }}>Date: {formatDateDDMMYYYY(new Date())}</div>
        </div>
      </div>

      {/* ── Metadata Grid Roster Details ── */}
      {metadata.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1rem', fontSize: '0.75rem', textAlign: 'left' }}>
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
