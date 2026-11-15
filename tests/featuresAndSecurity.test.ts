import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataService } from '../src/services/dataService';
import { UserProfile, SplitifyEvent } from '../src/types';

vi.mock('../src/services/firebase/config', () => ({
  db: null,
  auth: null,
  isFirebaseConfigured: () => false,
}));

describe('User Profile UID Lookup, Event Invitations & Slot Claiming', () => {
  const hostUser: UserProfile = {
    uid: 'host_uid_101',
    displayName: 'Krishnendu Pal',
    email: 'krish@example.com',
    username: 'krishnendu',
    createdAt: Date.now(),
  };

  const friendUser: UserProfile = {
    uid: 'friend_uid_202',
    displayName: 'Rahul Sharma',
    email: 'rahul@example.com',
    username: 'rahul_s',
    createdAt: Date.now(),
  };

  const thirdUser: UserProfile = {
    uid: 'friend_uid_303',
    displayName: 'Priya Patel',
    email: 'priya@example.com',
    username: 'priya_p',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    // Pre-populate mock users in localStorage for offline testing
    localStorage.setItem('splitify_store_mock_users', JSON.stringify([hostUser, friendUser, thirdUser]));
  });

  describe('getUserByUid and getUsersByUids', () => {
    it('should retrieve a single user profile directly by UID', async () => {
      const profile = await dataService.getUserByUid('friend_uid_202');
      expect(profile).not.toBeNull();
      expect(profile?.displayName).toBe('Rahul Sharma');
      expect(profile?.username).toBe('rahul_s');
      expect(profile?.uid).toBe('friend_uid_202');
    });

    it('should return null for non-existent or empty UID', async () => {
      const profileEmpty = await dataService.getUserByUid('');
      expect(profileEmpty).toBeNull();

      const profileNonExistent = await dataService.getUserByUid('non_existent_uid_999');
      expect(profileNonExistent).toBeNull();
    });

    it('should batch retrieve user profiles by multiple UIDs with deduplication', async () => {
      const result = await dataService.getUsersByUids([
        'host_uid_101',
        'friend_uid_202',
        'host_uid_101', // duplicate
        'non_existent_uid',
      ]);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['host_uid_101']?.displayName).toBe('Krishnendu Pal');
      expect(result['friend_uid_202']?.displayName).toBe('Rahul Sharma');
    });
  });

  describe('Event Invitations to Friends', () => {
    it('should send an event invitation with full scope and prevent duplicates', async () => {
      const eventId = await dataService.createEvent('Goa Trip', hostUser);
      const event = (await dataService.getEventById(eventId)) as SplitifyEvent;

      // Send first invitation
      await dataService.sendEventInvitation(event, hostUser, {
        uid: friendUser.uid,
        displayName: friendUser.displayName,
      });

      // Sending a second invitation while pending must throw
      await expect(
        dataService.sendEventInvitation(event, hostUser, {
          uid: friendUser.uid,
          displayName: friendUser.displayName,
        })
      ).rejects.toThrow('An invitation has already been sent');
    });

    it('should reject invitation if the friend is already an event member', async () => {
      const eventId = await dataService.createEvent('Weekend Dinner', hostUser);
      const event = (await dataService.getEventById(eventId)) as SplitifyEvent;

      // Host is already a member
      await expect(
        dataService.sendEventInvitation(event, hostUser, {
          uid: hostUser.uid,
          displayName: hostUser.displayName,
        })
      ).rejects.toThrow('is already a member of this event');
    });

    it('should accept invitation, add member to event, and auto-associate expected slot', async () => {
      // Create event with expected slot for Rahul
      const eventId = await dataService.createEvent('Trek', hostUser, 'INR', undefined, [
        { name: 'Rahul', expectedUid: friendUser.uid },
      ]);
      const event = (await dataService.getEventById(eventId)) as SplitifyEvent;
      const initialSlot = Object.values(event.slots || {})[0];
      expect(initialSlot.placeholderName).toBe('Rahul');
      expect(initialSlot.isClaimed).toBe(false);

      // Send invite
      await dataService.sendEventInvitation(event, hostUser, {
        uid: friendUser.uid,
        displayName: friendUser.displayName,
      });

      // Load invitations
      const allInvites = JSON.parse(localStorage.getItem('splitify_store_event_invitations') || '[]');
      const invite = allInvites.find((i: any) => i.toUid === friendUser.uid);
      expect(invite).toBeDefined();

      // Accept invite
      await dataService.respondToEventInvitation(invite, true, friendUser);

      // Verify event membership and slot claim
      const updatedEvent = (await dataService.getEventById(eventId)) as SplitifyEvent;
      expect(updatedEvent.members[friendUser.uid]).toBeDefined();
      expect(updatedEvent.members[friendUser.uid].role).toBe('member');
      expect(updatedEvent.members[friendUser.uid].slotId).toBe(initialSlot.id);

      const updatedSlot = updatedEvent.slots?.[initialSlot.id];
      expect(updatedSlot?.isClaimed).toBe(true);
      expect(updatedSlot?.claimedByUid).toBe(friendUser.uid);
    });

    it('should decline invitation without adding member to event', async () => {
      const eventId = await dataService.createEvent('Concert', hostUser);
      const event = (await dataService.getEventById(eventId)) as SplitifyEvent;

      await dataService.sendEventInvitation(event, hostUser, {
        uid: friendUser.uid,
        displayName: friendUser.displayName,
      });

      const allInvites = JSON.parse(localStorage.getItem('splitify_store_event_invitations') || '[]');
      const invite = allInvites.find((i: any) => i.toUid === friendUser.uid);
      expect(invite).toBeDefined();

      // Decline
      await dataService.respondToEventInvitation(invite, false, friendUser);

      const updatedEvent = (await dataService.getEventById(eventId)) as SplitifyEvent;
      expect(updatedEvent.members[friendUser.uid]).toBeUndefined();

      const updatedInvites = JSON.parse(localStorage.getItem('splitify_store_event_invitations') || '[]');
      expect(updatedInvites.find((i: any) => i.id === invite.id)?.status).toBe('declined');
    });
  });

  describe('Invitation Link and Slot Claiming', () => {
    it('should include available slots when creating an invitation link', async () => {
      const eventId = await dataService.createEvent('Camping', hostUser, 'INR', undefined, [
        { name: 'Alice' },
        { name: 'Bob' },
      ]);

      const link = await dataService.createInvitationLink(eventId, hostUser, { scope: 'full' });
      expect(link.availableSlots).toBeDefined();
      expect(link.availableSlots?.length).toBe(2);
      expect(link.availableSlots?.map((s) => s.placeholderName)).toContain('Alice');
      expect(link.availableSlots?.map((s) => s.placeholderName)).toContain('Bob');
    });

    it('should join event via token and claim an available slot', async () => {
      const eventId = await dataService.createEvent('Road Trip', hostUser, 'INR', undefined, [
        { name: 'Sam' },
      ]);
      const event = (await dataService.getEventById(eventId)) as SplitifyEvent;
      const samSlot = Object.values(event.slots || {})[0];

      const link = await dataService.createInvitationLink(eventId, hostUser, { scope: 'full' });

      const { event: joinedEvent } = await dataService.joinEventByInvitationToken(
        link.token,
        friendUser,
        samSlot.id
      );

      expect(joinedEvent.members[friendUser.uid]).toBeDefined();
      expect(joinedEvent.members[friendUser.uid].slotId).toBe(samSlot.id);
      expect(joinedEvent.slots?.[samSlot.id].isClaimed).toBe(true);
      expect(joinedEvent.slots?.[samSlot.id].claimedByUid).toBe(friendUser.uid);

      // Attempting to claim the same slot by a third user should fail
      await expect(
        dataService.joinEventByInvitationToken(link.token, thirdUser, samSlot.id)
      ).rejects.toThrow('has already been claimed');
    });

    it('should allow joining as a new person without claiming a slot', async () => {
      const eventId = await dataService.createEvent('Party', hostUser);
      const link = await dataService.createInvitationLink(eventId, hostUser, { scope: 'full' });

      const { event: joinedEvent } = await dataService.joinEventByInvitationToken(
        link.token,
        friendUser
      );

      expect(joinedEvent.members[friendUser.uid]).toBeDefined();
      expect(joinedEvent.members[friendUser.uid].slotId).toBeUndefined();
    });
  });

  describe('Debts Owed To Current User & Reminder Isolation', () => {
    it('should isolate only debts where the debtor owes money directly to the current user', () => {
      // Suppose suggestions say:
      // friendUser owes hostUser ₹120 (12000 minor)
      // thirdUser owes hostUser ₹50 (5000 minor)
      // hostUser owes anotherUser ₹20 (2000 minor)
      const suggestions = [
        { fromUid: friendUser.uid, toUid: hostUser.uid, amountMinor: 12000 },
        { fromUid: thirdUser.uid, toUid: hostUser.uid, amountMinor: 5000 },
        { fromUid: hostUser.uid, toUid: 'other_user', amountMinor: 2000 },
      ];

      const debtsOwedToCurrentUser: Record<string, number> = {};
      const userOwesMember: Record<string, number> = {};

      for (const sug of suggestions) {
        if (sug.toUid === hostUser.uid && sug.amountMinor > 0) {
          debtsOwedToCurrentUser[sug.fromUid] =
            (debtsOwedToCurrentUser[sug.fromUid] || 0) + sug.amountMinor;
        }
        if (sug.fromUid === hostUser.uid && sug.amountMinor > 0) {
          userOwesMember[sug.toUid] = (userOwesMember[sug.toUid] || 0) + sug.amountMinor;
        }
      }

      // Host can send reminder to friendUser and thirdUser only
      expect(debtsOwedToCurrentUser[friendUser.uid]).toBe(12000);
      expect(debtsOwedToCurrentUser[thirdUser.uid]).toBe(5000);
      expect(debtsOwedToCurrentUser['other_user']).toBeUndefined();

      // Host owes money to other_user (Settle Now, NOT Send Reminder)
      expect(userOwesMember['other_user']).toBe(2000);
      expect(userOwesMember[friendUser.uid]).toBeUndefined();
    });
  });

  describe('Expense Search Filtering Matching Logic', () => {
    it('should match standalone items by name, category names, subitems, and comments', () => {
      const items = [
        { id: 'item_1', name: 'Scuba Diving', isCategory: false, comment: 'PADI certification' },
        { id: 'cat_1', name: 'Food & Dining', isCategory: true },
        { id: 'item_2', name: 'Hotel Stay', isCategory: false, comment: 'Beach resort' },
      ];

      const subitemsByCat: Record<string, any[]> = {
        cat_1: [
          { id: 'sub_1', name: 'Seafood Buffet', comment: 'Lobster & crab' },
          { id: 'sub_2', name: 'Evening Cocktails', comment: 'Sunset lounge' },
        ],
      };

      const filterByQuery = (q: string) => {
        const query = q.trim().toLowerCase();
        return items.filter((item) => {
          if (item.name.toLowerCase().includes(query)) return true;
          if (item.comment?.toLowerCase().includes(query)) return true;
          if (item.isCategory) {
            const subs = subitemsByCat[item.id] || [];
            return subs.some(
              (s) => s.name.toLowerCase().includes(query) || s.comment?.toLowerCase().includes(query)
            );
          }
          return false;
        });
      };

      // Query "scuba" matches item_1
      expect(filterByQuery('scuba').map((i) => i.id)).toEqual(['item_1']);

      // Query "lobster" matches cat_1 via its subitem comment
      expect(filterByQuery('lobster').map((i) => i.id)).toEqual(['cat_1']);

      // Query "dining" matches cat_1 via category name
      expect(filterByQuery('dining').map((i) => i.id)).toEqual(['cat_1']);

      // Query "beach" matches item_2 via comment
      expect(filterByQuery('beach').map((i) => i.id)).toEqual(['item_2']);

      // Non-matching query returns empty
      expect(filterByQuery('nonexistent')).toEqual([]);
    });
  });
});
