import { describe, it, expect } from 'vitest';
import { calculateEventFinancialOverview } from '../src/domain/calculations/finance';
import {
  getEntryOccurrence,
  sortEntriesChronologicalDesc,
  getItemOccurrence,
  sortItemsChronologicalDesc,
} from '../src/utils/sorting';
import { EventItem, SettlementEntry, PaymentConfirmation, EventMember } from '../src/types';

describe('Two-Step Settlement Confirmation & Balance Calculation', () => {
  const members: Record<string, EventMember> = {
    u1: { uid: 'u1', displayName: 'Alice', role: 'host', joinedAt: 1000 },
    u2: { uid: 'u2', displayName: 'Bob', role: 'member', joinedAt: 1000 },
  };

  const sampleExpenseItem: EventItem = {
    id: 'item1',
    eventId: 'ev1',
    name: 'Dinner',
    emoji: '🍕',
    isCategory: false,
    costMinor: 10000, // ₹100.00
    paidBy: 'u1',
    shares: {
      u1: 5000,
      u2: 5000,
    },
    participants: ['u1', 'u2'],
    occurredAt: 1700000000000,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  it('unconfirmed payment confirmation has zero impact on authoritative balances', () => {
    // Initial overview without any settlements
    const overviewBefore = calculateEventFinancialOverview(
      members,
      [],
      [],
      'u1',
      [sampleExpenseItem]
    );

    // Bob owes Alice ₹50.00 (5000 paise)
    expect(overviewBefore.memberSummaries['u2'].netBalanceMinor).toBe(-5000);
    expect(overviewBefore.memberSummaries['u1'].netBalanceMinor).toBe(5000);

    // Debtor Bob marks "Paid" -> creates a PaymentConfirmation with status 'awaiting_confirmation'
    const pendingConfirmation: PaymentConfirmation = {
      id: 'conf1',
      eventId: 'ev1',
      debtorUid: 'u2',
      debtorName: 'Bob',
      creditorUid: 'u1',
      creditorName: 'Alice',
      amountMinor: 5000,
      paymentMethod: 'upi',
      paidDate: '2026-11-15',
      paidTime: '20:00',
      occurredAt: 1700000100000,
      status: 'awaiting_confirmation',
      createdAt: 1700000100000,
    };

    expect(pendingConfirmation.status).toBe('awaiting_confirmation');

    // The financial engine only takes completed settlements.
    // An awaiting_confirmation record is NOT in settlements ledger.
    const settlements: SettlementEntry[] = [];
    const overviewAfterDebtorPaid = calculateEventFinancialOverview(
      members,
      [],
      settlements,
      'u1',
      [sampleExpenseItem]
    );

    // MUST remain identical: Bob still owes ₹50.00
    expect(overviewAfterDebtorPaid.memberSummaries['u2'].netBalanceMinor).toBe(-5000);
    expect(overviewAfterDebtorPaid.memberSummaries['u1'].netBalanceMinor).toBe(5000);
    expect(overviewAfterDebtorPaid.settlementSuggestions.length).toBe(1);
    expect(overviewAfterDebtorPaid.settlementSuggestions[0].amountMinor).toBe(5000);
  });

  it('creditor confirming receipt creates completed settlement and balances update to settled', () => {
    // Creditor Alice confirms receipt -> creates completed settlement
    const confirmedSettlement: SettlementEntry = {
      id: 'settle1',
      eventId: 'ev1',
      paymentConfirmationId: 'conf1',
      payerUid: 'u2',
      payerName: 'Bob',
      receiverUid: 'u1',
      receiverName: 'Alice',
      amountMinor: 5000,
      paymentMethod: 'upi',
      paidDate: '2026-11-15',
      paidTime: '20:00',
      occurredAt: 1700000100000,
      status: 'completed',
      createdAt: 1700000150000,
    };

    const overviewAfterConfirmed = calculateEventFinancialOverview(
      members,
      [],
      [confirmedSettlement],
      'u1',
      [sampleExpenseItem]
    );

    // Both are now fully settled
    expect(overviewAfterConfirmed.memberSummaries['u2'].netBalanceMinor).toBe(0);
    expect(overviewAfterConfirmed.memberSummaries['u1'].netBalanceMinor).toBe(0);
    expect(overviewAfterConfirmed.settlementSuggestions.length).toBe(0);
  });

  it('creditor rejecting payment leaves balance as outstanding debt', () => {
    // Creditor Alice rejects the payment -> no settlement is created (or status is rejected)
    const rejectedSettlement: SettlementEntry = {
      id: 'settle_rej',
      eventId: 'ev1',
      paymentConfirmationId: 'conf1',
      payerUid: 'u2',
      payerName: 'Bob',
      receiverUid: 'u1',
      receiverName: 'Alice',
      amountMinor: 5000,
      status: 'rejected' as any,
      createdAt: 1700000150000,
    };

    const overviewAfterRejected = calculateEventFinancialOverview(
      members,
      [],
      [rejectedSettlement], // Non-completed settlement
      'u1',
      [sampleExpenseItem]
    );

    // Net balance remains unadjusted: Bob owes ₹50.00
    expect(overviewAfterRejected.memberSummaries['u2'].netBalanceMinor).toBe(-5000);
    expect(overviewAfterRejected.memberSummaries['u1'].netBalanceMinor).toBe(5000);
  });

  it('supports partial settlements and reduces outstanding balance accurately', () => {
    // Total debt: Bob owes Alice ₹50.00 (5000 paise)
    // Bob pays partial ₹20.00 (2000 paise)
    const partialSettlement: SettlementEntry = {
      id: 'settle_partial',
      eventId: 'ev1',
      payerUid: 'u2',
      payerName: 'Bob',
      receiverUid: 'u1',
      receiverName: 'Alice',
      amountMinor: 2000,
      status: 'completed',
      createdAt: 1700000200000,
    };

    const overviewPartial = calculateEventFinancialOverview(
      members,
      [],
      [partialSettlement],
      'u1',
      [sampleExpenseItem]
    );

    // Remaining debt: ₹50 - ₹20 = ₹30 (3000 paise)
    expect(overviewPartial.memberSummaries['u2'].netBalanceMinor).toBe(-3000);
    expect(overviewPartial.memberSummaries['u1'].netBalanceMinor).toBe(3000);
    expect(overviewPartial.settlementSuggestions.length).toBe(1);
    expect(overviewPartial.settlementSuggestions[0].amountMinor).toBe(3000);
  });
});

describe('Chronological Sorting of Event Entries', () => {
  it('extracts occurrence timestamp from occurredAt, or expenseDate + expenseTime, or fallback to createdAt', () => {
    // 1. Explicit occurredAt
    const entry1 = { occurredAt: 1715000000000, createdAt: 1700000000000 };
    expect(getEntryOccurrence(entry1)).toBe(1715000000000);

    // 2. Date and Time string
    const entry2 = { expenseDate: '2026-11-15', expenseTime: '14:30', createdAt: 1700000000000 };
    const expectedTime = new Date('2026-11-15T14:30').getTime();
    expect(getEntryOccurrence(entry2)).toBe(expectedTime);

    // 3. Fallback to createdAt
    const entry3 = { createdAt: 1705000000000 };
    expect(getEntryOccurrence(entry3)).toBe(1705000000000);
  });

  it('sorts subitems and standalone entries newest first', () => {
    const older = { id: 'old', occurredAt: 1000 };
    const newer = { id: 'new', occurredAt: 2000 };
    const newest = { id: 'newest', occurredAt: 3000 };

    const sorted = sortEntriesChronologicalDesc([older, newest, newer]);
    expect(sorted.map((s) => s.id)).toEqual(['newest', 'new', 'old']);
  });

  it('determines category occurrence by its latest active subitem occurrence', () => {
    const categoryItem: EventItem = {
      id: 'cat1',
      eventId: 'ev1',
      name: 'Trip Activities',
      emoji: '📁',
      isCategory: true,
      createdAt: 1000,
      updatedAt: 1000,
    };

    const subitems = [
      {
        id: 'sub1',
        itemId: 'cat1',
        occurredAt: 2000,
      },
      {
        id: 'sub2',
        itemId: 'cat1',
        occurredAt: 8000, // Newer subitem
      },
    ];

    const occurrence = getItemOccurrence(categoryItem, subitems);
    expect(occurrence).toBe(8000);
  });

  it('sorts items chronologically descending, positioning categories based on latest subitem and keeping settlements item at bottom', () => {
    const standaloneOld: EventItem = {
      id: 'item_old',
      eventId: 'ev1',
      name: 'Early Morning Coffee',
      emoji: '☕',
      isCategory: false,
      occurredAt: 3000,
      createdAt: 3000,
      updatedAt: 3000,
    };

    const categoryItem: EventItem = {
      id: 'cat1',
      eventId: 'ev1',
      name: 'Group Dinner Category',
      emoji: '📁',
      isCategory: true,
      createdAt: 1000, // category created early
      updatedAt: 1000,
    };

    const standaloneNewest: EventItem = {
      id: 'item_newest',
      eventId: 'ev1',
      name: 'Late Night Cab',
      emoji: '🚕',
      isCategory: false,
      occurredAt: 9000,
      createdAt: 9000,
      updatedAt: 9000,
    };

    const settlementsItem: EventItem = {
      id: 'system_settlements',
      eventId: 'ev1',
      name: 'Settlements Ledger',
      emoji: '💸',
      isCategory: false,
      isSettlementsItem: true,
      createdAt: 500,
      updatedAt: 500,
    };

    // Subitem inside category has occurredAt: 6000 (between 3000 and 9000)
    const subitems = [
      {
        id: 'sub1',
        itemId: 'cat1',
        occurredAt: 6000,
      },
    ];

    const sorted = sortItemsChronologicalDesc(
      [settlementsItem, standaloneOld, standaloneNewest, categoryItem],
      subitems
    );

    // Expected order:
    // 1. standaloneNewest (9000)
    // 2. categoryItem (via subitem: 6000)
    // 3. standaloneOld (3000)
    // 4. settlementsItem (always at bottom)
    expect(sorted.map((i) => i.id)).toEqual([
      'item_newest',
      'cat1',
      'item_old',
      'system_settlements',
    ]);
  });
});
