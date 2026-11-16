import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { Friendship, FriendRequest, UserProfile, EventInvitation } from '@/types';
import { dataService } from '@/services/dataService';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { FriendRequestActions } from '@/components/friends/FriendRequestActions';
import { getFirstName } from '@/utils/name';
import { isFriendRequestOnCooldown, setFriendRequestCooldown } from '@/utils/cooldown';
import {
  Users,
  UserPlus,
  Check,
  X,
  UserCheck,
  AlertCircle,
  Clock,
  Trash2,
  Calendar,
  Mail,
  Send,
} from 'lucide-react';

export const FriendsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'invitations'>('friends');
  const [requestSubTab, setRequestSubTab] = useState<'received' | 'sent'>('received');
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [eventInvitations, setEventInvitations] = useState<EventInvitation[]>([]);
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

    const unsubInvites = dataService.subscribeEventInvitations(user.uid, (invites) => {
      setEventInvitations(invites);
    });

    let isCurrent = true;
    const unsubFriends = dataService.subscribeFriends(user.uid, async (list) => {
      setFriendships(list);
      // Fetch user profile for each friend by UID
      const friendUids = list.map((fs) => (fs.user1Uid === user.uid ? fs.user2Uid : fs.user1Uid));
      const profileMap = await dataService.getUsersByUids(friendUids);
      if (!isCurrent) return;

      const profiles: UserProfile[] = [];
      const seenUids = new Set<string>();
      for (const uid of friendUids) {
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          if (profileMap[uid]) {
            profiles.push(profileMap[uid]);
          } else {
            profiles.push({
              uid,
              displayName: 'Splitify Friend',
              username: 'friend',
              email: '',
              createdAt: Date.now(),
            });
          }
        }
      }
      setFriendProfiles(profiles);
      setLoading(false);
    });

    return () => {
      isCurrent = false;
      unsubRequests();
      unsubInvites();
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
      setFriendRequestCooldown(targetUser.uid);
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

  const handleCancelRequest = async (requestId: string) => {
    try {
      await dataService.cancelFriendRequest(requestId);
    } catch (err: any) {
      alert(err.message || 'Error cancelling request');
    }
  };

  const handleRespondInvitation = async (invitation: EventInvitation, accept: boolean) => {
    if (!user) return;
    try {
      await dataService.respondToEventInvitation(invitation, accept, user);
      if (accept) {
        navigate(`/events/${invitation.eventId}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error responding to event invitation');
    }
  };

  const formatInvitationDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return new Date(timestamp).toLocaleString();
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
          <span>🤝</span> Friends
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Search for friends by their unique Splitify username and manage your friendships and event invitations
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
              onChange={(e) => setSearchUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full pl-8 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSearching}
            disabled={!searchUsername.trim()}
          >
            Search
          </Button>
        </form>

        {/* Feedback Messages */}
        {actionError && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Search Result Card */}
        {searchAttempted && !isSearching && (
          <div className="mt-4">
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
                ) : receivedRequests.some((r) => r.fromUid === searchResult.uid) ? (
                  <FriendRequestActions
                    requestId={receivedRequests.find((r) => r.fromUid === searchResult.uid)!.id}
                  />
                ) : (sentRequests.some((r) => r.toUid === searchResult.uid) || isFriendRequestOnCooldown(searchResult.uid)) ? (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1 rounded-xl flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Request sent
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
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
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
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'requests'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Friend Requests</span>
          {receivedRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#F36B2C] text-white font-black">
              {receivedRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'invitations'
              ? 'bg-[#203D62] text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Event Invitations</span>
          {eventInvitations.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-500 text-white font-black">
              {eventInvitations.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: MY FRIENDS */}
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
                    className="p-3.5 rounded-3xl bg-white dark:bg-[#15263C] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 hover:border-teal-500/20 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={friend.photoURL}
                        name={friend.displayName}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {getFirstName(friend.displayName)}
                          </p>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-teal-500/10 text-teal-600 dark:text-teal-400">
                            Friend
                          </span>
                        </div>
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

      {/* TAB 2: FRIEND REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Sub-Tabs: Received vs Sent */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRequestSubTab('received')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                requestSubTab === 'received'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Received</span>
              {receivedRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-teal-600 font-black">
                  {receivedRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setRequestSubTab('sent')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                requestSubTab === 'sent'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Sent ({sentRequests.length})</span>
            </button>
          </div>

          {/* Sub-tab: Received Requests */}
          {requestSubTab === 'received' && (
            <div className="space-y-3">
              {receivedRequests.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
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

                    <FriendRequestActions requestId={req.id} />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-tab: Sent Requests */}
          {requestSubTab === 'sent' && (
            <div className="space-y-3">
              {sentRequests.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
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
      )}

      {/* TAB 3: EVENT INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="space-y-3">
          {eventInvitations.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white mt-2">
                No event invitations
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                When friends invite you to join an event, their invitations will appear right here!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {eventInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-5 rounded-3xl bg-white dark:bg-[#15263C] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-4 hover:border-teal-500/20 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl p-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
                      {inv.eventEmoji || '🏖️'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                        {inv.eventName}
                      </h4>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                        Invited by <strong className="text-teal-600 dark:text-teal-400">{getFirstName(inv.fromDisplayName)}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">
                        {formatInvitationDate(inv.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onClick={() => handleRespondInvitation(inv, true)}
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-rose-500"
                      onClick={() => handleRespondInvitation(inv, false)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
