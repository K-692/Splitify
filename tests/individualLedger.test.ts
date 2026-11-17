import { describe, it, expect } from 'vitest';
import {
  buildIndividualLedger,
  sumLedger,
  groupLedgerBy,
} from '../src/domain/calculations/individualLedger';
import { calculateEventFinancialOverview } from '../src/domain/calculations/finance';
import { EventItem, ExpenseEntry, EventMember, SettlementEntry, EventSlot } from '../src/types';

const member = (uid: string, name: string): EventMember => ({
  uid,
  displayName: name,
  joinedAt: 0,
  role: 'member',
});

const members: Record<string, EventMember> = {
  a: member('a', 'Asha'),
  b: member('b', 'Bala'),
  c: member('c', 'Chandu'),
};

const slots: Record<string, EventSlot> = {
  slot1: {
    id: 'slot1',
    eventId: 'e',
    placeholderName: 'Dev',
    isClaimed: false,
    createdAt: 0,
    updatedAt: 0,
  },
};

const items: EventItem[] = [
  // Standalone: A paid 900, split equally A/B/C
  {
    id: 'hotel', eventId: 'e', name: 'Hotel', emoji: '🏨', createdAt: 1, updatedAt: 1,
    costMinor: 90000, paidBy: 'a', splitBy: 'equal', participants: ['a', 'b', 'c'],
    shares: { a: 30000, b: 30000, c: 30000 }, occurredAt: 100,
  },
  // Category with subitems
  { id: 'food', eventId: 'e', name: 'Food', emoji: '🍕', isCategory: true, createdAt: 2, updatedAt: 2 },
  // Deleted item must be ignored
  {
    id: 'gone', eventId: 'e', name: 'Gone', emoji: 'x', createdAt: 3, updatedAt: 3, deleted: true,
    costMinor: 5000, paidBy: 'b', shares: { b: 5000 },
  },
];

const expenses: ExpenseEntry[] = [
  {
    id: 'lunch', eventId: 'e', itemId: 'food', name: 'Lunch', emoji: '🥗', costMinor: 60000,
    paidBy: 'b', splitBy: 'amount', participants: ['a', 'b', 'slot1'],
    shares: { a: 10000, b: 20000, slot1: 30000 }, createdBy: 'b', createdByName: 'Bala', createdAt: 5,
    occurredAt: 200,
  },
];

const settlements: SettlementEntry[] = [
  {
    id: 's1', eventId: 'e', payerUid: 'c', payerName: 'Chandu', receiverUid: 'a', receiverName: 'Asha',
    amountMinor: 30000, createdAt: 300, status: 'completed',
  },
  {
    id: 's2', eventId: 'e', payerUid: 'b', payerName: 'Bala', receiverUid: 'a', receiverName: 'Asha',
    amountMinor: 999, createdAt: 301, status: 'reversed',
  },
];

describe('Individual ledger', () => {
  const lines = buildIndividualLedger(items, expenses, settlements, slots);

  it('records payer credit and participant debit per entry', () => {
    const asha = lines.filter((l) => l.personUid === 'a');
    const hotel = asha.find((l) => l.entryId === 'hotel')!;
    expect(hotel.creditMinor).toBe(90000);
    expect(hotel.debitMinor).toBe(30000);

    const lunch = asha.find((l) => l.entryId === 'lunch')!;
    expect(lunch.creditMinor).toBe(0);
    expect(lunch.debitMinor).toBe(10000);
    expect(lunch.groupId).toBe('food');
    expect(lunch.isSubitem).toBe(true);
  });

  it('ignores deleted items and non-completed settlements', () => {
    expect(lines.some((l) => l.entryId === 'gone')).toBe(false);
    expect(lines.some((l) => l.entryId === 's2')).toBe(false);
  });

  it('includes unclaimed slots as their own person', () => {
    const dev = lines.filter((l) => l.personUid === 'slot1');
    expect(sumLedger(dev)).toEqual({ creditMinor: 0, debitMinor: 30000, netMinor: -30000 });
  });

  it('per-person net equals the event financial overview net balance', () => {
    const overview = calculateEventFinancialOverview(members, expenses, settlements, 'a', items, slots);
    const byPerson = groupLedgerBy(lines, 'personUid');
    for (const [uid, summary] of Object.entries(overview.memberSummaries)) {
      const totals = sumLedger(byPerson.get(uid) || []);
      expect(totals.netMinor).toBe(summary.netBalanceMinor);
    }
  });

  it('groups by item and sorts newest first', () => {
    const byGroup = groupLedgerBy(lines, 'groupId');
    expect([...byGroup.keys()].sort()).toEqual(['__settlements__', 'food', 'hotel']);
    expect(lines[0].occurredAt).toBeGreaterThanOrEqual(lines[lines.length - 1].occurredAt);
  });

  it('resolves claimed slots to the claiming member', () => {
    const claimed = { slot1: { ...slots.slot1, isClaimed: true, claimedByUid: 'c' } };
    const l2 = buildIndividualLedger(items, expenses, settlements, claimed);
    expect(l2.some((l) => l.personUid === 'slot1')).toBe(false);
    expect(l2.find((l) => l.personUid === 'c' && l.entryId === 'lunch')!.debitMinor).toBe(30000);
  });
});
