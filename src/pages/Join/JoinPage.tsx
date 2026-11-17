import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { SplitifyEvent, EventInvitationLink, EventSlot, EventMember } from '@/types';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { getFirstName } from '@/utils/name';
import { NetworkStatusBanner } from '@/components/common/NetworkStatusBanner';
import { useAndroidNativeBridge } from '@/hooks/useAndroidNativeBridge';
import {
  CheckCircle,
  AlertCircle,
  Shield,
  ArrowRight,
  LogIn,
  UserPlus,
} from 'lucide-react';

export const JoinPage: React.FC = () => {
  useAndroidNativeBridge();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<EventInvitationLink | null>(null);
  const [event, setEvent] = useState<SplitifyEvent | null>(null);

  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [joinMode, setJoinMode] = useState<'claim' | 'new_slot' | null>(null);
  const [customSlotName, setCustomSlotName] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [joinHint, setJoinHint] = useState<string | null>(null);

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
    if (!canJoin) {
      setJoinHint('Select your name from the list, or add yourself as a new person.');
      return;
    }
    setJoining(true);
    setJoinHint(null);
    try {
      if (joinMode === 'claim') {
        await dataService.joinEventByInvitationToken(token, user, selectedSlotId);
      } else {
        await dataService.joinEventByInvitationToken(token, user, undefined, customSlotName.trim());
      }
      navigate(`/events/${event.id}`);
    } catch (err: any) {
      console.error(err);
      setJoinHint(err.message || 'Failed to join event.');
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
  const slotsList: EventSlot[] = Object.values(event.slots || {}).sort((a, b) =>
    a.isClaimed === b.isClaimed
      ? (a.placeholderName || '').localeCompare(b.placeholderName || '')
      : a.isClaimed
      ? 1
      : -1
  );
  const availableSlots = slotsList.filter((sl) => !sl.isClaimed);
  const claimedUids = new Set(slotsList.filter((sl) => sl.isClaimed).map((sl) => sl.claimedByUid));
  const membersWithoutSlot = Object.values(event.members || {}).filter(
    (m) => !claimedUids.has(m.uid) && !m.uid.startsWith('member_')
  );
  const trimmedNewName = customSlotName.trim();
  const duplicateOfAvailable = trimmedNewName
    ? availableSlots.find(
        (sl) => (sl.placeholderName || '').trim().toLowerCase() === trimmedNewName.toLowerCase()
      )
    : undefined;
  const canJoin =
    (joinMode === 'claim' && Boolean(selectedSlotId)) ||
    (joinMode === 'new_slot' && Boolean(trimmedNewName) && !duplicateOfAvailable);
  const memberNameFor = (sl: EventSlot) => {
    const m = sl.claimedByUid ? event.members?.[sl.claimedByUid] : undefined;
    return m ? getFirstName(m.displayName) : sl.claimedByName || 'a member';
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <NetworkStatusBanner />
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
              {invitationLink.createdByName.replace(/^@/, '')}
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

        {/* Everyone in this event — shown before and after sign-in */}
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            {user && !isAlreadyMember ? 'Who are you in this event?' : 'People in this event'}
          </h3>
          {user && !isAlreadyMember && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
              If your name is already listed, select it so the expenses already added for you are linked to your account.
            </p>
          )}
          <div className="space-y-1.5">
            {slotsList.map((slot) => {
              const selectable = Boolean(user) && !isAlreadyMember && !slot.isClaimed;
              const isSelected = joinMode === 'claim' && selectedSlotId === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!selectable}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setJoinMode('claim');
                    setSelectedSlotId(slot.id);
                    setJoinHint(null);
                  }}
                  className={`w-full flex items-center justify-between gap-2 p-3 rounded-2xl border text-left text-xs transition-all ${
                    isSelected
                      ? 'border-teal-500 bg-teal-500/10 ring-2 ring-teal-500'
                      : slot.isClaimed
                      ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 opacity-70 cursor-default'
                      : selectable
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-teal-400'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 cursor-default'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-teal-500 bg-teal-500' : 'border-slate-300 dark:border-slate-600'
                      } ${slot.isClaimed ? 'invisible' : ''}`}
                    >
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {slot.placeholderName}
                    </span>
                  </span>
                  {slot.isClaimed ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex-shrink-0 truncate max-w-[50%]">
                      Joined as {memberNameFor(slot)}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                      {isSelected ? 'This is me' : 'Available'}
                    </span>
                  )}
                </button>
              );
            })}
            {membersWithoutSlot.map((m) => (
              <div
                key={m.uid}
                className="w-full flex items-center justify-between gap-2 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 opacity-70 text-xs"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={m.photoURL} name={getFirstName(m.displayName)} size="xs" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                    {getFirstName(m.displayName)}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex-shrink-0">
                  {m.role === 'host' ? 'Host' : 'Joined'}
                </span>
              </div>
            ))}
            {slotsList.length === 0 && membersWithoutSlot.length === 0 && (
              <p className="text-xs text-slate-400 italic">No people added yet.</p>
            )}
          </div>
        </div>

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
            {/* Not on the list: add a new person */}
            <div>
              <button
                type="button"
                aria-pressed={joinMode === 'new_slot'}
                onClick={() => {
                  setJoinMode('new_slot');
                  setSelectedSlotId('');
                  setJoinHint(null);
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 text-xs font-bold ${
                  joinMode === 'new_slot'
                    ? 'border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-200 ring-2 ring-teal-500'
                    : 'border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-400 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <UserPlus className="w-4 h-4 text-teal-500 flex-shrink-0" />
                  <span className="truncate">Not listed? Add me as a new person</span>
                </span>
              </button>

              {joinMode === 'new_slot' && (
                <div className="mt-2.5 p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
                  <label htmlFor="join-new-name" className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block">
                    Your name in this event
                  </label>
                  <input
                    id="join-new-name"
                    type="text"
                    value={customSlotName}
                    onChange={(e) => {
                      setCustomSlotName(e.target.value);
                      setJoinHint(null);
                    }}
                    placeholder="e.g. Rahul"
                    maxLength={40}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  {duplicateOfAvailable ? (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      "{duplicateOfAvailable.placeholderName}" is already on the list.{' '}
                      <button
                        type="button"
                        className="underline font-bold"
                        onClick={() => {
                          setJoinMode('claim');
                          setSelectedSlotId(duplicateOfAvailable.id);
                        }}
                      >
                        Select it instead
                      </button>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      A new person will be added to the event under this name.
                    </p>
                  )}
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

            {joinHint && (
              <p role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {joinHint}
              </p>
            )}

            {/* Join Event button */}
            <Button
              variant="primary"
              onClick={handleJoin}
              disabled={joining || !canJoin}
              className="w-full py-3.5 text-base shadow-xl shadow-teal-500/20"
            >
              {joining
                ? 'Joining Event...'
                : joinMode === 'claim' && selectedSlotId
                ? `Join as ${event.slots?.[selectedSlotId]?.placeholderName || 'selected person'}`
                : joinMode === 'new_slot' && trimmedNewName && !duplicateOfAvailable
                ? `Join as ${trimmedNewName}`
                : 'Select your name to join'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
