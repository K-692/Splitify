import React, { useState, useEffect } from 'react';
import { SplitifyEvent, EventInvitationLink } from '@/types';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Copy, Check, Link as LinkIcon, ShieldCheck } from 'lucide-react';

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
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
            <LinkIcon className="w-3.5 h-3.5" /> Invitation Link
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
