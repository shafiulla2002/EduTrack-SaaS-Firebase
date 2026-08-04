import React from 'react';
import { GraduationCap } from 'lucide-react';
import { DocumentType, DOCUMENT_PRESETS, PAPER_DIMENSIONS } from '@/lib/pdf';

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
      className="pdf-layout-document w-full bg-white text-slate-800 p-8 shadow-sm font-sans flex flex-col gap-6"
      style={{
        minHeight: `${minHeightMm}mm`,
        boxSizing: 'border-box',
        width: '100%',
        backgroundColor: '#ffffff',
        color: '#1e293b',
      }}
    >
      {/* ── Document Header Block ── */}
      <div className="flex items-center justify-between border-b-4 border-blue-600 pb-4">
        <div className="flex items-center gap-4 text-left">
          <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            {schoolLogo ? (
              <img src={schoolLogo} alt={schoolName} className="w-full h-full object-contain" />
            ) : (
              <GraduationCap className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
              {schoolName}
            </h1>
            {schoolSubtitle && (
              <p className="text-[11px] text-slate-500 font-semibold italic mt-1.5 leading-none">
                {schoolSubtitle}
              </p>
            )}
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider mt-2.5 leading-none">
              {reportTitle}
            </h2>
          </div>
        </div>
        <div className="text-right text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <div>Academic Year: 2026–2027</div>
          <div className="mt-1 font-mono font-medium">Date: {new Date().toLocaleDateString('en-IN')}</div>
        </div>
      </div>

      {/* ── Metadata Grid Roster Details ── */}
      {metadata.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-left">
          {metadata.map((item, idx) => (
            <div key={idx} className="min-w-0">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block leading-none">
                {item.label}
              </span>
              <strong className="text-slate-800 font-extrabold block mt-1 truncate">
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col gap-4 text-left">
        {children}
      </div>

      {/* ── Document Footer Block ── */}
      <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-auto">
        <div className="leading-normal max-w-lg text-left">
          {footerText || `Official document of ${schoolName}. Secure digital payroll and records integration statement.`}
        </div>
        <div className="font-mono text-right shrink-0">
          Page 1 of 1
        </div>
      </div>
    </div>
  );
};

export default PDFLayout;
