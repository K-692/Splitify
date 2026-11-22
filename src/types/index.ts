export type SplitMode = 'equal' | 'amount';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  username?: string; // Optional legacy handle
  createdAt: number;
  updatedAt?: number;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    currency?: string;
  };
  discoverable?: boolean;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromDisplayName: string;
  fromUsername?: string;
  fromPhotoURL?: string;
  toDisplayName?: string;
  toUsername?: string;
  toPhotoURL?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}

export interface Friendship {
  id: string;
  user1Uid: string;
  user2Uid: string;
  createdAt: number;
  requestId?: string;
}

export interface EventMember {
  uid: string;
  displayName: string;
  photoURL?: string;
  username?: string;
  joinedAt: number;
  role: 'host' | 'member';
  slotId?: string; // Assigned slot in the event, if any
  scope?: 'full' | 'selected_items'; // Access scope
  allowedItemIds?: string[]; // Specific items authorized for selected_items scope
  hidden?: boolean; // This member has hidden the event from their Home screen
  hiddenAt?: number;
}

export interface EventSlot {
  id: string;
  eventId: string;
  placeholderName: string; // The person's expected name (e.g. "Rahul", "Aman")
  expectedUid?: string; // If selected from existing friends
  isClaimed: boolean;
  claimedByUid?: string; // UID of the authenticated user who claimed it
  claimedByName?: string; // First name / display name of claimant
  claimedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface EventInvitationLink {
  id: string;
  token: string; // Unique URL token
  eventId: string;
  eventName: string;
  eventEmoji: string;
  createdByUid: string;
  createdByName: string;
  createdAt: number;
  scope: 'full' | 'selected_items';
  allowedItemIds?: string[]; // Item IDs allowed if scope === 'selected_items'
  availableSlots?: Array<{ id: string; placeholderName: string }>;
  revoked?: boolean;
  maxUses?: number;
  usesCount: number;
  expiresAt?: number;
  membersCount?: number;
}

export interface SplitifyEvent {
  id: string;
  name: string;
  emoji: string;
  currency: string; // default "INR" (₹)
  members: Record<string, EventMember>;
  slots?: Record<string, EventSlot>;
  hostUid: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
}

export interface EventInvitation {
  id: string;
  eventId: string;
  eventName: string;
  eventEmoji: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  scope?: 'full' | 'selected_items';
  allowedItemIds?: string[];
}

/**
 * An EventItem can be:
 * 1. A standalone expense (isCategory === false/undefined), containing costMinor, paidBy, splitBy, etc.
 * 2. A category (isCategory === true), whose total is computed dynamically from its subitems in ExpenseEntry.
 * 3. The system-generated Settlements item (isSettlementsItem === true).
 */
export interface EventItem {
  id: string;
  eventId: string;
  name: string;
  emoji: string;
  isCategory?: boolean; // When true, acts as a category with subitems
  isSettlementsItem?: boolean;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;

  // Direct expense properties (when isCategory is false/undefined)
  costMinor?: number; // Integer minor currency units (paise/cents: 100000 = 1000.00)
  expenseDate?: string; // Calendar date in "YYYY-MM-DD" format
  expenseTime?: string; // Time in "HH:mm" format
  occurredAt?: number; // UTC timestamp of expense occurrence
  paidBy?: string; // UID of payer
  splitBy?: SplitMode;
  participants?: string[]; // UIDs of participants
  shares?: Record<string, number>; // UID -> minor unit amount
  comment?: string;
  createdBy?: string;
  createdByName?: string;
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  lastModifiedAt?: number;
}

export interface ExpenseEntry {
  id: string;
  eventId: string;
  itemId: string; // Belongs to parent category item
  name: string;
  emoji: string;
  costMinor: number; // Stored in minor currency units (paise/cents: 100000 = 1000.00)
  expenseDate?: string; // Calendar date in "YYYY-MM-DD" format
  expenseTime?: string; // Time in "HH:mm" format
  occurredAt?: number; // UTC timestamp of expense occurrence
  paidBy: string; // UID of payer
  splitBy: SplitMode;
  participants: string[]; // UIDs of participants
  shares: Record<string, number>; // UID -> minor unit amount
  comment?: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  lastModifiedAt?: number;
  deleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
}

export type PaymentStatus = 'awaiting_confirmation' | 'completed' | 'rejected';

/** Part of a payment that the payer linked to one expense entry they share in. */
export interface PaymentAllocation {
  entryId: string; // standalone item id or sub-item (expense) id
  itemName: string;
  amountMinor: number;
  occurredAt?: number; // when the expense happened, to tell same-named items apart
}

export interface PaymentConfirmation {
  id: string;
  eventId: string;
  debtorUid: string;
  debtorName: string;
  creditorUid: string;
  creditorName: string;
  amountMinor: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentNote?: string;
  paidDate: string; // "YYYY-MM-DD"
  paidTime: string; // "HH:mm" or "10:30 PM"
  occurredAt: number; // UTC timestamp of payment
  status: PaymentStatus;
  allocations?: PaymentAllocation[];
  createdAt: number;
  confirmedAt?: number;
  confirmedByUid?: string;
  rejectedAt?: number;
  rejectedByUid?: string;
  rejectionReason?: string;
}

export interface SettlementEntry {
  id: string;
  eventId: string;
  itemId?: string; // ID of the system-generated 💸 Settlements item if applicable
  paymentConfirmationId?: string;
  payerUid: string;
  payerName: string;
  receiverUid: string;
  receiverName: string;
  amountMinor: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentNote?: string;
  paidDate?: string;
  paidTime?: string;
  occurredAt?: number;
  recordedBy?: string;
  recordedByName?: string;
  createdAt: number;
  formattedTimestamp?: string;
  confirmedAt?: number;
  confirmedByUid?: string;
  status: 'completed' | 'reversed';
  note?: string;
  allocations?: PaymentAllocation[];
}

export type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'event_invitation_received'
  | 'event_invitation_accepted'
  | 'event_join_request_received'
  | 'expense_created'
  | 'expense_modified'
  | 'expense_deleted'
  | 'event_name_modified'
  | 'settlement_recorded'
  | 'payment_reminder'
  | 'payment_marked_paid'
  | 'payment_confirmation_required'
  | 'payment_confirmed'
  | 'payment_rejected';

export interface AppNotification {
  id: string;
  recipientUid: string;
  type: NotificationType;
  senderUid: string;
  senderName: string;
  senderPhotoURL?: string;
  eventId?: string;
  eventName?: string;
  amountMinor?: number;
  paymentConfirmationId?: string;
  settlementId?: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: number;
  actionData?: Record<string, any>;
}

// Financial Calculation Types
export interface MemberFinancialSummary {
  uid: string;
  displayName: string;
  photoURL?: string;
  username?: string;
  spentMinor: number; // Total amount paid out-of-pocket
  shareMinor: number; // Total fair share allocated to this member
  settledPaidMinor: number; // Settlements paid out to others
  settledReceivedMinor: number; // Settlements received from others
  netBalanceMinor: number; // Positive = get back, Negative = owes, 0 = settled
}

export interface SettlementSuggestion {
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  amountMinor: number;
}

export interface EventFinancialOverview {
  totalExpenseMinor: number;
  currentUserSpentMinor: number;
  currentUserShareMinor: number;
  currentUserNetBalanceMinor: number;
  memberSummaries: Record<string, MemberFinancialSummary>;
  settlementSuggestions: SettlementSuggestion[];
  isBalanced: boolean; // checks sum(netBalanceMinor) === 0
}
