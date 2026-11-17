import { EventMember, EventSlot } from '@/types';

const memberName = (m: EventMember): string =>
  m.displayName || (m.username ? m.username.replace(/^@/, '') : '') || 'Member';

/**
 * Resolves any person id used in an event (member uid or person-slot id) to a
 * human-readable name. Claimed slots resolve to the member who claimed them;
 * unclaimed slots show their placeholder name with a "(Pending)" suffix.
 */
export function resolvePersonName(
  id: string | undefined,
  members: Record<string, EventMember> | undefined,
  slots: Record<string, EventSlot> | undefined,
  options: { pendingSuffix?: boolean } = {}
): string {
  const { pendingSuffix = true } = options;
  if (!id) return 'Unknown';
  const member = members?.[id];
  if (member) return memberName(member);
  const slot = slots?.[id];
  if (slot) {
    if (slot.isClaimed) {
      const claimer = slot.claimedByUid ? members?.[slot.claimedByUid] : undefined;
      if (claimer) return memberName(claimer);
      return slot.claimedByName || slot.placeholderName || 'Member';
    }
    const name = slot.placeholderName || 'Guest';
    return pendingSuffix ? `${name} (Pending)` : name;
  }
  return id.startsWith('slot_') ? 'Removed person' : id.replace(/^@/, '');
}

export function resolvePersonPhoto(
  id: string | undefined,
  members: Record<string, EventMember> | undefined,
  slots: Record<string, EventSlot> | undefined
): string | undefined {
  if (!id) return undefined;
  if (members?.[id]) return members[id].photoURL;
  const slot = slots?.[id];
  if (slot?.isClaimed && slot.claimedByUid) return members?.[slot.claimedByUid]?.photoURL;
  return undefined;
}

/** True when the given id (uid or slot id) refers to the current user. */
export function isSamePerson(
  id: string,
  uid: string,
  slots: Record<string, EventSlot> | undefined
): boolean {
  if (id === uid) return true;
  const slot = slots?.[id];
  return Boolean(slot?.isClaimed && slot.claimedByUid === uid);
}
