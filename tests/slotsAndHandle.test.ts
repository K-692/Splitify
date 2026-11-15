import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataService } from '../src/services/dataService';
import { UserProfile } from '../src/types';

// Mock isFirebaseConfigured to false for deterministic local offline unit tests
vi.mock('../src/services/firebase/config', () => ({
  db: null,
  auth: null,
  isFirebaseConfigured: () => false,
}));

describe('Individual Person Slots & Handle Renaming', () => {
  const mockUser: UserProfile = {
    uid: 'user_test_1',
    displayName: 'Krishnendu Pal',
    email: 'krish@example.com',
    username: 'krish_orig',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('should validate and change username handle with case-insensitive normalization', async () => {
    // Valid rename
    const result = await dataService.changeUsernameHandle(mockUser, 'Krish_New');
    expect(result).toBe('krish_new');

    // Invalid format
    await expect(dataService.changeUsernameHandle(mockUser, 'ab')).rejects.toThrow();
    await expect(dataService.changeUsernameHandle(mockUser, 'invalid@handle!')).rejects.toThrow();
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
});
