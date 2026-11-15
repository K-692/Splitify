import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { SplitifyEvent, Friendship, UserProfile, EventInvitationLink } from '@/types';
import { dataService } from '@/services/dataService';
import { Avatar } from '@/components/common/Avatar';
import { Copy, Check, UserPlus, Users, Link as LinkIcon } from 'lucide-react';

interface InviteFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SplitifyEvent;
  currentUser: UserProfile;
}

export const InviteFriendModal: React.FC<InviteFriendModalProps> = ({
  isOpen,
  onClose,
  event,
  currentUser,
}) => {
  const [, setFriendships] = useState<Friendship[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [invitationLink, setInvitationLink] = useState<EventInvitationLink | null>(null);
  const [invitingUid, setInvitingUid] = useState<string | null>(null);
  const [invitedUids, setInvitedUids] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    let isCurrent = true;

    dataService.createInvitationLink(event.id, currentUser).then((link) => {
      if (isCurrent) setInvitationLink(link);
    });

    const unsub = dataService.subscribeFriends(currentUser.uid, async (list) => {
      setFriendships(list);
      const friendUids = list.map((fs) => (fs.user1Uid === currentUser.uid ? fs.user2Uid : fs.user1Uid));
      const profileMap = await dataService.getUsersByUids(friendUids);
      if (!isCurrent) return;

      const profiles: UserProfile[] = [];
      const seenUids = new Set<string>();
      for (const uid of friendUids) {
        if (!seenUids.has(uid) && profileMap[uid]) {
          seenUids.add(uid);
          profiles.push(profileMap[uid]);
        }
      }
      setFriendProfiles(profiles);
      setLoading(false);
    });

    return () => {
      isCurrent = false;
      unsub();
    };
  }, [isOpen, event.id, currentUser]);

  const origin = window?.location?.origin || 'https://k-692.github.io';
  const cleanBase = `${origin}/Splitify`;
  const inviteUrl = invitationLink
    ? `${cleanBase}/join/${invitationLink.token}`
    : `${cleanBase}/events/${event.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async (friend: UserProfile) => {
    setInvitingUid(friend.uid);
    setStatusMessage(null);
    try {
      await dataService.sendEventInvitation(event, currentUser, friend);
      setInvitedUids((prev) => ({ ...prev, [friend.uid]: true }));
      setStatusMessage(`Invitation sent to ${friend.displayName}!`);
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to send invitation');
    } finally {
      setInvitingUid(null);
    }
  };

  const nonMemberFriends = friendProfiles.filter((f) => !event.members[f.uid]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Friends" emoji="🤝" maxWidth="md">
      <div className="space-y-5">
        {/* Share Invitation Link */}
        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5" /> Event Invitation Link
            </span>
            <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate mt-0.5 select-all">
              {inviteUrl}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            leftIcon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>

        {statusMessage && (
          <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold">
            {statusMessage}
          </div>
        )}

        {/* Existing Friends List */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-teal-500" />
            Your Friends
          </h4>

          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400">Loading friends...</div>
          ) : nonMemberFriends.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              {friendProfiles.length === 0
                ? "You haven't added any friends on Splitify yet. Add friends from the Friends tab!"
                : 'All your friends are already members of this event! 🎉'}
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {nonMemberFriends.map((friend) => (
                <div
                  key={friend.uid}
                  className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-slate-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={friend.photoURL} name={friend.displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {friend.displayName}
                      </p>
                      <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 truncate">
                        @{friend.username}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={invitedUids[friend.uid] ? 'outline' : 'primary'}
                    size="sm"
                    disabled={Boolean(invitedUids[friend.uid])}
                    onClick={() => handleInvite(friend)}
                    isLoading={invitingUid === friend.uid}
                    leftIcon={
                      invitedUids[friend.uid] ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {invitedUids[friend.uid] ? 'Invited' : 'Invite'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
