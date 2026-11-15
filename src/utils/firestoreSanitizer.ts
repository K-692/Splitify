/**
 * Recursively removes any object properties that have `undefined` values.
 * Firestore rejects documents containing `undefined` with:
 * "Function addDoc() called with invalid data. Unsupported field value: undefined"
 *
 * This utility preserves valid `null`, `false`, `0`, `""`, Date objects, and arrays.
 * It removes keys whose value is strictly `undefined`.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Preserve primitive types and Dates
  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) {
    return data;
  }

  // If array, recursively sanitize elements (dropping undefined elements if any)
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  // If plain object / map
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeForFirestore(value);
    }
  }

  return cleaned as T;
}
