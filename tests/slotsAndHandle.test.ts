import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataService } from '../src/services/dataService';
import { authService } from '../src/services/firebase/authService';
import { UserProfile } from '../src/types';

// Mock isFirebaseConfigured to false for deterministic local offline unit tests
vi.mock('../src/services/firebase/config', () => ({
  db: null,
  auth: null,
  isFirebaseConfigured: () => false,
}));

describe('Individual Person Slots & Event Functionality', () => {
  const mockUser: UserProfile = {
    uid: 'user_test_1',
    displayName: 'Krishnendu',
    email: 'krish@example.com',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('should support user profile display name updates', async () => {
    localStorage.setItem('splitify_mock_user', JSON.stringify(mockUser));
    await authService.updateProfile(mockUser.uid, { displayName: 'Krish' });
    const stored = JSON.parse(localStorage.getItem('splitify_mock_user') || '{}');
    expect(stored.displayName).toBe('Krish');
  });

  it('should create individual person slots during event creation', async () => {
    const eventId = await dataService.createEvent(
      'Goa Trip',
      mockUser,
      'INR',
      undefined,
      [{ name: 'Rahul' }, { name: 'Priya' }]
    );

    const event = await dataService.getEventById(eventId);
    expect(event).toBeDefined();
    expect(event?.name).toBe('Goa Trip');

    const slots = Object.values(event?.slots || {});
    expect(slots.length).toBe(2);
    expect(slots.map((s) => s.placeholderName)).toContain('Rahul');
    expect(slots.map((s) => s.placeholderName)).toContain('Priya');
    expect(slots[0].isClaimed).toBe(false);
  });

  it('should allow claiming an individual person slot and reject deletion when claimed', async () => {
    const eventId = await dataService.createEvent('Dinner', mockUser);
    const slot = await dataService.createPersonSlot(eventId, 'Aman');
    expect(slot.placeholderName).toBe('Aman');
    expect(slot.isClaimed).toBe(false);

    // Claim slot
    await dataService.claimPersonSlot(eventId, slot.id, mockUser);
    const updated = await dataService.getEventById(eventId);
    const updatedSlot = updated?.slots?.[slot.id];
    expect(updatedSlot?.isClaimed).toBe(true);
    expect(updatedSlot?.claimedByUid).toBe(mockUser.uid);
    expect(updatedSlot?.claimedByName).toBe('Krishnendu'); // First name!

    // Deleting claimed slot must be rejected
    await expect(dataService.deletePersonSlot(eventId, slot.id)).rejects.toThrow(
      'Claimed slots cannot be deleted'
    );
  });

  it('should split expense with an unclaimed person slot and migrate expenses when claimed', async () => {
    const eventId = await dataService.createEvent('Road Trip', mockUser);
    const slot = await dataService.createPersonSlot(eventId, 'Ayush');
    expect(slot.isClaimed).toBe(false);

    // Host creates an expense split between Krishnendu (user_test_1) and Ayush (slot.id)
    const itemId = await dataService.createExpenseItem(
      {
        eventId,
        name: 'Petrol & Tolls',
        costMinor: 200000, // ₹2000
        paidBy: mockUser.uid,
        splitBy: 'equal',
        participants: [mockUser.uid, slot.id],
        customShares: {
          [mockUser.uid]: 100000,
          [slot.id]: 100000,
        },
      },
      mockUser
    );

    // Verify item has slot.id as participant
    const itemsBefore = await dataService.getItems(eventId);
    const petrolItem = itemsBefore.find((i) => i.id === itemId);
    expect(petrolItem).toBeDefined();
    expect(petrolItem?.participants).toContain(slot.id);
    expect(petrolItem?.shares?.[slot.id]).toBe(100000);

    // Now Ayush joins Splitify and claims his spot
    const ayushUser: UserProfile = {
      uid: 'user_ayush_456',
      displayName: 'Ayush',
      email: 'ayush@example.com',
      createdAt: Date.now(),
    };

    await dataService.claimPersonSlot(eventId, slot.id, ayushUser);

    // Verify expenses were migrated to Ayush's real UID
    const itemsAfter = await dataService.getItems(eventId);
    const migratedItem = itemsAfter.find((i) => i.id === itemId);
    expect(migratedItem?.participants).not.toContain(slot.id);
    expect(migratedItem?.participants).toContain(ayushUser.uid);
    expect(migratedItem?.shares?.[ayushUser.uid]).toBe(100000);
    expect(migratedItem?.shares?.[slot.id]).toBeUndefined();
  });

  it('should update category name by creator', async () => {
    const eventId = await dataService.createEvent('Food Fest', mockUser);
    const itemId = await dataService.createItem(eventId, 'Snacks', mockUser);
    await dataService.convertItemToCategory(eventId, itemId, mockUser);

    // Rename category to "Evening Snacks & Chai"
    await dataService.updateItemName(eventId, itemId, 'Evening Snacks & Chai', '☕', mockUser);

    const items = await dataService.getItems(eventId);
    const updated = items.find((i) => i.id === itemId);
    expect(updated?.name).toBe('Evening Snacks & Chai');
    expect(updated?.emoji).toBe('☕');
  });
});
