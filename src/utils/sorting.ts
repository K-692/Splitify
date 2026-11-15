/**
 * Utility for chronological sorting of all Splitify event entries:
 * - Standalone expense items
 * - Category subitems
 * - Categories (ordered by their most recent active subitem occurrence)
 * - Settlements & Payment Confirmations
 */

export function getEntryOccurrence(entry: {
  occurredAt?: number;
  expenseDate?: string;
  expenseTime?: string;
  createdAt?: number;
}): number {
  if (typeof entry.occurredAt === 'number' && !isNaN(entry.occurredAt) && entry.occurredAt > 0) {
    return entry.occurredAt;
  }
  if (entry.expenseDate) {
    const time = entry.expenseTime || '12:00';
    const parsed = new Date(`${entry.expenseDate}T${time}`).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return typeof entry.createdAt === 'number' && !isNaN(entry.createdAt) ? entry.createdAt : 0;
}

export function sortEntriesChronologicalDesc<
  T extends {
    id?: string;
    occurredAt?: number;
    expenseDate?: string;
    expenseTime?: string;
    createdAt?: number;
  }
>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const timeA = getEntryOccurrence(a);
    const timeB = getEntryOccurrence(b);
    if (timeB !== timeA) return timeB - timeA;
    const createdA = typeof a.createdAt === 'number' ? a.createdAt : 0;
    const createdB = typeof b.createdAt === 'number' ? b.createdAt : 0;
    if (createdB !== createdA) return createdB - createdA;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

export function getItemOccurrence(
  item: {
    id: string;
    isCategory?: boolean;
    occurredAt?: number;
    expenseDate?: string;
    expenseTime?: string;
    createdAt?: number;
  },
  subitems: Array<{
    itemId: string;
    occurredAt?: number;
    expenseDate?: string;
    expenseTime?: string;
    createdAt?: number;
    deleted?: boolean;
  }>
): number {
  if (item.isCategory) {
    const subs = subitems.filter((s) => s.itemId === item.id && !s.deleted);
    if (subs.length > 0) {
      return Math.max(...subs.map(getEntryOccurrence));
    }
  }
  return getEntryOccurrence(item);
}

export function sortItemsChronologicalDesc<
  T extends {
    id: string;
    isCategory?: boolean;
    isSettlementsItem?: boolean;
    occurredAt?: number;
    expenseDate?: string;
    expenseTime?: string;
    createdAt?: number;
  }
>(
  items: T[],
  subitems: Array<{
    itemId: string;
    occurredAt?: number;
    expenseDate?: string;
    expenseTime?: string;
    createdAt?: number;
    deleted?: boolean;
  }>
): T[] {
  return [...items].sort((a, b) => {
    // Keep system settlements item at the bottom of the expense items list
    if (a.isSettlementsItem && !b.isSettlementsItem) return 1;
    if (!a.isSettlementsItem && b.isSettlementsItem) return -1;

    const timeA = getItemOccurrence(a, subitems);
    const timeB = getItemOccurrence(b, subitems);
    if (timeB !== timeA) return timeB - timeA;
    const createdA = typeof a.createdAt === 'number' ? a.createdAt : 0;
    const createdB = typeof b.createdAt === 'number' ? b.createdAt : 0;
    if (createdB !== createdA) return createdB - createdA;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}
