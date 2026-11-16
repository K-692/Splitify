import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  REMINDER_COOLDOWN_MS,
  FRIEND_REQUEST_COOLDOWN_MS,
  getReminderCooldown,
  isReminderOnCooldown,
  setReminderCooldown,
  getFriendRequestCooldown,
  isFriendRequestOnCooldown,
  setFriendRequestCooldown,
} from '../src/utils/cooldown';
import { dataService } from '../src/services/dataService';
import { UserProfile } from '../src/types';

// Mock isFirebaseConfigured to false for deterministic local unit tests
vi.mock('../src/services/firebase/config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
}));

describe('Anti-Spam Cooldown & Universal Subitem Functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Reminder Cooldown (5 Minutes Anti-Spam)', () => {
    it('should be initially false and 0 remaining', () => {
      expect(isReminderOnCooldown('user_debtor_1')).toBe(false);
      expect(getReminderCooldown('user_debtor_1')).toBe(0);
    });

    it('should enforce 5-minute cooldown after setting reminder', () => {
      const now = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      setReminderCooldown('user_debtor_1', 'event_123');
      expect(isReminderOnCooldown('user_debtor_1', 'event_123')).toBe(true);
      expect(getReminderCooldown('user_debtor_1', 'event_123')).toBe(REMINDER_COOLDOWN_MS);

      // 4 minutes later (still on cooldown)
      vi.spyOn(Date, 'now').mockReturnValue(now + 4 * 60 * 1000);
      expect(isReminderOnCooldown('user_debtor_1', 'event_123')).toBe(true);
      expect(getReminderCooldown('user_debtor_1', 'event_123')).toBe(60 * 1000);

      // 5 minutes and 1 second later (cooldown expired)
      vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1000);
      expect(isReminderOnCooldown('user_debtor_1', 'event_123')).toBe(false);
      expect(getReminderCooldown('user_debtor_1', 'event_123')).toBe(0);
    });
  });

  describe('Friend Request Cooldown (5 Minutes Anti-Spam)', () => {
    it('should be initially false and 0 remaining', () => {
      expect(isFriendRequestOnCooldown('target_user_99')).toBe(false);
      expect(getFriendRequestCooldown('target_user_99')).toBe(0);
    });

    it('should enforce 5-minute cooldown after sending friend request', () => {
      const now = 2000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      setFriendRequestCooldown('target_user_99');
      expect(isFriendRequestOnCooldown('target_user_99')).toBe(true);
      expect(getFriendRequestCooldown('target_user_99')).toBe(FRIEND_REQUEST_COOLDOWN_MS);

      // 2.5 minutes later
      vi.spyOn(Date, 'now').mockReturnValue(now + 2.5 * 60 * 1000);
      expect(isFriendRequestOnCooldown('target_user_99')).toBe(true);
      expect(getFriendRequestCooldown('target_user_99')).toBe(2.5 * 60 * 1000);

      // 5 minutes and 100ms later (expired)
      vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 100);
      expect(isFriendRequestOnCooldown('target_user_99')).toBe(false);
      expect(getFriendRequestCooldown('target_user_99')).toBe(0);
    });
  });

  describe('Universal Subitem Addition Without Special Permissions', () => {
    it('allows any member to add subitems to any category and convert items', async () => {
      const hostUser: UserProfile = {
        uid: 'host_uid',
        displayName: 'Host User',
        username: 'host',
        email: 'host@test.com',
        createdAt: 1000,
      };

      const regularMember: UserProfile = {
        uid: 'regular_member_uid',
        displayName: 'Regular Member',
        username: 'regular',
        email: 'regular@test.com',
        createdAt: 1000,
      };

      // Host creates event
      const eventId = await dataService.createEvent('Trip', hostUser, 'INR', '✈️');
      const event = await dataService.getEventById(eventId);
      const members = event?.members || {};

      // Regular member creates a standalone item
      const itemId = await dataService.createExpenseItem(
        {
          eventId,
          name: 'Food',
          costMinor: 20000,
          paidBy: regularMember.uid,
          splitBy: 'equal',
          participants: [hostUser.uid, regularMember.uid],
        },
        regularMember,
        members
      );

      // Any member (e.g. host) can convert it to category
      await dataService.convertItemToCategory(eventId, itemId, hostUser, members);

      // Any member (regular member) can add subitems to that category without permissions
      const subitemId = await dataService.createExpense(
        {
          eventId,
          itemId,
          name: 'Dessert',
          costMinor: 5000,
          paidBy: regularMember.uid,
          splitBy: 'equal',
          participants: [hostUser.uid, regularMember.uid],
        },
        regularMember,
        members
      );

      expect(subitemId).toBeTruthy();

      const items = await dataService.getItems(eventId);
      const convertedItem = items.find((i) => i.id === itemId);
      expect(convertedItem?.isCategory).toBe(true);
    });
  });
});
