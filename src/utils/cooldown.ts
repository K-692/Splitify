/**
 * Cooldown management for Payment Reminders and Friend Requests
 * Prevents spamming by enforcing a strict 5-minute timeout window.
 */

export const REMINDER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
export const FRIEND_REQUEST_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export const getReminderCooldown = (debtorUid: string, eventId?: string): number => {
  try {
    const specificKey = eventId ? `splitify_reminder_${eventId}_${debtorUid}` : null;
    const generalKey = `splitify_reminder_${debtorUid}`;

    const raw = (specificKey && localStorage.getItem(specificKey)) || localStorage.getItem(generalKey);
    if (!raw) return 0;

    const timestamp = parseInt(raw, 10);
    if (isNaN(timestamp)) return 0;

    const elapsed = Date.now() - timestamp;
    const remaining = REMINDER_COOLDOWN_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
};

export const isReminderOnCooldown = (debtorUid: string, eventId?: string): boolean => {
  return getReminderCooldown(debtorUid, eventId) > 0;
};

export const setReminderCooldown = (debtorUid: string, eventId?: string): void => {
  try {
    const nowStr = Date.now().toString();
    if (eventId) {
      localStorage.setItem(`splitify_reminder_${eventId}_${debtorUid}`, nowStr);
    }
    localStorage.setItem(`splitify_reminder_${debtorUid}`, nowStr);
  } catch {
    // Ignore storage quota or access errors
  }
};

export const getFriendRequestCooldown = (targetUid: string): number => {
  try {
    const raw = localStorage.getItem(`splitify_friend_req_${targetUid}`);
    if (!raw) return 0;

    const timestamp = parseInt(raw, 10);
    if (isNaN(timestamp)) return 0;

    const elapsed = Date.now() - timestamp;
    const remaining = FRIEND_REQUEST_COOLDOWN_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
};

export const isFriendRequestOnCooldown = (targetUid: string): boolean => {
  return getFriendRequestCooldown(targetUid) > 0;
};

export const setFriendRequestCooldown = (targetUid: string): void => {
  try {
    localStorage.setItem(`splitify_friend_req_${targetUid}`, Date.now().toString());
  } catch {
    // Ignore storage quota or access errors
  }
};
