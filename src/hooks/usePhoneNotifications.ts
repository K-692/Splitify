import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { App as CapApp } from '@capacitor/app';
import { savePushToken } from '@/services/pushService';
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
  // True once this device's push token is stored, i.e. the server will deliver
  // alerts while the app is closed or in the background.
  const pushActive = useRef(false);
  const appActive = useRef(true);
  const sessionStart = useRef(Date.now());

  // Push registration (FCM) + app foreground tracking
  useEffect(() => {
    if (!isNative || !userUid) return;
    const handles: Array<Promise<{ remove: () => Promise<void> }>> = [];

    handles.push(
      CapApp.addListener('appStateChange', ({ isActive }) => {
        appActive.current = isActive;
      })
    );
    handles.push(
      PushNotifications.addListener('registration', async ({ value }) => {
        pushActive.current = await savePushToken(userUid, value, Capacitor.getPlatform());
      })
    );
    handles.push(
      PushNotifications.addListener('registrationError', () => {
        pushActive.current = false;
      })
    );
    handles.push(
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const eventId = action.notification.data?.eventId as string | undefined;
        navigate(eventId ? `/events/${eventId}` : '/notifications');
      })
    );

    (async () => {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive === 'granted') {
          await PushNotifications.createChannel({
            id: CHANNEL_ID,
            name: 'Splitify updates',
            description: 'Expenses, payments, reminders and invitations',
            importance: 4,
            visibility: 1,
          });
          await PushNotifications.register();
        }
      } catch {
        /* Push unavailable — local mirroring below still works while the app runs */
      }
    })();

    return () => {
      handles.forEach((h) => h.then((l) => l.remove()).catch(() => undefined));
    };
  }, [isNative, userUid, navigate]);

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
    const { toShow: candidates, seen } = selectNewPhoneNotifications(notifications, readSeen(userUid));
    writeSeen(userUid, seen);
    // With push active the server already shows alerts while the app is in the
    // background or closed, so only mirror ones that arrive while it is open.
    const toShow = pushActive.current
      ? appActive.current
        ? candidates.filter((n) => (n.createdAt || 0) >= sessionStart.current - 5000)
        : []
      : candidates;
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
