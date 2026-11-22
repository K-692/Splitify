import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase/config';

const TOKEN_KEY = 'splitify_push_token';

/**
 * Stores this device's FCM token under users/{uid}/fcmTokens/{token} so the
 * Cloud Function can deliver phone notifications when the app is closed.
 * Returns false when the backend rejects it (e.g. rules not deployed yet).
 */
export async function savePushToken(uid: string, token: string, platform: string): Promise<boolean> {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  if (!isFirebaseConfigured() || !db) return false;
  try {
    const now = Date.now();
    await setDoc(doc(db, 'users', uid, 'fcmTokens', token), { token, platform, createdAt: now, updatedAt: now });
    return true;
  } catch (err) {
    console.warn('Push token not saved:', err);
    return false;
  }
}

/** Unlinks this device from the signed-out user so their alerts stop arriving here. */
export async function removeCurrentPushToken(uid: string): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (!token || !isFirebaseConfigured() || !db) return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token));
  } catch {
    /* already gone or no permission */
  }
}
