import React, { useState, useEffect } from 'react';
import { SplitifyEvent, EventItem, EventInvitationLink } from '@/types';
import { useAuth } from '@/app/providers/AuthContext';
import { dataService } from '@/services/dataService';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import {
  Copy,
  Check,
  Shield,
  MessageCircle,
  Send,
  Mail,
  Smartphone,
  Layers,
} from 'lucide-react';

interface ShareInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: SplitifyEvent;
  items?: EventItem[];
}

export const ShareInviteModal: React.FC<ShareInviteModalProps> = ({
  isOpen,
  onClose,
  event,
  items = [],
}) => {
  const { user } = useAuth();
  const [scope, setScope] = useState<'full' | 'selected_items'>('full');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [currentLink, setCurrentLink] = useState<EventInvitationLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate / retrieve an invitation link whenever scope or items change
  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    async function generateLink() {
      try {
        setLoading(true);
        setError(null);
        const link = await dataService.createInvitationLink(event.id, user!, {
          scope,
          allowedItemIds: scope === 'selected_items' ? selectedItemIds : [],
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
  }, [isOpen, event.id, user, scope, selectedItemIds]);

  if (!isOpen) return null;

  const appBaseUrl = window?.location?.origin
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://k-692.github.io/Splitify/';
  const inviteUrl = currentLink
    ? `${appBaseUrl}#/join/${currentLink.token}`
    : `${appBaseUrl}#/events/${event.id}`;

  const shareText = `Join me on Splitify for "${event.emoji} ${event.name}" to view and split expenses easily!\n${inviteUrl}`;

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

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Splitify — ${event.name}`,
          text: `Join me on Splitify for "${event.emoji} ${event.name}"!`,
          url: inviteUrl,
        });
      } catch (e) {
        // User cancelled or not supported
      }
    } else {
      handleCopy();
    }
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const activeNonSettlementItems = items.filter((i) => !i.deleted && !i.isSettlementsItem);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invite to ${event.name}`}
      emoji={event.emoji}
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Scope Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Access Scope
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope('full')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                scope === 'full'
                  ? 'border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-200 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-bold">Full Access</span>
              </div>
              <p className="text-[10px] text-slate-500">Can view & participate in all expenses</p>
            </button>

            <button
              type="button"
              onClick={() => setScope('selected_items')}
              className={`p-3 rounded-2xl border text-left transition-all ${
                scope === 'selected_items'
                  ? 'border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-200 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-bold">Selected Items</span>
              </div>
              <p className="text-[10px] text-slate-500">Restrict to specific items (cab, hotel)</p>
            </button>
          </div>
        </div>

        {/* Item selection if selected_items */}
        {scope === 'selected_items' && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
              Select items visible to invitees:
            </span>
            {activeNonSettlementItems.length === 0 ? (
              <p className="text-xs text-slate-400">No items available yet in this event.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {activeNonSettlementItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={() => handleToggleItem(item.id)}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span>
                      {item.emoji} {item.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Link Output Box */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Invitation Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 truncate select-all">
              {loading ? 'Generating link...' : inviteUrl}
            </div>
            <Button
              variant={copied ? 'teal' : 'primary'}
              size="md"
              onClick={handleCopy}
              className="flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1 text-white" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
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

        {/* Social Share Shortcuts */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Share Directly
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-bold transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>

            {/* Telegram */}
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(
                inviteUrl
              )}&text=${encodeURIComponent(
                `Join "${event.emoji} ${event.name}" on Splitify to split expenses!`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] text-xs font-bold transition-all"
            >
              <Send className="w-4 h-4" />
              Telegram
            </a>

            {/* Email */}
            <a
              href={`mailto:?subject=${encodeURIComponent(
                `Splitify Invitation: ${event.name}`
              )}&body=${encodeURIComponent(shareText)}`}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>

            {/* Native Mobile Share */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 text-xs font-bold transition-all"
            >
              <Smartphone className="w-4 h-4" />
              Device Share
            </button>
          </div>
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
