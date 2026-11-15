import React, { useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { Check, X } from 'lucide-react';

interface FriendRequestActionsProps {
  requestId: string;
  onSuccess?: (accepted: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const FriendRequestActions: React.FC<FriendRequestActionsProps> = ({
  requestId,
  onSuccess,
  size = 'sm',
  className = '',
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<'accepted' | 'declined' | null>(null);

  const handleAction = async (accept: boolean, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!user || loading || resolvedStatus) return;

    setLoading(true);
    try {
      await dataService.respondToFriendRequest(requestId, accept, user);
      setResolvedStatus(accept ? 'accepted' : 'declined');
      if (onSuccess) {
        onSuccess(accept);
      }
    } catch (err: any) {
      alert(err.message || 'Error updating friend request');
    } finally {
      setLoading(false);
    }
  };

  if (resolvedStatus === 'accepted') {
    return (
      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <Check className="w-3.5 h-3.5" /> Accepted
      </span>
    );
  }

  if (resolvedStatus === 'declined') {
    return (
      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
        <X className="w-3.5 h-3.5" /> Declined
      </span>
    );
  }

  const isSmall = size === 'sm';

  return (
    <div className={`flex items-center gap-2 ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={loading}
        onClick={(e) => handleAction(true, e)}
        className={`inline-flex items-center justify-center gap-1 font-bold rounded-xl transition-all shadow-sm active:scale-95 ${
          isSmall
            ? 'px-3 py-1.5 text-xs bg-teal-500 hover:bg-teal-600 text-white'
            : 'px-4 py-2 text-sm bg-teal-500 hover:bg-teal-600 text-white'
        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <Check className={isSmall ? 'w-3 h-3' : 'w-4 h-4'} />
        <span>{loading ? 'Processing...' : 'Accept'}</span>
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={(e) => handleAction(false, e)}
        className={`inline-flex items-center justify-center gap-1 font-bold rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-500 dark:text-slate-400 ${
          isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <X className={isSmall ? 'w-3 h-3' : 'w-4 h-4'} />
        <span>Decline</span>
      </button>
    </div>
  );
};
