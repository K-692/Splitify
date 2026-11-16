import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataService } from '@/services/dataService';
import { UserProfile, AppNotification } from '@/types';

// Mock isFirebaseConfigured to false for deterministic local offline unit tests
vi.mock('@/services/firebase/config', () => ({
  db: null,
  auth: null,
  isFirebaseConfigured: () => false,
}));

describe('Universal Item Modification, Deletion, Alert Notifications, and 30-Day Auto-Purge', () => {
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

  it('allows any member to edit and delete standalone items, and notifies other members with handle', async () => {
    const eventId = await dataService.createEvent('Goa Trip', creatorUser);
    const members = {
      [creatorUser.uid]: creatorUser,
      [otherUser.uid]: otherUser,
      [thirdUser.uid]: thirdUser,
    };

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
      members
    );

    // Any other member (Rahul) can update the item
    await expect(
      dataService.updateExpenseItem(
        eventId,
        itemId,
        { name: 'Beach Shack Seafood Feast' },
        otherUser,
        members
      )
    ).resolves.not.toThrow();

    // Verify notifications were sent to creator and thirdUser with @rahul handle
    let rahulNotifs: AppNotification[] = [];
    dataService.subscribeNotifications(creatorUser.uid, (n) => {
      rahulNotifs = n;
    })();
    expect(rahulNotifs.length).toBeGreaterThan(0);
    expect(rahulNotifs[0].senderName).toBe('@rahul');
    expect(rahulNotifs[0].description).toContain('@rahul modified');

    // Any other member (Priya) can delete the item
    await expect(
      dataService.deleteItem(eventId, itemId, thirdUser, members)
    ).resolves.not.toThrow();

    // Verify deletion notification sent with @priya handle
    let priyaNotifs: AppNotification[] = [];
    dataService.subscribeNotifications(otherUser.uid, (n) => {
      priyaNotifs = n;
    })();
    expect(priyaNotifs.length).toBeGreaterThan(0);
    expect(priyaNotifs[0].senderName).toBe('@priya');
    expect(priyaNotifs[0].description).toContain('@priya deleted');
  });

  it('allows any member to convert items, edit categories, and delete categories', async () => {
    const eventId = await dataService.createEvent('Birthday Party', creatorUser);
    const members = {
      [creatorUser.uid]: creatorUser,
      [otherUser.uid]: otherUser,
    };

    const categoryId = await dataService.createItem(eventId, 'Beverages', creatorUser);

    // Other user converts to category
    await expect(
      dataService.convertItemToCategory(eventId, categoryId, otherUser, members)
    ).resolves.not.toThrow();

    // Other user renames category
    await expect(
      dataService.updateItemName(eventId, categoryId, 'Drinks and Mocktails', '🍹', otherUser, members)
    ).resolves.not.toThrow();

    // Other user creates subitem
    const subitemId = await dataService.createExpense(
      {
        eventId,
        itemId: categoryId,
        name: 'Fruit Punch',
        costMinor: 50000,
        paidBy: otherUser.uid,
        splitBy: 'equal',
        participants: [creatorUser.uid, otherUser.uid],
      },
      otherUser,
      members
    );

    // Creator edits other user subitem
    await expect(
      dataService.updateExpense(
        eventId,
        subitemId,
        { name: 'Special Mango Punch' },
        creatorUser,
        members
      )
    ).resolves.not.toThrow();

    // Creator deletes subitem
    await expect(
      dataService.deleteExpense(eventId, subitemId, creatorUser, members)
    ).resolves.not.toThrow();
  });

  it('allows bulk deleting all event items and subitems, notifying event members', async () => {
    const eventId = await dataService.createEvent('Road Trip', creatorUser);
    const members = {
      [creatorUser.uid]: creatorUser,
      [otherUser.uid]: otherUser,
    };

    const item1 = await dataService.createExpenseItem(
      {
        eventId,
        name: 'Fuel',
        costMinor: 300000,
        paidBy: creatorUser.uid,
        splitBy: 'equal',
        participants: [creatorUser.uid, otherUser.uid],
      },
      creatorUser,
      members
    );

    const cat1 = await dataService.createItem(eventId, 'Snacks', creatorUser);
    await dataService.convertItemToCategory(eventId, cat1, creatorUser);
    const sub1 = await dataService.createExpense(
      {
        eventId,
        itemId: cat1,
        name: 'Chips',
        costMinor: 20000,
        paidBy: creatorUser.uid,
        splitBy: 'equal',
        participants: [creatorUser.uid, otherUser.uid],
      },
      creatorUser,
      members
    );

    // Bulk delete all items by other user
    await expect(
      dataService.bulkDeleteEventItems(
        eventId,
        [item1, cat1],
        [sub1],
        otherUser,
        members,
        'Road Trip'
      )
    ).resolves.not.toThrow();

    // Verify notification was sent to creatorUser
    let notifs: AppNotification[] = [];
    dataService.subscribeNotifications(creatorUser.uid, (n) => {
      notifs = n;
    })();
    expect(notifs.some((n) => n.title === 'Items Deleted' && n.senderName === '@rahul')).toBe(true);
  });

  it('automatically purges notifications older than 30 days', async () => {
    const userId = 'user_test_notifs';
    const now = Date.now();
    const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

    // Seed raw local notifications
    localStorage.setItem(
      'splitify_store_notifications_' + userId,
      JSON.stringify([
        {
          id: 'n_old',
          recipientUid: userId,
          type: 'expense_created',
          senderUid: 'other',
          senderName: '@friend',
          title: 'Old notification',
          description: '31 days old',
          read: false,
          createdAt: thirtyOneDaysAgo,
        },
        {
          id: 'n_recent',
          recipientUid: userId,
          type: 'expense_created',
          senderUid: 'other',
          senderName: '@friend',
          title: 'Recent notification',
          description: '10 days old',
          read: false,
          createdAt: tenDaysAgo,
        },
      ])
    );

    let deliveredNotifs: AppNotification[] = [];
    const unsub = dataService.subscribeNotifications(userId, (n) => {
      deliveredNotifs = n;
    });
    unsub();

    // Verify that the 31-day old notification was purged
    expect(deliveredNotifs.length).toBe(1);
    expect(deliveredNotifs[0].id).toBe('n_recent');

    // Storage is also updated
    const saved = JSON.parse(localStorage.getItem('splitify_store_notifications_' + userId) || '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe('n_recent');
  });

  it('creates invitation link with accurate membersCount and actor handle', async () => {
    const eventId = await dataService.createEvent('Summit Trek', creatorUser);
    const link = await dataService.createInvitationLink(eventId, creatorUser);

    expect(link.membersCount).toBe(1);
    expect(link.createdByName).toBe('@krish');
  });
});
