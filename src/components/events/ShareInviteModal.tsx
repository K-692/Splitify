import React, { useState, useEffect } from 'react';
import { SplitifyEvent, EventInvitationLink, UserProfile, Friendship } from '@/types';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { getFirstName } from '@/utils/name';
import {
  Copy,
  Check,
  Link as LinkIcon,
  ShieldCheck,
  Users,
  UserPlus,
  CheckCircle,
} from 'lucide-react';

interface ShareInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SplitifyEvent;
}

export const ShareInviteModal: React.FC<ShareInviteModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const { user } = useAuth();
  const [currentLink, setCurrentLink] = useState<EventInvitationLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Friends state
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [invitingUid, setInvitingUid] = useState<string | null>(null);
  const [invitedUids, setInvitedUids] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Generate / retrieve a full-access invitation link
  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    async function generateLink() {
      try {
        setLoading(true);
        setError(null);
        const link = await dataService.createInvitationLink(event.id, user!, {
          scope: 'full',
          allowedItemIds: [],
        });
        if (isMounted) {
          setCurrentLink(link);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to generate invitation link');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    generateLink();
    return () => {
      isMounted = false;
    };
  }, [isOpen, event.id, user]);

  // Load friends for direct invitations
  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    setLoadingFriends(true);

    const unsub = dataService.subscribeFriends(user.uid, async (friendships: Friendship[]) => {
      const friendUids = friendships.map((fs) =>
        fs.user1Uid === user.uid ? fs.user2Uid : fs.user1Uid
      );

      try {
        const profileMap = await dataService.getUsersByUids(friendUids);
        if (!isMounted) return;

        const profiles: UserProfile[] = [];
        const seenUids = new Set<string>();
        for (const uid of friendUids) {
          if (!seenUids.has(uid) && profileMap[uid]) {
            seenUids.add(uid);
            profiles.push(profileMap[uid]);
          }
        }
        setFriendProfiles(profiles);
      } catch (err) {
        console.error('Error loading friends for invite modal:', err);
      } finally {
        if (isMounted) setLoadingFriends(false);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const origin = window?.location?.origin || 'https://k-692.github.io';
  const cleanBase = `${origin}/Splitify`;
  const inviteUrl = currentLink
    ? `${cleanBase}/join/${currentLink.token}`
    : `${cleanBase}/events/${event.id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleInviteFriend = async (friend: UserProfile) => {
    if (!user) return;
    setInvitingUid(friend.uid);
    setStatusMessage(null);
    try {
      await dataService.sendEventInvitation(event, user, {
        uid: friend.uid,
        displayName: friend.displayName,
      });
      setInvitedUids((prev) => ({ ...prev, [friend.uid]: true }));
      setStatusMessage(`✓ Invitation sent to ${getFirstName(friend.displayName)}!`);
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to send invitation.');
    } finally {
      setInvitingUid(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invite to ${event.name}`}
      emoji={event.emoji}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Full Access Info Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-900 dark:text-teal-200">
          <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Full Access:</strong> Anyone joining through this link will have full access to
            view, add, and split all expenses in this event.
          </p>
        </div>

        {/* Link Output Box */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" /> INVITATION LINK
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 truncate select-all">
              {loading ? 'Generating link...' : inviteUrl}
            </div>
            <Button
              variant={copied ? 'teal' : 'primary'}
              size="md"
              onClick={handleCopy}
              className="flex-shrink-0 font-bold"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1 text-white" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy Link
                </>
              )}
            </Button>
          </div>
          {copied && (
            <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 mt-1">
              ✓ Link copied to clipboard! Share it with friends.
            </p>
          )}
        </div>

        {/* Status Feedback Message */}
        {statusMessage && (
          <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Invite Splitify Friends Section */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-500" /> Invite Friends
            </label>
            <span className="text-[11px] text-slate-400 font-semibold">
              {friendProfiles.length} {friendProfiles.length === 1 ? 'friend' : 'friends'}
            </span>
          </div>

          {loadingFriends ? (
            <div className="text-center py-6 text-xs text-slate-400 font-semibold">
              Loading friends...
            </div>
          ) : friendProfiles.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
              <p className="font-bold">No friends added on Splitify yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Add friends from the Friends tab, or copy and share the invitation link above!
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {friendProfiles.map((friend) => {
                const isMember = Boolean(event.members && event.members[friend.uid]);
                const isInvited = Boolean(invitedUids[friend.uid]);

                return (
                  <div
                    key={friend.uid}
                    className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={friend.photoURL}
                        name={friend.displayName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {friend.displayName}
                        </p>
                        <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 truncate">
                          @{friend.username}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isMember ? (
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Joined
                        </span>
                      ) : isInvited ? (
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 inline-flex items-center gap-1">
                          <Check className="w-3 h-3 text-teal-500" /> Invited
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={invitingUid === friend.uid}
                          onClick={() => handleInviteFriend(friend)}
                          className="text-xs font-bold"
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" />
                          Invite
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
