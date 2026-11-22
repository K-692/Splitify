/**
 * Sends an Android push notification for every new in-app notification.
 *
 * Trigger: a document created at users/{uid}/notifications/{notificationId}
 * (written by the app whenever an expense, payment, reminder or invitation
 * concerns that user). Delivers to all of the user's registered devices in
 * users/{uid}/fcmTokens and removes tokens that are no longer valid.
 * Read-only on existing data apart from pruning dead push tokens.
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

exports.sendPushOnNotification = onDocumentCreated(
  { document: 'users/{uid}/notifications/{notificationId}', region: 'us-central1' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const n = snap.data() || {};
    const { uid, notificationId } = event.params;

    const tokensSnap = await admin.firestore().collection('users').doc(uid).collection('fcmTokens').get();
    const tokens = tokensSnap.docs.map((d) => d.get('token') || d.id).filter(Boolean);
    if (tokens.length === 0) return;

    const title = String(n.title || 'Splitify').slice(0, 200);
    const body = String(n.description || '').slice(0, 1000);
    const data = {
      notificationId: String(notificationId),
      type: String(n.type || ''),
      eventId: String(n.eventId || ''),
    };

    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'splitify_updates',
          icon: 'ic_stat_splitify',
          color: '#16AA88',
          tag: String(notificationId),
        },
      },
    });

    const stale = [];
    res.responses.forEach((r, i) => {
      if (!r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code)) stale.push(tokens[i]);
    });
    await Promise.all(
      stale.map((t) => admin.firestore().collection('users').doc(uid).collection('fcmTokens').doc(t).delete().catch(() => undefined))
    );
    logger.info('push sent', { uid, notificationId, sent: res.successCount, failed: res.failureCount, pruned: stale.length });
  }
);
