/**
 * Extracts the user's first name from their full display name or username.
 * Examples:
 * - "Krishnendu Pal" -> "Krishnendu"
 * - "Rahul Sharma" -> "Rahul"
 * - "Priya Das" -> "Priya"
 * - "@krish_pal" -> "Krish"
 * - "" / undefined -> "Friend"
 */
export function getFirstName(fullNameOrHandle?: string | null, fallback = 'Member'): string {
  if (!fullNameOrHandle || typeof fullNameOrHandle !== 'string') {
    return fallback;
  }

  const trimmed = fullNameOrHandle.trim();
  if (!trimmed) return fallback;

  // If it's a handle like "@krish_pal" or "@rahul"
  const cleanHandle = trimmed.startsWith('@') ? trimmed.substring(1) : trimmed;

  // Split by whitespace first
  const words = cleanHandle.split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const candidate = words[0];
    // If the candidate contains underscores or dots (common in handles or emails)
    const subSegments = candidate.split(/[_.]+/).filter(Boolean);
    if (subSegments.length > 0 && candidate.includes('_')) {
      const firstSegment = subSegments[0];
      return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
    }
    return candidate;
  }

  return fallback;
}
