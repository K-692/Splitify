import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { useNotifications } from '@/app/providers/NotificationContext';
import { EventInvitation, FriendRequest } from '@/types';
import { dataService } from '@/services/dataService';
import { Button } from '@/components/common/Button';
import { FriendRequestActions } from '@/components/friends/FriendRequestActions';
import { formatTimeAgo } from '@/utils/date';
import {
  Bell,
  CheckCheck,
  Calendar,
  Check,
  ChevronRight,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [receivedFriendRequests, setReceivedFriendRequests] = useState<FriendRequest[]>([]);
  const [filterUnread, setFilterUnread] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubInvites = dataService.subscribeEventInvitations(user.uid, (list) => {
      setInvitations(list);
    });
    const unsubRequests = dataService.subscribeFriendRequests(user.uid, (received) => {
      setReceivedFriendRequests(received);
    });
    return () => {
      unsubInvites();
      unsubRequests();
    };
  }, [user]);

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_reminder':
        return <span className="text-xl">🔔</span>;
      case 'settlement_recorded':
      case 'payment_confirmed':
        return <span className="text-xl">💸</span>;
      case 'payment_confirmation_required':
      case 'payment_marked_paid':
        return <span className="text-xl">⏳</span>;
      case 'payment_rejected':
        return <span className="text-xl">❌</span>;
      case 'event_invitation_received':
      case 'event_invitation_accepted':
        return <span className="text-xl">🏖️</span>;
      case 'friend_request_received':
      case 'friend_request_accepted':
        return <span className="text-xl">🤝</span>;
      case 'expense_created':
      case 'expense_modified':
      case 'expense_deleted':
        return <span className="text-xl">🧾</span>;
      default:
        return <span className="text-xl">📌</span>;
    }
  };

  const filtered = filterUnread ? notifications.filter((n) => !n.read) : notifications;

  if (!user) return null;

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#203D62] dark:text-white tracking-tight flex items-center gap-2">
            <span>🔔</span> Notifications & Activity
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Real-time alerts, payment reminders, event invitations & friendship updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              leftIcon={<CheckCheck className="w-4 h-4 text-teal-500" />}
            >
              Mark all read ({unreadCount})
            </Button>
          )}

          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterUnread
                ? 'bg-teal-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {filterUnread ? 'Showing Unread' : 'Filter Unread'}
          </button>
        </div>
      </div>

      {/* Pending Event Invitations Banner */}
      {invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-teal-500" />
            Pending Event Invitations ({invitations.length})
          </h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-3xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{inv.eventEmoji || '🏖️'}</span>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Invitation to &quot;{inv.eventName}&quot;
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Invited by <strong>{inv.fromDisplayName}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleRespondInvitation(inv, true)}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Accept & Join
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRespondInvitation(inv, false)}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-[#15263C] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white mt-3">
              No notifications
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {filterUnread
                ? 'You have caught up with all your notifications!'
                : 'Expense changes, settlements, and invitations will appear here in real time.'}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const matchingReq =
              item.type === 'friend_request_received'
                ? receivedFriendRequests.find(
                    (r) => r.id === item.actionData?.requestId || r.fromUid === item.senderUid
                  )
                : null;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.read) markAsRead(item.id);
                  if (item.eventId) {
                    navigate(
                      item.type === 'payment_confirmation_required'
                        ? `/events/${item.eventId}?tab=balances`
                        : `/events/${item.eventId}`
                    );
                  }
                }}
                className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  !item.read
                    ? 'bg-white dark:bg-[#15263C] border-teal-500/40 shadow-sm ring-1 ring-teal-500/20'
                    : 'bg-white/70 dark:bg-[#15263C]/60 border-slate-100 dark:border-slate-800/80 hover:bg-white dark:hover:bg-[#15263C]'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(item.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                      {item.description}
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actionable button areas */}
                <div className="flex items-center gap-2 flex-shrink-0 self-center">
                  {item.type === 'friend_request_received' && (
                    matchingReq ? (
                      <FriendRequestActions requestId={matchingReq.id} size="sm" />
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Handled</span>
                    )
                  )}

                  {item.type === 'payment_confirmation_required' && item.eventId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!item.read) markAsRead(item.id);
                        navigate(`/events/${item.eventId}?tab=balances`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs shadow-sm transition-transform active:scale-95"
                    >
                      Settle Now
                    </button>
                  )}

                  {item.eventId && item.type !== 'payment_confirmation_required' && item.type !== 'friend_request_received' && (
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-teal-500 flex-shrink-0"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
