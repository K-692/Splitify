import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  toMajorUnits,
  formatCurrency,
  getCurrencySymbol,
} from '../src/utils/currency';

describe('Currency Utility', () => {
  it('should accurately convert between major and minor integer currency units', () => {
    expect(toMinorUnits(1000)).toBe(100000);
    expect(toMinorUnits('1,500.50')).toBe(150050);
    expect(toMinorUnits('0.33')).toBe(33);
    expect(toMinorUnits(0)).toBe(0);

    expect(toMajorUnits(100000)).toBe(1000);
    expect(toMajorUnits(150050)).toBe(1500.5);
  });

  it('should format currency amounts with standard symbols and locale formatting', () => {
    expect(getCurrencySymbol('INR')).toBe('₹');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');

    // ₹1,000.00
    const inr = formatCurrency(100000, 'INR');
    expect(inr).toContain('₹');
    expect(inr).toContain('1,000');

    // Negative amounts
    const neg = formatCurrency(-50000, 'INR');
    expect(neg).toBe('-₹500');

    // Positive with sign
    const pos = formatCurrency(25000, 'INR', { includeSign: true });
    expect(pos).toBe('+₹250');
  });
});
