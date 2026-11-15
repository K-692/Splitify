export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'AU$',
  JPY: '¥',
  AED: 'AED ',
  SGD: 'SG$',
};

export function getCurrencySymbol(currencyCode: string = 'INR'): string {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || '₹';
}

/**
 * Converts a major unit amount (e.g. 1000.50) into an integer minor unit (100050 paise/cents)
 */
export function toMinorUnits(majorAmount: number | string): number {
  if (typeof majorAmount === 'string') {
    const cleaned = majorAmount.replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }
  if (isNaN(majorAmount)) return 0;
  return Math.round(majorAmount * 100);
}

/**
 * Converts minor unit integer (100050) to major unit float (1000.50)
 */
export function toMajorUnits(minorAmount: number): number {
  return (minorAmount || 0) / 100;
}

/**
 * Formats minor currency integer into a localized string, e.g. "₹1,000" or "₹1,000.50"
 */
export function formatCurrency(
  minorAmount: number,
  currencyCode: string = 'INR',
  options?: { showDecimals?: boolean; includeSign?: boolean }
): string {
  const symbol = getCurrencySymbol(currencyCode);
  const major = Math.abs((minorAmount || 0) / 100);
  
  const hasDecimals = minorAmount % 100 !== 0;
  const decimals = options?.showDecimals ?? hasDecimals ? 2 : 0;

  // Format with standard locale string
  const formattedNumber = major.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });

  const sign = minorAmount < 0 ? '-' : options?.includeSign && minorAmount > 0 ? '+' : '';
  return `${sign}${symbol}${formattedNumber}`;
}
