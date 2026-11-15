import { describe, it, expect } from 'vitest';
import { generatePlainTextExpenseReport } from '@/utils/exportReport';
import { SplitifyEvent, EventItem, ExpenseEntry } from '@/types';

describe('generatePlainTextExpenseReport', () => {
  const mockEvent: SplitifyEvent = {
    id: 'evt-1',
    name: 'Goa Trip 2026',
    emoji: '🏖️',
    currency: 'INR',
    hostUid: 'u1',
    createdAt: 1773000000000,
    updatedAt: 1773000000000,
    members: {
      u1: { uid: 'u1', displayName: 'Krishnendu', joinedAt: 1773000000000, role: 'host' },
      u2: { uid: 'u2', displayName: 'Rahul', joinedAt: 1773000000000, role: 'member' },
    },
  };

  const mockItems: EventItem[] = [
    {
      id: 'item-standalone',
      eventId: 'evt-1',
      name: 'Cab to Airport',
      emoji: '🚕',
      costMinor: 100000, // ₹1,000.00
      paidBy: 'u1',
      splitBy: 'equal',
      participants: ['u1', 'u2'],
      shares: { u1: 50000, u2: 50000 },
      isCategory: false,
      createdAt: 1773000000000,
      updatedAt: 1773000000000,
    },
    {
      id: 'item-category',
      eventId: 'evt-1',
      name: 'Dinner Outing',
      emoji: '🍽️',
      isCategory: true,
      createdAt: 1773000000000,
      updatedAt: 1773000000000,
    },
  ];

  const mockExpenses: ExpenseEntry[] = [
    {
      id: 'sub-1',
      eventId: 'evt-1',
      itemId: 'item-category',
      name: 'Food & Drinks',
      emoji: '🍕',
      costMinor: 200000, // ₹2,000.00
      paidBy: 'u2',
      splitBy: 'equal',
      participants: ['u1', 'u2'],
      shares: { u1: 100000, u2: 100000 },
      createdAt: 1773000000000,
      createdBy: 'u2',
      createdByName: 'Rahul',
      lastModifiedBy: 'u2',
      lastModifiedByName: 'Rahul',
      lastModifiedAt: 1773000000000,
    },
  ];

  it('puts the event invitation link first at the very top of the report', () => {
    const customUrl = 'https://k-692.github.io/Splitify/join/invite-xyz-123';
    const report = generatePlainTextExpenseReport(
      mockEvent,
      mockItems,
      mockExpenses,
      [],
      customUrl,
      new Date('2026-11-15T20:00:00Z')
    );

    const firstLine = report.split('\n')[0];
    expect(firstLine).toBe('🔗 Event Link: https://k-692.github.io/Splitify/join/invite-xyz-123');
  });

  it('correctly aggregates standalone items and category subitems without double counting', () => {
    const report = generatePlainTextExpenseReport(
      mockEvent,
      mockItems,
      mockExpenses,
      [],
      'https://test.com/join/xyz',
      new Date('2026-11-15T20:00:00Z')
    );

    // Total should be ₹1,000 + ₹2,000 = ₹3,000
    expect(report).toContain('Total Event Expense: ₹3,000');
    expect(report).toContain('[Item] 🚕 Cab to Airport: ₹1,000');
    expect(report).toContain('[Category] 🍽️ Dinner Outing — Total: ₹2,000');
    expect(report).toContain('• 🍕 Food & Drinks: ₹2,000');
    expect(report).toContain('• Krishnendu: Paid ₹1,000 | Share: ₹1,500 | Balance: -₹500 (owes)');
    expect(report).toContain('• Rahul: Paid ₹2,000 | Share: ₹1,500 | Balance: +₹500 (gets back)');
    expect(report).toContain('👉 Krishnendu pays Rahul ₹500');
  });

  it('resolves unclaimed expected slots and displays first names without leaking slot IDs', () => {
    const slotId = 'slot_1794760088877_0_27yh';
    const eventWithSlot: SplitifyEvent = {
      ...mockEvent,
      members: {
        u1: { uid: 'u1', displayName: 'Krishnendu Pal', joinedAt: 1773000000000, role: 'host' },
      },
      slots: {
        [slotId]: {
          id: slotId,
          eventId: 'evt-1',
          placeholderName: 'Ayush',
          isClaimed: false,
          createdAt: 1773000000000,
          updatedAt: 1773000000000,
        },
      },
    };

    const itemWithSlot: EventItem[] = [
      {
        id: 'item-curd',
        eventId: 'evt-1',
        name: 'curd',
        emoji: '🥛',
        costMinor: 2000, // ₹20.00
        paidBy: 'u1',
        splitBy: 'equal',
        participants: ['u1', slotId],
        shares: { u1: 1000, [slotId]: 1000 },
        isCategory: false,
        createdAt: 1773000000000,
        updatedAt: 1773000000000,
      },
      {
        id: 'item-demo',
        eventId: 'evt-1',
        name: 'demo',
        emoji: '📌',
        costMinor: 1900, // ₹19.00
        paidBy: 'u1',
        splitBy: 'equal',
        participants: ['u1', slotId],
        shares: { u1: 950, [slotId]: 950 },
        isCategory: false,
        createdAt: 1773000000000,
        updatedAt: 1773000000000,
      },
    ];

    const report = generatePlainTextExpenseReport(
      eventWithSlot,
      itemWithSlot,
      [],
      [],
      'https://k-692.github.io/Splitify/events/BIhPznylXateTWGVcDI8',
      new Date('2026-11-15T21:58:00Z')
    );

    // Verify slot ID is completely masked and replaced with Ayush (Pending)
    expect(report).not.toContain('slot_1794760088877_0_27yh');
    expect(report).toContain('Split with: [Krishnendu, Ayush (Pending)]');
    expect(report).toContain('• Krishnendu: Paid ₹39 | Share: ₹19.50 | Balance: +₹19.50 (gets back)');
    expect(report).toContain('• Ayush (Pending): Paid ₹0 | Share: ₹19.50 | Balance: -₹19.50 (owes)');
    expect(report).toContain('👉 Ayush (Pending) pays Krishnendu ₹19.50');
    // Verify first name Krishnendu is used instead of full name Krishnendu Pal
    expect(report).not.toContain('Krishnendu Pal');
  });
});
