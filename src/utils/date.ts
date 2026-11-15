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
