import { describe, it, expect } from 'vitest';
import { searchHome } from '../src/domain/search/homeSearch';
import { SplitifyEvent, EventItem, ExpenseEntry } from '../src/types';

const ev = (id: string, name: string, hidden = false, updatedAt = 0): SplitifyEvent => ({
  id, name, emoji: '🏖️', currency: 'INR', hostUid: 'u',
  members: { u: { uid: 'u', displayName: 'Krish', joinedAt: 0, role: 'host', hidden }, r: { uid: 'r', displayName: 'Rahul', joinedAt: 0, role: 'member' } },
  createdAt: 0, updatedAt,
});
const item = (id: string, name: string, extra: Partial<EventItem> = {}): EventItem => ({
  id, eventId: 'e', name, emoji: '📌', createdAt: 1, updatedAt: 1, costMinor: 1000, paidBy: 'u', ...extra,
});
const sub = (id: string, itemId: string, name: string, extra: Partial<ExpenseEntry> = {}): ExpenseEntry => ({
  id, eventId: 'e', itemId, name, emoji: '🥛', costMinor: 4200, paidBy: 'r', splitBy: 'equal',
  participants: ['u', 'r'], shares: {}, createdBy: 'r', createdByName: 'Rahul', createdAt: 2, ...extra,
});

const goa = ev('goa', 'Goa Trip', false, 10);
const flat = ev('flat', 'Flat Rent', true, 5);
const data = {
  goa: { items: [item('dinner', 'Beach Dinner', { comment: 'curd rice' }), item('insta', 'Instamart', { isCategory: true, costMinor: undefined })], expenses: [sub('curd', 'insta', 'Curd'), sub('gone', 'insta', 'Curd old', { deleted: true })] },
  flat: { items: [item('rent', 'Rent November'), item('st', 'Settlements', { isSettlementsItem: true })], expenses: [] },
};
const nameOf = (e: SplitifyEvent, uid: string) => e.members[uid]?.displayName || uid;

describe('Home search', () => {
  it('returns nothing for an empty query', () => {
    expect(searchHome('  ', [goa, flat], data, 'u', nameOf)).toEqual({ events: [], items: [] });
  });

  it('finds sub-items with their category and event, skipping deleted ones', () => {
    const r = searchHome('curd', [goa, flat], data, 'u', nameOf);
    expect(r.items.map((i) => [i.name, i.categoryName, i.matchedOn])).toEqual([
      ['Curd', 'Instamart', 'name'],
      ['Beach Dinner', undefined, 'comment'],
    ]);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ itemMatches: 2, hidden: false });
  });

  it('includes hidden events and their items, flagged as hidden', () => {
    const r = searchHome('rent', [goa, flat], data, 'u', nameOf);
    expect(r.events.map((e) => [e.event.id, e.hidden])).toEqual([['flat', true]]);
    expect(r.items[0]).toMatchObject({ name: 'Rent November', hidden: true });
  });

  it('matches event names and requires every word', () => {
    expect(searchHome('goa trip', [goa, flat], data, 'u', nameOf).events.map((e) => e.event.id)).toEqual(['goa']);
    expect(searchHome('goa rent', [goa, flat], data, 'u', nameOf).events).toHaveLength(0);
  });

  it('matches by payer name and finds categories', () => {
    const byPayer = searchHome('rahul', [goa], data, 'u', nameOf);
    expect(byPayer.items.map((i) => i.matchedOn)).toEqual(['payer']);
    const byCat = searchHome('instamart', [goa], data, 'u', nameOf);
    expect(byCat.items[0]).toMatchObject({ name: 'Curd', matchedOn: 'category' });
  });

  it('never returns the system Settlements item', () => {
    expect(searchHome('settlements', [flat], data, 'u', nameOf).items).toHaveLength(0);
  });
});
