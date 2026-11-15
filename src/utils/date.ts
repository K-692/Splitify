/**
 * Formats a timestamp into the exact required format:
 * "HH:MM AM/PM DD:MM:YYYY" (e.g. "09:30 PM 15:11:2026")
 */
export function formatAuditTimestamp(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour should be 12
  
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  const strMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  
  const day = date.getDate();
  const month = date.getMonth() + 1; // 1-indexed
  const year = date.getFullYear();
  
  const strDay = day < 10 ? `0${day}` : `${day}`;
  const strMonth = month < 10 ? `0${month}` : `${month}`;
  
  return `${strHours}:${strMinutes} ${ampm} ${strDay}:${strMonth}:${year}`;
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatAuditTimestamp(timestamp);
}

/**
 * Returns today's date in local calendar date format: "YYYY-MM-DD"
 * Avoids any timezone shift bugs.
 */
export function getTodayLocalDateString(refDate: Date = new Date()): string {
  const year = refDate.getFullYear();
  const month = String(refDate.getMonth() + 1).padStart(2, '0');
  const day = String(refDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates whether a string matches "YYYY-MM-DD" format.
 */
export function isValidDateString(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return year >= 1970 && year <= 2100;
}

/**
 * Formats a "YYYY-MM-DD" calendar date string into a user-friendly format:
 * e.g. "2026-11-15" -> "15 Nov 2026"
 * Parses purely by parts to prevent timezone offsets.
 */
export function formatDisplayExpenseDate(dateStr?: string | null): string {
  if (!dateStr || !isValidDateString(dateStr)) {
    return 'Recent';
  }

  const [y, m, d] = dateStr.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthName = months[parseInt(m, 10) - 1] || m;
  const dayNum = parseInt(d, 10);

  return `${dayNum} ${monthName} ${y}`;
}

