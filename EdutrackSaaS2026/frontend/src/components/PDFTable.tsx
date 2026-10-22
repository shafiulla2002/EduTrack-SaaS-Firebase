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
    <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden', breakInside: 'avoid' }}>
      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#ebf8ff', color: '#1a365d', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '0.625rem 1rem',
                  fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                  width: col.width,
                  textAlign: (col.align || 'left') as 'left' | 'center' | 'right',
                  color: '#1a365d',
                  backgroundColor: '#ebf8ff',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ backgroundColor: '#ffffff' }}>
          {items.map((item, rowIdx) => (
            <tr key={rowIdx} style={{ borderTop: '1px solid #f1f5f9', breakInside: 'avoid' }}>
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  style={{
                    padding: '0.75rem 1rem',
                    color: '#334155',
                    fontWeight: 500,
                    verticalAlign: 'middle',
                    textAlign: (col.align || 'left') as 'left' | 'center' | 'right',
                    backgroundColor: '#ffffff',
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
