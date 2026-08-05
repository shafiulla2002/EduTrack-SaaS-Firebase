/**
 * Centralized utility functions for timezone-independent date parsing and formatting
 * standardized to DD/MM/YYYY across all devices, operating systems, and browsers.
 */

/**
 * Formats a Date object in the client's local timezone to a YYYY-MM-DD string
 * without using toISOString().
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts any date representation (string, Date, or ISO string)
 * to a local timezone YYYY-MM-DD string timezone-safely without shifting hours.
 */
export function toLocalDateString(dateInput?: any): string {
  if (!dateInput) return formatLocalDate(new Date());
  
  if (dateInput instanceof Date) {
    return formatLocalDate(dateInput);
  }
  
  const str = typeof dateInput === 'string' ? dateInput : String(dateInput);
  // Match the date part directly to avoid browser timezone shift if it's an ISO timestamp
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) return '';
  return formatLocalDate(parsed);
}

/**
 * Formats any date input (YYYY-MM-DD, Date object, ISO timestamp) strictly as DD/MM/YYYY
 * Example: 05/08/2026 for August 5, 2026.
 * Independent of OS locale, device, or browser defaults.
 */
export function formatDateDDMMYYYY(dateInput: any): string {
  if (!dateInput) return '';
  const dateStr = toLocalDateString(dateInput);
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return '';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/**
 * Alias for formatDateDDMMYYYY to ensure backward compatibility and application-wide standard.
 */
export function formatDisplayDate(dateInput: any): string {
  return formatDateDDMMYYYY(dateInput);
}

/**
 * Formats date and time as DD/MM/YYYY, HH:MM AM/PM
 * Example: 05/08/2026, 09:30 AM
 */
export function formatDateTimeDDMMYYYY(dateInput: any): string {
  if (!dateInput) return '';
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(dateObj.getTime())) return formatDateDDMMYYYY(dateInput);
  
  const ddmmyyyy = formatDateDDMMYYYY(dateObj);
  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${ddmmyyyy}, ${hoursStr}:${minutes} ${ampm}`;
}

/**
 * Timezone-safe comparison of date strings (YYYY-MM-DD).
 * Returns true if dateStr1 is chronologically before dateStr2.
 */
export function isBefore(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 < dateStr2;
}
