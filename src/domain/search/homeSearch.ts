import { SplitifyEvent, EventItem, ExpenseEntry } from '@/types';

export interface EventSearchData {
  items: EventItem[];
  expenses: ExpenseEntry[];
}

export interface EventMatch {
  event: SplitifyEvent;
  hidden: boolean;
  /** Number of items inside this event that also match */
  itemMatches: number;
}

export interface ItemMatch {
  key: string;
  event: SplitifyEvent;
  hidden: boolean;
  itemId: string;
  name: string;
  emoji: string;
  categoryName?: string;
  costMinor: number;
  paidBy?: string;
  occurredAt: number;
  /** Which field matched, for display ("Name", "Category", "Note", "Paid by") */
  matchedOn: 'name' | 'category' | 'comment' | 'payer';
}

export interface HomeSearchResult {
  events: EventMatch[];
  items: ItemMatch[];
}

const norm = (s?: string) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();

/** Every query word must appear somewhere in the text. */
const matches = (text: string | undefined, words: string[]) => {
  const t = norm(text);
  return t.length > 0 && words.every((w) => t.includes(w));
};

/**
 * Searches event names and every expense inside the user's events
 * (standalone items, category names and sub-items), including events the
 * user has hidden. Results are ordered: exact/prefix name hits first, then
 * most recent.
 */
export function searchHome(
  query: string,
  events: SplitifyEvent[],
  dataByEvent: Record<string, EventSearchData | undefined>,
  currentUid: string,
  getPersonName: (event: SplitifyEvent, uid: string) => string,
  itemLimit = 50
): HomeSearchResult {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return { events: [], items: [] };
  const q = words.join(' ');

  const items: ItemMatch[] = [];
  const eventMatches: EventMatch[] = [];

  for (const ev of events) {
    const hidden = Boolean(ev.members?.[currentUid]?.hidden);
    const data = dataByEvent[ev.id];
    let countInEvent = 0;

    if (data) {
      const activeItems = data.items.filter((i) => !i.deleted && !i.isSettlementsItem);
      const categories = new Map(activeItems.filter((i) => i.isCategory).map((i) => [i.id, i]));

      const consider = (
        id: string,
        itemId: string,
        name: string,
        emoji: string,
        costMinor: number,
        occurredAt: number,
        paidBy?: string,
        comment?: string,
        categoryName?: string
      ) => {
        let matchedOn: ItemMatch['matchedOn'] | null = null;
        if (matches(name, words)) matchedOn = 'name';
        else if (categoryName && matches(categoryName, words)) matchedOn = 'category';
        else if (matches(comment, words)) matchedOn = 'comment';
        else if (paidBy && matches(getPersonName(ev, paidBy), words)) matchedOn = 'payer';
        if (!matchedOn) return;
        countInEvent += 1;
        items.push({ key: `${ev.id}:${id}`, event: ev, hidden, itemId, name, emoji, categoryName, costMinor, paidBy, occurredAt, matchedOn });
      };

      for (const it of activeItems) {
        if (it.isCategory) {
          // A category with no sub-items is still findable by its own name
          const hasSubs = data.expenses.some((e) => !e.deleted && e.itemId === it.id);
          if (!hasSubs && matches(it.name, words)) {
            consider(it.id, it.id, it.name, it.emoji || '📁', 0, it.createdAt || 0);
          }
          continue;
        }
        consider(it.id, it.id, it.name, it.emoji || '📌', it.costMinor || 0, it.occurredAt || it.createdAt || 0, it.paidBy, it.comment);
      }
      for (const ex of data.expenses) {
        if (ex.deleted) continue;
        const cat = categories.get(ex.itemId);
        if (!cat) continue;
        consider(ex.id, cat.id, ex.name, ex.emoji || cat.emoji || '📌', ex.costMinor || 0, ex.occurredAt || ex.createdAt || 0, ex.paidBy, ex.comment, cat.name);
      }
    }

    if (matches(ev.name, words) || countInEvent > 0) {
      eventMatches.push({ event: ev, hidden, itemMatches: countInEvent });
    }
  }

  const nameRank = (name: string) => {
    const n = norm(name);
    return n === q ? 0 : n.startsWith(q) ? 1 : 2;
  };
  eventMatches.sort(
    (a, b) =>
      Number(!matches(a.event.name, words)) - Number(!matches(b.event.name, words)) ||
      nameRank(a.event.name) - nameRank(b.event.name) ||
      Number(a.hidden) - Number(b.hidden) ||
      (b.event.updatedAt || 0) - (a.event.updatedAt || 0)
  );
  const fieldRank = { name: 0, category: 1, comment: 2, payer: 3 } as const;
  items.sort(
    (a, b) =>
      fieldRank[a.matchedOn] - fieldRank[b.matchedOn] ||
      nameRank(a.name) - nameRank(b.name) ||
      b.occurredAt - a.occurredAt
  );

  return { events: eventMatches, items: items.slice(0, itemLimit) };
}
