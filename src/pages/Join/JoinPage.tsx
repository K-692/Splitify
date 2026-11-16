import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { SplitifyEvent, EventInvitationLink, EventSlot, EventMember } from '@/types';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { getFirstName } from '@/utils/name';
import {
  CheckCircle,
  AlertCircle,
  Shield,
  ArrowRight,
  LogIn,
  UserPlus,
  UserCheck,
} from 'lucide-react';

export const JoinPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<EventInvitationLink | null>(null);
  const [event, setEvent] = useState<SplitifyEvent | null>(null);

  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [joinMode, setJoinMode] = useState<'claim' | 'new_slot'>('claim');
  const [customSlotName, setCustomSlotName] = useState<string>('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (user && !customSlotName) {
      setCustomSlotName(getFirstName(user.displayName));
    }
  }, [user]);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function validateLink() {
      try {
        setLoading(true);
        setError(null);
        const link = await dataService.getInvitationLinkByToken(token!);
        if (!isMounted) return;

        if (!link) {
          setError('This invitation link does not exist or has expired.');
          setLoading(false);
          return;
        }

        if (link.revoked) {
          setError('This invitation link has been revoked by the event host.');
          setLoading(false);
          return;
        }

        if (link.expiresAt && link.expiresAt < Date.now()) {
          setError('This invitation link has expired.');
          setLoading(false);
          return;
        }

        if (link.maxUses && link.usesCount >= link.maxUses) {
          setError('This invitation link has reached its maximum uses limit.');
          setLoading(false);
          return;
        }

        setInvitationLink(link);

        // Fetch associated event details
        let ev: SplitifyEvent | null = null;
        try {
          ev = await dataService.getEventById(link.eventId);
        } catch {
          ev = null;
        }

        if (!isMounted) return;

        if (ev && !ev.deleted) {
          setEvent(ev);
        } else {
          // Construct preview event from invitation link metadata
          const previewSlots: Record<string, EventSlot> = {};
          if (link.availableSlots) {
            for (const s of link.availableSlots) {
              previewSlots[s.id] = {
                id: s.id,
                eventId: link.eventId,
                placeholderName: s.placeholderName,
                isClaimed: false,
                createdAt: link.createdAt,
                updatedAt: link.createdAt,
              };
            }
          }

          const fallbackMembers: Record<string, EventMember> = {};
          const count = Math.max(link.membersCount || 0, 1);
          for (let i = 0; i < count; i++) {
            fallbackMembers[`member_${i}`] = {
              uid: `member_${i}`,
              displayName: i === 0 ? link.createdByName : 'Member',
              username: i === 0 ? link.createdByName.replace(/^@/, '') : `member_${i}`,
              joinedAt: link.createdAt,
              role: i === 0 ? 'host' : 'member',
            };
          }

          setEvent({
            id: link.eventId,
            name: link.eventName,
            emoji: link.eventEmoji || '🏖️',
            currency: 'INR',
            hostUid: link.createdByUid,
            members: fallbackMembers,
            slots: previewSlots,
            createdAt: link.createdAt,
            updatedAt: link.createdAt,
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to validate invitation link.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    validateLink();
    return () => {
      isMounted = false;
    };
  }, [token, user]);

  const handleGoogleLogin = async () => {
    try {
      if (token) {
        sessionStorage.setItem('splitify_auth_redirect', `/join/${token}`);
      }
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign in failed. Please try again.');
    }
  };

  const handleJoin = async () => {
    if (!token || !user || !event) return;
    setJoining(true);
    try {
      if (joinMode === 'claim' && selectedSlotId) {
        await dataService.joinEventByInvitationToken(token, user, selectedSlotId);
      } else {
        const slotName = customSlotName.trim() || getFirstName(user.displayName);
        await dataService.joinEventByInvitationToken(token, user, undefined, slotName);
      }
      navigate(`/events/${event.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to join event.');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Validating invitation link...
        </p>
      </div>
    );
  }

  if (error || !event || !invitationLink) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#15263C] rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Invalid Invitation
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {error || 'Unable to open invitation.'}
          </p>
          <Button variant="primary" onClick={() => navigate('/')} className="w-full">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const isAlreadyMember = Boolean(user && event.members && event.members[user.uid]);
  const slotsList: EventSlot[] = Object.values(event.slots || {});

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#15263C] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xl transition-all">
        {/* Event Header Banner */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-4xl shadow-md mb-4 ring-4 ring-teal-500/20">
            {event.emoji}
          </div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-2">
            Event Invitation
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#203D62] dark:text-white tracking-tight">
            {event.name}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Invited by <span className="font-bold text-slate-700 dark:text-slate-200">
              {invitationLink.createdByName.startsWith('@')
                ? invitationLink.createdByName
                : `@${invitationLink.createdByName.toLowerCase().replace(/\s+/g, '_')}`}
            </span>
          </p>
        </div>

        {/* Access Scope info */}
        <div className="bg-slate-50 dark:bg-[#0D1B2A]/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 mb-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-teal-500" />
              Access Scope
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 capitalize">
              {invitationLink.scope === 'full' ? 'Full Event Access' : 'Selected Items Only'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {invitationLink.scope === 'full'
              ? 'You will have full access to view, add, and participate in all items and settlements.'
              : 'You have been invited to participate in specific shared expenses.'}
          </p>

          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Members already joined:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">
              {Math.max(Object.keys(event.members || {}).length, invitationLink.membersCount || 0, 1)}
            </span>
          </div>
        </div>

        {/* People Joining Slots Section (Section 5.2) */}
        {slotsList.length > 0 && (
          <div className="bg-slate-50 dark:bg-[#0D1B2A]/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
              <span>👥</span> People Joining
            </h3>
            <div className="space-y-1.5">
              {slotsList.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 text-xs font-semibold"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {slot.placeholderName}
                  </span>
                  {slot.isClaimed ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-400">
                      Claimed by {slot.claimedByName || 'Member'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      Available
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unauthenticated State */}
        {!user ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
              Please sign in with Google to accept this invitation and join{' '}
              <strong className="font-bold">{event.name}</strong>.
            </div>

            <Button
              variant="primary"
              onClick={handleGoogleLogin}
              className="w-full py-3.5 text-base shadow-lg shadow-teal-500/20"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign in with Google to Join
            </Button>
          </div>
        ) : isAlreadyMember ? (
          /* User is already a member */
          <div className="text-center space-y-4">
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-200 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
              <span>You are already a member of this event!</span>
            </div>

            <Button
              variant="primary"
              onClick={() => navigate(`/events/${event.id}`)}
              className="w-full py-3.5"
            >
              Open Event
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          /* User is authenticated and ready to join */
          <div className="space-y-5">
            {/* Slot Claiming or Create New Slot to Join */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 block">
                How would you like to join?
              </label>

              <div className="space-y-2">
                {slotsList
                  .filter((s) => !s.isClaimed)
                  .map((slot) => {
                    const isSelected = joinMode === 'claim' && selectedSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          setJoinMode('claim');
                          setSelectedSlotId(slot.id);
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between text-xs font-bold ${
                          isSelected
                            ? 'border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-200 ring-2 ring-teal-500 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <UserCheck className="w-4 h-4 text-teal-500 flex-shrink-0" />
                          <span>Claim spot for {slot.placeholderName}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400">
                          {isSelected ? 'Selected' : 'Claim Slot'}
                        </span>
                      </button>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => {
                    setJoinMode('new_slot');
                    setSelectedSlotId('');
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between text-xs font-bold ${
                    joinMode === 'new_slot'
                      ? 'border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-200 ring-2 ring-teal-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <UserPlus className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span>Create a New Slot to Join</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    {joinMode === 'new_slot' ? 'Selected' : 'New Slot'}
                  </span>
                </button>
              </div>

              {/* Slot Name input if creating a new slot */}
              {joinMode === 'new_slot' && (
                <div className="mt-3 p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 space-y-2 animate-in fade-in">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                    Person / Slot Name for Event:
                  </label>
                  <input
                    type="text"
                    value={customSlotName}
                    onChange={(e) => setCustomSlotName(e.target.value)}
                    placeholder="Enter your name (e.g. Rahul, Priya)..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    A dedicated person slot will be created under the event and shown in the event's people list.
                  </p>
                </div>
              )}
            </div>

            {/* Current user confirmation info */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <Avatar src={user.photoURL} name={getFirstName(user.displayName)} size="sm" />
              <div className="flex flex-col text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Joining as {getFirstName(user.displayName)}
                </span>
                <span className="text-slate-400">{user.email}</span>
              </div>
            </div>

            {/* Join Event button */}
            <Button
              variant="primary"
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3.5 text-base shadow-xl shadow-teal-500/20"
            >
              {joining ? 'Joining Event...' : 'Join Event'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
