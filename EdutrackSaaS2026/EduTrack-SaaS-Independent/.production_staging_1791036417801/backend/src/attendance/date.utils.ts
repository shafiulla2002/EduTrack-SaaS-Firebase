/**
 * Utility functions for timezone-independent date parsing and formatting
 * in the Attendance module (Backend).
 */

/**
 * Gets today's date formatted as YYYY-MM-DD in Asia/Kolkata (IST) timezone.
 */
export function getTodayDateString(): string {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' } as const;
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value.padStart(2, '0');
  const day = parts.find(p => p.type === 'day')?.value.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date object (stored as UTC midnight in PostgreSQL DATE column)
 * into a YYYY-MM-DD string representation without using toISOString().
 */
export function formatAttendanceDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string (or a Date object) into a UTC midnight Date object
 * for storage in PostgreSQL DATE columns.
 */
export function parseAttendanceDate(dateInput: any): Date {
  if (!dateInput) {
    const todayStr = getTodayDateString();
    const [year, month, day] = todayStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  
  let dateStr: string;
  if (dateInput instanceof Date) {
    dateStr = formatAttendanceDate(dateInput);
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.split('T')[0];
  } else {
    dateStr = String(dateInput).split('T')[0];
  }
  
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Timezone-safe date string comparison.
 * Returns true if dateStr1 is chronologically before dateStr2.
 */
export function isBeforeDateString(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 < dateStr2;
}
