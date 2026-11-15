import { describe, it, expect } from 'vitest';
import { formatAuditTimestamp } from '../src/utils/date';

describe('Audit Timestamp Formatting', () => {
  it('should format timestamps into exact required format "HH:MM AM or PM DD:MM:YYYY"', () => {
    // 15 Nov 2026, 21:30 (09:30 PM)
    const testDate = new Date(2026, 10, 15, 21, 30, 0); // month 10 is Nov
    const formatted = formatAuditTimestamp(testDate);
    expect(formatted).toBe('09:30 PM 15:11:2026');

    // 05 Jan 2026, 09:05 (09:05 AM)
    const testDate2 = new Date(2026, 0, 5, 9, 5, 0);
    const formatted2 = formatAuditTimestamp(testDate2);
    expect(formatted2).toBe('09:05 AM 05:01:2026');
  });
});
