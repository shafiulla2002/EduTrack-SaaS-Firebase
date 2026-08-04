import React from 'react';

export interface PDFTableColumn<T> {
  header: string;
  render: (item: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface PDFTableProps<T> {
  items: T[];
  columns: PDFTableColumn<T>[];
  footer?: React.ReactNode;
}

export function PDFTable<T>({ items, columns, footer }: PDFTableProps<T>) {
  return (
    <div className="pdf-table-container w-full border border-slate-200 rounded-xl overflow-hidden break-inside-avoid">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#ebf8ff] text-[#1a365d] text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 print:bg-[#ebf8ff] print:text-[#1a365d]">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="px-4 py-2.5 font-bold uppercase tracking-wider"
                style={{
                  width: col.width,
                  textAlign: col.align || 'left',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-slate-50/50 break-inside-avoid">
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className="px-4 py-3 text-slate-700 font-medium align-middle"
                  style={{
                    textAlign: col.align || 'left',
                  }}
                >
                  {col.render(item, rowIdx)}
                </td>
              ))}
            </tr>
          ))}
          {footer}
        </tbody>
      </table>
    </div>
  );
}

export default PDFTable;
