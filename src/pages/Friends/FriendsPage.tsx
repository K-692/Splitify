import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { Friendship, FriendRequest, UserProfile } from '@/types';
import { dataService } from '@/services/dataService';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import {
  Users,
  UserPlus,
  Check,
  X,
  UserCheck,
  AlertCircle,
  Clock,
  Trash2,
} from 'lucide-react';

export const FriendsPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'friends' | 'received' | 'sent'>('friends');
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search user by username
  const [searchUsername, setSearchUsername] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [requestSending, setRequestSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubRequests = dataService.subscribeFriendRequests(
      user.uid,
      (received, sent) => {
        setReceivedRequests(received);
        setSentRequests(sent);
      }
    );

    const unsubFriends = dataService.subscribeFriends(user.uid, async (list) => {
      setFriendships(list);
      // Fetch user profile for each friend
      const profiles: UserProfile[] = [];
      for (const fs of list) {
        const friendUid = fs.user1Uid === user.uid ? fs.user2Uid : fs.user1Uid;
        const p = await dataService.searchUserByUsername(
          friendUid.replace('demo_user_', '')
        );
        if (p) profiles.push(p);
      }
      setFriendProfiles(profiles);
      setLoading(false);
    });

    return () => {
      unsubRequests();
      unsubFriends();
    };
  }, [user]);

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    setIsSearching(true);
    setSearchAttempted(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      const found = await dataService.searchUserByUsername(searchUsername.trim());
      setSearchResult(found);
    } catch (err: any) {
      setActionError(err.message || 'Search failed');
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async (targetUser: UserProfile) => {
    if (!user) return;
    setRequestSending(true);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await dataService.sendFriendRequest(user, targetUser);
      setSuccessMessage(`Friend request sent to @${targetUser.username}!`);
      setSearchResult(null);
      setSearchUsername('');
      setSearchAttempted(false);
    } catch (err: any) {
      setActionError(err.message || 'Could not send friend request');
    } finally {
      setRequestSending(false);
    }
  };

  const handleRespondRequest = async (requestId: string, accept: boolean) => {
    if (!user) return;
    try {
      await dataService.respondToFriendRequest(requestId, accept, user);
    } catch (err: any) {
      alert(err.message || 'Error updating friend request');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await dataService.cancelFriendRequest(requestId);
    } catch (err: any) {
      alert(err.message || 'Error cancelling request');
    }
  };

  const handleRemoveFriend = async (friendshipId: string, friendName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${friendName} from your friends?`)) {
      return;
    }
    try {
      await dataService.removeFriend(friendshipId);
    } catch (err: any) {
      alert(err.message || 'Error removing friend');
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#203D62] dark:text-white tracking-tight flex items-center gap-2">
          <span>🤝</span> Friends & Discovery
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Search for friends by their unique Splitify username and manage your friendships
        </p>
      </div>

      {/* Find Friends by Username Card */}
      <div className="bg-white dark:bg-[#15263C] rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-teal-500" />
          Find Friend by Unique Username
        </h3>

        <form onSubmit={handleSearchUser} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
              @
            </span>
            <input
              type="text"
              placeholder="e.g. rahul, priya, ananya..."
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
              required
            />
          </div>
          <Button type="submit" variant="primary" size="md" isLoading={isSearching}>
            Search
          </Button>
        </form>

        {actionError && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Search Result */}
        {searchAttempted && !isSearching && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {searchResult ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={searchResult.photoURL}
                    name={searchResult.displayName}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {searchResult.displayName}
                    </p>
                    <p className="text-xs text-teal-600 dark:text-teal-400 font-bold">
                      @{searchResult.username}
                    </p>
                  </div>
                </div>

                {searchResult.uid === user.uid ? (
                  <span className="text-xs font-bold text-slate-400">That&apos;s you!</span>
                ) : friendProfiles.some((f) => f.uid === searchResult.uid) ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <UserCheck className="w-4 h-4" /> Already Friends
                  </span>
                ) : sentRequests.some((r) => r.toUid === searchResult.uid) ? (
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Request Pending
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleSendFriendRequest(searchResult)}
                    isLoading={requestSending}
                    leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                  >
                    Add Friend
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-500 text-center py-2">
                No user found with username &quot;@{searchUsername}&quot;.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 ${
            activeTab === 'friends'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>My Friends</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
            {friendProfiles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 ${
            activeTab === 'received'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Received</span>
          {receivedRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#F36B2C] text-white font-black">
              {receivedRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 ${
            activeTab === 'sent'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Sent ({sentRequests.length})</span>
        </button>
      </div>

      {/* TAB: MY FRIENDS */}
      {activeTab === 'friends' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400">Loading friends...</div>
          ) : friendProfiles.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-2">
                No friends yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Search for another user by their Splitify username above to send a friend request!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friendProfiles.map((friend) => {
                const fs = friendships.find(
                  (f) =>
                    (f.user1Uid === user.uid && f.user2Uid === friend.uid) ||
                    (f.user2Uid === user.uid && f.user1Uid === friend.uid)
                );

                return (
                  <div
                    key={friend.uid}
                    className="p-4 rounded-3xl bg-white dark:bg-[#15263C] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={friend.photoURL}
                        name={friend.displayName}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {friend.displayName}
                        </p>
                        <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 truncate">
                          @{friend.username}
                        </p>
                      </div>
                    </div>

                    {fs && (
                      <button
                        onClick={() => handleRemoveFriend(fs.id, friend.displayName)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Remove Friend"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: RECEIVED REQUESTS */}
      {activeTab === 'received' && (
        <div className="space-y-3">
          {receivedRequests.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No pending friend requests received.
            </div>
          ) : (
            receivedRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#15263C] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={req.fromPhotoURL}
                    name={req.fromDisplayName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {req.fromDisplayName}
                    </p>
                    <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 truncate">
                      @{req.fromUsername}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Sent {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleRespondRequest(req.id, true)}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRespondRequest(req.id, false)}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: SENT REQUESTS */}
      {activeTab === 'sent' && (
        <div className="space-y-3">
          {sentRequests.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No pending sent friend requests.
            </div>
          ) : (
            sentRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#15263C] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={req.toPhotoURL}
                    name={req.toDisplayName || 'User'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {req.toDisplayName || 'User'}
                    </p>
                    <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 truncate">
                      @{req.toUsername || 'user'}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Sent {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancelRequest(req.id)}
                  leftIcon={<X className="w-3.5 h-3.5" />}
                >
                  Cancel
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
