import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataService, getFriendshipDocId } from '../src/services/dataService';
import { UserProfile, FriendRequest, Friendship, AppNotification } from '../src/types';

// Deterministic local unit tests using localStorage mock
vi.mock('../src/services/firebase/config', () => ({
  isFirebaseConfigured: () => false,
  db: null,
  auth: null,
}));

describe('Friend Request & Friendship Connection Lifecycle', () => {
  const userA: UserProfile = {
    uid: 'user_A_111',
    displayName: 'Aarav Patel',
    email: 'aarav@example.com',
    username: 'aarav_p',
    photoURL: 'https://lh3.googleusercontent.com/a/aarav_photo',
    createdAt: Date.now() - 100000,
  };

  const userB: UserProfile = {
    uid: 'user_B_222',
    displayName: 'Bhavna Sharma',
    email: 'bhavna@example.com',
    username: 'bhavna_s',
    photoURL: 'https://lh3.googleusercontent.com/a/bhavna_photo',
    createdAt: Date.now() - 50000,
  };

  const userC: UserProfile = {
    uid: 'user_C_333',
    displayName: 'Chirag Gupta',
    email: 'chirag@example.com',
    username: 'chirag_g',
    photoURL: undefined,
    createdAt: Date.now() - 20000,
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('splitify_store_mock_users', JSON.stringify([userA, userB, userC]));
    vi.restoreAllMocks();
  });

  describe('Deterministic Friendship Document ID', () => {
    it('should generate identical document ID regardless of UID argument order', () => {
      const id1 = getFriendshipDocId(userA.uid, userB.uid);
      const id2 = getFriendshipDocId(userB.uid, userA.uid);
      expect(id1).toBe(id2);
      expect(id1).toBe('user_A_111_user_B_222');
    });

    it('should correctly sort lexicographically different UIDs', () => {
      const id = getFriendshipDocId('zeta_uid', 'alpha_uid');
      expect(id).toBe('alpha_uid_zeta_uid');
    });
  });

  describe('Sending Friend Requests', () => {
    it('should prevent sending a friend request to oneself', async () => {
      await expect(dataService.sendFriendRequest(userA, userA)).rejects.toThrow(
        'You cannot send a friend request to yourself'
      );
    });

    it('should successfully create a pending friend request from A to B with sanitized fields', async () => {
      await dataService.sendFriendRequest(userA, userB);

      const allReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      expect(allReqs).toHaveLength(1);
      const req = allReqs[0];
      expect(req.fromUid).toBe(userA.uid);
      expect(req.toUid).toBe(userB.uid);
      expect(req.fromDisplayName).toBe('Aarav Patel');
      expect(req.fromUsername).toBe('aarav_p');
      expect(req.status).toBe('pending');
      expect(req.createdAt).toBeTypeOf('number');

      // Check notification sent to recipient B
      const notifs: AppNotification[] = JSON.parse(
        localStorage.getItem(`splitify_store_notifications_${userB.uid}`) || '[]'
      );
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('friend_request_received');
      expect(notifs[0].senderUid).toBe(userA.uid);
      expect(notifs[0].recipientUid).toBe(userB.uid);
      expect(notifs[0].actionData?.requestId).toBe(req.id);
    });

    it('should handle undefined optional fields safely using sanitizeForFirestore', async () => {
      // userC has undefined photoURL
      await dataService.sendFriendRequest(userC, userA);

      const allReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      expect(allReqs).toHaveLength(1);
      const req = allReqs[0];
      expect(req.fromUid).toBe(userC.uid);
      expect(req.fromPhotoURL).toBeUndefined();
    });

    it('should prevent sending duplicate outgoing pending friend request', async () => {
      await dataService.sendFriendRequest(userA, userB);

      await expect(dataService.sendFriendRequest(userA, userB)).rejects.toThrow(
        'A friend request has already been sent to this user.'
      );
    });

    it('should prevent sending reverse friend request when incoming request is already pending', async () => {
      // A sends to B first
      await dataService.sendFriendRequest(userA, userB);

      // Now B attempts to send to A
      await expect(dataService.sendFriendRequest(userB, userA)).rejects.toThrow(
        'This user has already sent you a friend request. You can accept it from your Received Requests.'
      );
    });

    it('should prevent sending friend request if users are already friends', async () => {
      // Set existing friendship
      const friendship: Friendship = {
        id: getFriendshipDocId(userA.uid, userB.uid),
        user1Uid: userA.uid,
        user2Uid: userB.uid,
        createdAt: Date.now(),
      };
      localStorage.setItem('splitify_store_friendships', JSON.stringify([friendship]));

      await expect(dataService.sendFriendRequest(userA, userB)).rejects.toThrow(
        'You are already friends with this user'
      );
    });
  });

  describe('Accepting Friend Requests & Atomic Friendship Creation', () => {
    it('should accept pending request, create deterministic friendship, and notify sender', async () => {
      await dataService.sendFriendRequest(userA, userB);
      const allReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      const reqId = allReqs[0].id;

      // User B accepts request
      await dataService.respondToFriendRequest(reqId, true, userB);

      // Verify friend request status updated to accepted
      const updatedReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      expect(updatedReqs[0].status).toBe('accepted');

      // Verify friendship document created with deterministic ID
      const friendships: Friendship[] = JSON.parse(
        localStorage.getItem('splitify_store_friendships') || '[]'
      );
      expect(friendships).toHaveLength(1);
      const fs = friendships[0];
      const expectedDocId = getFriendshipDocId(userA.uid, userB.uid);
      expect(fs.id).toBe(expectedDocId);
      expect([fs.user1Uid, fs.user2Uid].sort()).toEqual([userA.uid, userB.uid].sort());
      expect(fs.requestId).toBe(reqId);

      // Verify acceptance notification sent to sender A
      const notifsA: AppNotification[] = JSON.parse(
        localStorage.getItem(`splitify_store_notifications_${userA.uid}`) || '[]'
      );
      expect(notifsA).toHaveLength(1);
      expect(notifsA[0].type).toBe('friend_request_accepted');
      expect(notifsA[0].senderUid).toBe(userB.uid);
      expect(notifsA[0].recipientUid).toBe(userA.uid);
    });

    it('should not duplicate friendship if accepted multiple times (idempotency)', async () => {
      await dataService.sendFriendRequest(userA, userB);
      const allReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      const reqId = allReqs[0].id;

      await dataService.respondToFriendRequest(reqId, true, userB);
      // Attempt to accept again
      await dataService.respondToFriendRequest(reqId, true, userB);

      const friendships: Friendship[] = JSON.parse(
        localStorage.getItem('splitify_store_friendships') || '[]'
      );
      expect(friendships).toHaveLength(1);
    });
  });

  describe('Declining Friend Requests', () => {
    it('should update request status to declined without creating friendship', async () => {
      await dataService.sendFriendRequest(userA, userB);
      const allReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      const reqId = allReqs[0].id;

      // User B declines request
      await dataService.respondToFriendRequest(reqId, false, userB);

      const updatedReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      expect(updatedReqs[0].status).toBe('declined');

      const friendships: Friendship[] = JSON.parse(
        localStorage.getItem('splitify_store_friendships') || '[]'
      );
      expect(friendships).toHaveLength(0);
    });
  });

  describe('Cancelling Friend Requests', () => {
    it('should cancel an outgoing friend request', async () => {
      await dataService.sendFriendRequest(userA, userB);
      const allReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      const reqId = allReqs[0].id;

      await dataService.cancelFriendRequest(reqId);

      const updatedReqs: FriendRequest[] = JSON.parse(
        localStorage.getItem('splitify_store_friend_requests') || '[]'
      );
      expect(updatedReqs[0].status).toBe('cancelled');
    });
  });

  describe('Subscriptions and Real-time Deduplication', () => {
    it('should subscribe to friends and deduplicate pairs if duplicate IDs exist', () => {
      const friendship1: Friendship = {
        id: 'legacy_autogen_1',
        user1Uid: userA.uid,
        user2Uid: userB.uid,
        createdAt: 1000,
      };
      const friendship2: Friendship = {
        id: getFriendshipDocId(userA.uid, userB.uid),
        user1Uid: userA.uid,
        user2Uid: userB.uid,
        createdAt: 2000,
      };
      localStorage.setItem('splitify_store_friendships', JSON.stringify([friendship1, friendship2]));

      let emittedFriends: Friendship[] = [];
      const unsub = dataService.subscribeFriends(userA.uid, (list) => {
        emittedFriends = list;
      });

      expect(emittedFriends).toHaveLength(1);
      unsub();
    });

    it('should return friends for both user1Uid and user2Uid relationships', () => {
      // userA is user1Uid with userB, and user2Uid with userC
      const fs1: Friendship = {
        id: 'fs_1',
        user1Uid: userA.uid,
        user2Uid: userB.uid,
        createdAt: 1000,
      };
      const fs2: Friendship = {
        id: 'fs_2',
        user1Uid: userC.uid,
        user2Uid: userA.uid,
        createdAt: 2000,
      };
      localStorage.setItem('splitify_store_friendships', JSON.stringify([fs1, fs2]));

      let emitted: Friendship[] = [];
      const unsub = dataService.subscribeFriends(userA.uid, (list) => {
        emitted = list;
      });

      expect(emitted).toHaveLength(2);
      unsub();
    });
  });

  describe('Safe Repair Mechanism for Orphaned Accepted Requests', () => {
    it('should repair accepted friend requests that missed friendship creation', async () => {
      // Simulate historical bug: request was marked accepted, but friendship failed to create
      const orphanedReq: FriendRequest = {
        id: 'orphaned_accepted_req_99',
        fromUid: userA.uid,
        toUid: userB.uid,
        fromDisplayName: userA.displayName,
        fromUsername: userA.username,
        status: 'accepted',
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3500000,
      };
      localStorage.setItem('splitify_store_friend_requests', JSON.stringify([orphanedReq]));
      localStorage.setItem('splitify_store_friendships', JSON.stringify([]));

      // Run repair for userA
      const repaired = await dataService.repairAcceptedFriendRequests(userA);
      expect(repaired).toBe(1);

      // Verify friendship now established
      const friendships: Friendship[] = JSON.parse(
        localStorage.getItem('splitify_store_friendships') || '[]'
      );
      expect(friendships).toHaveLength(1);
      expect(friendships[0].id).toBe(getFriendshipDocId(userA.uid, userB.uid));
      expect(friendships[0].requestId).toBe(orphanedReq.id);

      // Running repair again should be idempotent (0 repaired)
      const secondRun = await dataService.repairAcceptedFriendRequests(userA);
      expect(secondRun).toBe(0);
    });
  });

  describe('Remove Friend', () => {
    it('should successfully remove a friendship by ID', async () => {
      const friendship: Friendship = {
        id: getFriendshipDocId(userA.uid, userB.uid),
        user1Uid: userA.uid,
        user2Uid: userB.uid,
        createdAt: Date.now(),
      };
      localStorage.setItem('splitify_store_friendships', JSON.stringify([friendship]));

      await dataService.removeFriend(friendship.id);

      const remaining: Friendship[] = JSON.parse(
        localStorage.getItem('splitify_store_friendships') || '[]'
      );
      expect(remaining).toHaveLength(0);
    });
  });
});
