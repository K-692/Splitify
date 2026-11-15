/**
 * Utility to generate candidate Splitify handles from a user's display name and requested handle.
 * All handles are 3-20 characters, lowercase letters, numbers, and underscores.
 */
export function generateHandleCandidates(
  displayName: string,
  requestedHandle: string
): string[] {
  const cleanRequested = (requestedHandle || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

  const cleanName = (displayName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');

  const parts = cleanName.split(' ').filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const firstInitial = firstName ? firstName[0] : '';
  const lastInitial = lastName ? lastName[0] : '';

  const rawCandidates: string[] = [];

  // 1. Name-based combinations
  if (firstName && firstName !== cleanRequested) {
    rawCandidates.push(firstName);
  }
  if (firstName && lastName) {
    rawCandidates.push(`${firstName}_${lastName}`);
    rawCandidates.push(`${cleanRequested || firstName}_${lastName}`);
    rawCandidates.push(`${firstInitial}_${lastName}`);
    rawCandidates.push(`${firstName}_${lastInitial}`);
  }

  // 2. Requested handle variations
  const base = cleanRequested || firstName || 'user';
  rawCandidates.push(`${base}01`);
  rawCandidates.push(`${base}_01`);
  rawCandidates.push(`${base}1`);
  rawCandidates.push(`${base}_split`);
  rawCandidates.push(`the_${base}`);
  rawCandidates.push(`iam_${base}`);

  // 3. Numbered suffixes (including year/digits)
  const currentYearDigits = new Date().getFullYear().toString().slice(-2);
  rawCandidates.push(`${base}${currentYearDigits}`);
  rawCandidates.push(`${base}_692`);
  rawCandidates.push(`${base}_7`);
  rawCandidates.push(`${base}99`);

  // 4. First name with numbers if base was something else
  if (firstName && firstName !== base) {
    rawCandidates.push(`${firstName}01`);
    rawCandidates.push(`${firstName}_692`);
    rawCandidates.push(`${firstName}_${currentYearDigits}`);
  }

  // Filter and deduplicate
  const seen = new Set<string>();
  const validCandidates: string[] = [];

  for (const cand of rawCandidates) {
    // Truncate if exceeds 20 chars
    const trimmed = cand.slice(0, 20);
    if (
      trimmed.length >= 3 &&
      trimmed.length <= 20 &&
      /^[a-z0-9_]+$/.test(trimmed) &&
      trimmed !== cleanRequested &&
      !seen.has(trimmed)
    ) {
      seen.add(trimmed);
      validCandidates.push(trimmed);
    }
  }

  return validCandidates;
}
