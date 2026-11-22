import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AppNotification } from '@/types';

const CHANNEL_ID = 'splitify_updates';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SEEN_LIMIT = 400;

const seenKey = (uid: string) => `splitify_phone_notified_${uid}`;

/** Stable positive 31-bit id for a Firestore notification id. */
export function notificationNumericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

const readSeen = (uid: string): Set<string> | null => {
  try {
    const raw = localStorage.getItem(seenKey(uid));
    return raw ? new Set<string>(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const writeSeen = (uid: string, seen: Set<string>) => {
  try {
    localStorage.setItem(seenKey(uid), JSON.stringify([...seen].slice(-SEEN_LIMIT)));
  } catch {
    /* ignore */
  }
};

/**
 * Pick in-app notifications that should also appear as phone notifications:
 * unread, not shown before, and recent. On the first run for a user every
 * existing notification is marked as seen so old alerts are not replayed.
 */
export function selectNewPhoneNotifications(
  notifications: AppNotification[],
  seen: Set<string> | null,
  now: number = Date.now()
): { toShow: AppNotification[]; seen: Set<string> } {
  if (!seen) {
    return { toShow: [], seen: new Set(notifications.map((n) => n.id)) };
  }
  const next = new Set(seen);
  const toShow: AppNotification[] = [];
  for (const n of notifications) {
    if (next.has(n.id)) continue;
    next.add(n.id);
    if (!n.read && now - (n.createdAt || 0) <= MAX_AGE_MS) toShow.push(n);
  }
  return { toShow, seen: next };
}

/**
 * Android app only: mirrors every new in-app notification as a phone
 * (system tray) notification, and opens the related event when tapped.
 */
export function usePhoneNotifications(userUid: string | undefined, notifications: AppNotification[], loaded: boolean) {
  const navigate = useNavigate();
  const ready = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  // One-time setup: permission, channel, tap handler
  useEffect(() => {
    if (!isNative || !userUid) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') await LocalNotifications.requestPermissions();
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'Splitify updates',
          description: 'Expenses, payments, reminders and invitations',
          importance: 4,
          visibility: 1,
        });
      } catch {
        /* notifications unavailable — in-app inbox still works */
      }
      if (!cancelled) ready.current = true;
    })();

    const tapListener = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const eventId = action.notification.extra?.eventId as string | undefined;
      navigate(eventId ? `/events/${eventId}` : '/notifications');
    });

    return () => {
      cancelled = true;
      tapListener.then((l) => l.remove()).catch(() => undefined);
    };
  }, [isNative, userUid, navigate]);

  // Show new notifications as they arrive from Firestore
  useEffect(() => {
    if (!isNative || !userUid || !loaded) return;
    const { toShow, seen } = selectNewPhoneNotifications(notifications, readSeen(userUid));
    writeSeen(userUid, seen);
    if (toShow.length === 0) return;
    LocalNotifications.schedule({
      notifications: toShow.map((n) => ({
        id: notificationNumericId(n.id),
        title: n.title,
        body: n.description,
        largeBody: n.description,
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_splitify',
        iconColor: '#16AA88',
        group: n.eventId || 'splitify',
        extra: { eventId: n.eventId, notificationId: n.id },
      })),
    }).catch(() => undefined);
  }, [isNative, userUid, notifications, loaded]);
}
