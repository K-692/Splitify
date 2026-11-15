import { describe, it, expect } from 'vitest';
import { sanitizeForFirestore } from '@/utils/firestoreSanitizer';

describe('sanitizeForFirestore', () => {
  it('omits undefined fields from an object', () => {
    const raw = {
      token: 'abc123xyz',
      eventId: 'evt-1',
      maxUses: undefined,
      expiresAt: undefined,
      usesCount: 0,
      scope: 'full',
    };

    const sanitized = sanitizeForFirestore(raw);
    expect(sanitized).toEqual({
      token: 'abc123xyz',
      eventId: 'evt-1',
      usesCount: 0,
      scope: 'full',
    });
    expect('maxUses' in sanitized).toBe(false);
    expect('expiresAt' in sanitized).toBe(false);
  });

  it('recursively cleans nested objects and maps', () => {
    const raw = {
      name: 'Goa Trip',
      details: {
        location: 'Goa',
        budget: undefined,
        active: true,
      },
      slots: {
        s1: { name: 'Rahul', note: undefined },
      },
    };

    const sanitized = sanitizeForFirestore(raw);
    expect(sanitized).toEqual({
      name: 'Goa Trip',
      details: {
        location: 'Goa',
        active: true,
      },
      slots: {
        s1: { name: 'Rahul' },
      },
    });
  });

  it('preserves valid falsy values and nulls', () => {
    const raw = {
      count: 0,
      enabled: false,
      description: '',
      deletedBy: null,
      unwanted: undefined,
    };

    const sanitized = sanitizeForFirestore(raw);
    expect(sanitized).toEqual({
      count: 0,
      enabled: false,
      description: '',
      deletedBy: null,
    });
  });
});
