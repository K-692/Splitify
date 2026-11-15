import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataService } from '@/services/dataService';
import { UserProfile } from '@/types';

// Mock isFirebaseConfigured to false for deterministic local offline unit tests
vi.mock('@/services/firebase/config', () => ({
  db: null,
  auth: null,
  isFirebaseConfigured: () => false,
}));

describe('Entry Creator Ownership, All-Settled Deletion, and Discrepancy Notes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const creatorUser: UserProfile = {
    uid: 'user_krish',
    email: 'krish@example.com',
    displayName: 'Krishnendu Pal',
    username: 'krish',
    createdAt: Date.now(),
  };

  const otherUser: UserProfile = {
    uid: 'user_rahul',
    email: 'rahul@example.com',
    displayName: 'Rahul Sharma',
    username: 'rahul',
    createdAt: Date.now(),
  };

  const thirdUser: UserProfile = {
    uid: 'user_priya',
    email: 'priya@example.com',
    displayName: 'Priya Patel',
    username: 'priya',
    createdAt: Date.now(),
  };

  it('allows only entry creator to edit standalone item, but allows non-creator to delete once all settled', async () => {
    const eventId = await dataService.createEvent('Goa Trip', creatorUser);

    // Creator creates standalone item
    const itemId = await dataService.createExpenseItem(
      {
        eventId,
        name: 'Beach Shack Lunch',
        costMinor: 200000,
        paidBy: creatorUser.uid,
        splitBy: 'equal',
        participants: [creatorUser.uid, otherUser.uid],
      },
      creatorUser,
      { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser }
    );

    // 1. Creator can edit
    await expect(
      dataService.updateExpenseItem(
        eventId,
        itemId,
        { name: 'Beach Shack Seafood Feast' },
        creatorUser,
        { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser }
      )
    ).resolves.not.toThrow();

    // 2. Non-creator cannot edit
    await expect(
      dataService.updateExpenseItem(
        eventId,
        itemId,
        { name: 'Hacked Name' },
        otherUser,
        { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser }
      )
    ).rejects.toThrow('Only the creator can edit this expense item.');

    // 3. Non-creator cannot delete before dues are settled
    await expect(
      dataService.deleteItem(eventId, itemId, otherUser, false)
    ).rejects.toThrow('Only the creator can delete this item until all event dues are settled.');

    // 4. Non-creator CAN delete when all dues are settled (isAllSettled: true)
    await expect(
      dataService.deleteItem(eventId, itemId, otherUser, true)
    ).resolves.not.toThrow();

    const items = await dataService.getItems(eventId);
    const item = items.find((i) => i.id === itemId);
    expect(item).toBeUndefined();
  });

  it('allows only category creator to edit category, but allows any member to delete when all settled', async () => {
    const eventId = await dataService.createEvent('Birthday Party', creatorUser);

    const categoryId = await dataService.createItem(eventId, 'Drinks & Beverages', creatorUser);
    await dataService.convertItemToCategory(eventId, categoryId, creatorUser);

    // 1. Creator can update category name
    await expect(
      dataService.updateItemName(eventId, categoryId, 'Cocktails & Mocktails', '🍹', creatorUser)
    ).resolves.not.toThrow();

    // 2. Non-creator cannot update category name
    await expect(
      dataService.updateItemName(eventId, categoryId, 'Tea & Water', '☕', otherUser)
    ).rejects.toThrow('Only the creator can edit this category.');

    // 3. Non-creator cannot delete category before settlement
    await expect(
      dataService.deleteItem(eventId, categoryId, otherUser, false)
    ).rejects.toThrow('Only the creator can delete this item until all event dues are settled.');

    // 4. Non-creator CAN delete category when isAllSettled: true
    await expect(
      dataService.deleteItem(eventId, categoryId, otherUser, true)
    ).resolves.not.toThrow();
  });

  it('enforces creator ownership on subitems, allowing non-owners to delete only when all settled', async () => {
    const eventId = await dataService.createEvent('Apartment Expenses', creatorUser);

    const categoryId = await dataService.createItem(eventId, 'Groceries', creatorUser);
    await dataService.convertItemToCategory(eventId, categoryId, creatorUser);

    // Other user adds a subitem (they own this subitem!)
    const expenseId = await dataService.createExpense(
      {
        eventId,
        itemId: categoryId,
        name: 'Milk & Bread',
        costMinor: 15000,
        paidBy: otherUser.uid,
        splitBy: 'equal',
        participants: [creatorUser.uid, otherUser.uid],
      },
      otherUser,
      { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser }
    );

    // Other user (the creator of the subitem) can edit
    await expect(
      dataService.updateExpense(
        eventId,
        expenseId,
        { name: 'Organic Milk & Bread' },
        otherUser,
        { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser }
      )
    ).resolves.not.toThrow();

    // Event creator (who is NOT subitem creator) cannot edit this subitem
    await expect(
      dataService.updateExpense(
        eventId,
        expenseId,
        { name: 'Fake Milk' },
        creatorUser,
        { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser }
      )
    ).rejects.toThrow('Only the creator can edit this subitem.');

    // Non-owner cannot delete single expense before settlement
    await expect(
      dataService.deleteExpense(
        eventId,
        expenseId,
        creatorUser,
        { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser },
        false
      )
    ).rejects.toThrow('Only the creator can delete this subitem until all event dues are settled.');

    // Non-owner CAN delete when isAllSettled is true
    await expect(
      dataService.deleteExpense(
        eventId,
        expenseId,
        creatorUser,
        { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser },
        true
      )
    ).resolves.not.toThrow();
  });

  it('restricts settlement deletion to involved parties before settlement, allows any member when all settled', async () => {
    const eventId = await dataService.createEvent('Trip', creatorUser);

    const settlementId1 = await dataService.recordSettlement(
      {
        eventId,
        payerUid: otherUser.uid,
        payerName: otherUser.displayName,
        receiverUid: creatorUser.uid,
        receiverName: creatorUser.displayName,
        amountMinor: 50000,
        note: 'Settling debt',
      },
      otherUser
    );

    // Third user (uninvolved) cannot delete before all settled
    await expect(
      dataService.deleteSettlement(eventId, settlementId1, thirdUser, false)
    ).rejects.toThrow('Only the parties involved can delete this settlement until all event dues are settled.');

    // Involved party CAN delete before all settled
    const settlementId2 = await dataService.recordSettlement(
      {
        eventId,
        payerUid: otherUser.uid,
        payerName: otherUser.displayName,
        receiverUid: creatorUser.uid,
        receiverName: creatorUser.displayName,
        amountMinor: 25000,
        note: 'Settling remainder',
      },
      otherUser
    );

    await expect(
      dataService.deleteSettlement(eventId, settlementId2, creatorUser, false)
    ).resolves.not.toThrow();

    // Third user CAN delete when isAllSettled is true
    const settlementId3 = await dataService.recordSettlement(
      {
        eventId,
        payerUid: otherUser.uid,
        payerName: otherUser.displayName,
        receiverUid: creatorUser.uid,
        receiverName: creatorUser.displayName,
        amountMinor: 10000,
        note: 'Settling last part',
      },
      otherUser
    );

    await expect(
      dataService.deleteSettlement(eventId, settlementId3, thirdUser, true)
    ).resolves.not.toThrow();
  });

  it('allows any member to add discrepancy notes to items, subitems, and settlements', async () => {
    const eventId = await dataService.createEvent('Camping Trip', creatorUser);

    const itemId = await dataService.createExpenseItem(
      {
        eventId,
        name: 'Tent Rental',
        costMinor: 400000,
        paidBy: creatorUser.uid,
        splitBy: 'equal',
        participants: [creatorUser.uid, otherUser.uid],
      },
      creatorUser,
      { [creatorUser.uid]: creatorUser, [otherUser.uid]: otherUser }
    );

    // Other user leaves a discrepancy note on the item
    const note1 = await dataService.addDiscrepancyNote(
      eventId,
      'item',
      itemId,
      'I thought tent rental was covered by coupon, please verify receipt',
      otherUser
    );

    expect(note1.authorUid).toBe(otherUser.uid);
    expect(note1.authorName).toBe('Rahul');
    expect(note1.text).toContain('coupon');

    let items = await dataService.getItems(eventId);
    let item = items.find((i) => i.id === itemId);
    expect(item?.discrepancyNotes?.length).toBe(1);
    expect(item?.discrepancyNotes?.[0].text).toBe(note1.text);

    // Third user also adds a note
    const note2 = await dataService.addDiscrepancyNote(
      eventId,
      'item',
      itemId,
      'Also I was not sharing this tent',
      thirdUser
    );

    items = await dataService.getItems(eventId);
    item = items.find((i) => i.id === itemId);
    expect(item?.discrepancyNotes?.length).toBe(2);

    // Third user cannot delete otherUser's note
    await dataService.deleteDiscrepancyNote(eventId, 'item', itemId, note1.id, thirdUser.uid);
    items = await dataService.getItems(eventId);
    item = items.find((i) => i.id === itemId);
    expect(item?.discrepancyNotes?.length).toBe(2); // Still 2! Not deleted.

    // otherUser deletes their own note
    await dataService.deleteDiscrepancyNote(eventId, 'item', itemId, note1.id, otherUser.uid);
    items = await dataService.getItems(eventId);
    item = items.find((i) => i.id === itemId);
    expect(item?.discrepancyNotes?.length).toBe(1);
    expect(item?.discrepancyNotes?.[0].id).toBe(note2.id);

    // Discrepancy note on a settlement
    const settlementId = await dataService.recordSettlement(
      {
        eventId,
        payerUid: otherUser.uid,
        payerName: otherUser.displayName,
        receiverUid: creatorUser.uid,
        receiverName: creatorUser.displayName,
        amountMinor: 50000,
        note: 'UPI payment',
      },
      otherUser
    );

    const settlementNote = await dataService.addDiscrepancyNote(
      eventId,
      'settlement',
      settlementId,
      'Did not receive confirmation SMS on bank app',
      creatorUser
    );

    expect(settlementNote.authorUid).toBe(creatorUser.uid);
  });
});
