import { describe, it, expect, vi } from 'vitest';

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }));

import { selectNewPhoneNotifications, notificationNumericId } from '../src/hooks/usePhoneNotifications';
import { AppNotification } from '../src/types';

const n = (id: string, createdAt: number, read = false): AppNotification => ({
  id, recipientUid: 'u', type: 'expense_created', senderUid: 's', senderName: 'S',
  title: 't', description: 'd', read, createdAt,
});

describe('Phone notification mirroring', () => {
  const now = 10 * 24 * 3600 * 1000;

  it('does not replay existing notifications on first run', () => {
    const { toShow, seen } = selectNewPhoneNotifications([n('a', now), n('b', now)], null, now);
    expect(toShow).toHaveLength(0);
    expect([...seen].sort()).toEqual(['a', 'b']);
  });

  it('shows only new, unread, recent notifications once', () => {
    const seen = new Set(['a']);
    const list = [n('a', now), n('b', now - 1000), n('c', now, true), n('old', now - 2 * 24 * 3600 * 1000)];
    const first = selectNewPhoneNotifications(list, seen, now);
    expect(first.toShow.map((x) => x.id)).toEqual(['b']);
    const second = selectNewPhoneNotifications(list, first.seen, now);
    expect(second.toShow).toHaveLength(0);
  });

  it('maps ids to stable positive 32-bit integers', () => {
    const id = notificationNumericId('G73ooJpcroKXsh8lHUQ1');
    expect(id).toBe(notificationNumericId('G73ooJpcroKXsh8lHUQ1'));
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThan(2 ** 31);
  });
});
