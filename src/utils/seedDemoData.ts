import { SplitifyEvent, EventItem, ExpenseEntry } from '@/types';
import { calculateEqualShares } from '@/domain/calculations/finance';
import { formatAuditTimestamp } from '@/utils/date';

export function initializeDemoDataIfEmpty(): void {
  const existingEvents = localStorage.getItem('splitify_store_events');
  if (existingEvents) return;

  const now = Date.now();
  const earlier = now - 3600000 * 24; // 1 day ago

  // 1. Demo users
  const krish = {
    uid: 'demo_user_krish',
    displayName: 'Krishnendu Pal',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    username: 'krish',
    joinedAt: earlier,
    role: 'host' as const,
  };
  const rahul = {
    uid: 'demo_user_rahul',
    displayName: 'Rahul Sharma',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    username: 'rahul',
    joinedAt: earlier,
    role: 'member' as const,
  };
  const priya = {
    uid: 'demo_user_priya',
    displayName: 'Priya Patel',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    username: 'priya',
    joinedAt: earlier,
    role: 'member' as const,
  };

  // 2. Demo Event: Goa Trip
  const eventId = 'demo_event_goa';
  const demoEvent: SplitifyEvent = {
    id: eventId,
    name: 'Goa Trip',
    emoji: '🏖️',
    currency: 'INR',
    hostUid: krish.uid,
    createdAt: earlier,
    updatedAt: now,
    joinCode: 'GOA2026',
    members: {
      [krish.uid]: krish,
      [rahul.uid]: rahul,
      [priya.uid]: priya,
    },
  };

  localStorage.setItem('splitify_store_events', JSON.stringify([demoEvent]));

  // 3. Demo Items: Transportation, Accommodation, Food
  const itemTransport: EventItem = {
    id: 'item_trans',
    eventId,
    name: 'Transportation',
    emoji: '✈️',
    createdAt: earlier,
    updatedAt: earlier,
    deleted: false,
  };
  const itemHotel: EventItem = {
    id: 'item_hotel',
    eventId,
    name: 'Accommodation',
    emoji: '🏨',
    createdAt: earlier,
    updatedAt: earlier,
    deleted: false,
  };
  const itemFood: EventItem = {
    id: 'item_food',
    eventId,
    name: 'Food',
    emoji: '🍽️',
    createdAt: earlier,
    updatedAt: earlier,
    deleted: false,
  };

  localStorage.setItem(
    `splitify_store_items_${eventId}`,
    JSON.stringify([itemTransport, itemHotel, itemFood])
  );

  // 4. Demo Subitems (Expenses) matching the specification examples!
  // Goa Trip:
  // - Transportation (12,000): Flight Tickets (8,000), Airport Taxi (2,000), Local Transport (2,000)
  // - Accommodation (9,000): Hotel Booking (6,000), Resort Booking (3,000)
  // - Food (4,500): Breakfast (1,000), Dinner (3,500)
  const participants = [krish.uid, rahul.uid, priya.uid];

  const expenses: ExpenseEntry[] = [
    {
      id: 'exp_flight',
      eventId,
      itemId: 'item_trans',
      name: 'Flight Tickets',
      emoji: '✈️',
      costMinor: 800000, // ₹8,000
      paidBy: krish.uid,
      splitBy: 'equal',
      participants,
      shares: calculateEqualShares(800000, participants),
      comment: 'Indigo roundtrip tickets',
      createdBy: krish.uid,
      createdByName: krish.displayName,
      createdAt: earlier + 1000,
      lastModifiedBy: krish.uid,
      lastModifiedByName: krish.displayName,
      lastModifiedAt: earlier + 1000,
      deleted: false,
      auditLogs: [
        {
          id: 'log_flight_1',
          type: 'created',
          byUid: krish.uid,
          byName: krish.displayName,
          timestamp: earlier + 1000,
          formattedTimestamp: formatAuditTimestamp(earlier + 1000),
          summary: 'Created by Krishnendu',
        },
      ],
    },
    {
      id: 'exp_taxi',
      eventId,
      itemId: 'item_trans',
      name: 'Airport Taxi',
      emoji: '🚕',
      costMinor: 200000, // ₹2,000
      paidBy: rahul.uid,
      splitBy: 'equal',
      participants,
      shares: calculateEqualShares(200000, participants),
      createdBy: rahul.uid,
      createdByName: rahul.displayName,
      createdAt: earlier + 2000,
      lastModifiedBy: rahul.uid,
      lastModifiedByName: rahul.displayName,
      lastModifiedAt: earlier + 2000,
      deleted: false,
      auditLogs: [
        {
          id: 'log_taxi_1',
          type: 'created',
          byUid: rahul.uid,
          byName: rahul.displayName,
          timestamp: earlier + 2000,
          formattedTimestamp: formatAuditTimestamp(earlier + 2000),
        },
      ],
    },
    {
      id: 'exp_hotel',
      eventId,
      itemId: 'item_hotel',
      name: 'Hotel Booking',
      emoji: '🏨',
      costMinor: 600000, // ₹6,000
      paidBy: krish.uid,
      splitBy: 'equal',
      participants,
      shares: calculateEqualShares(600000, participants),
      comment: 'North Goa beachside villa',
      createdBy: krish.uid,
      createdByName: krish.displayName,
      createdAt: earlier + 3000,
      lastModifiedBy: krish.uid,
      lastModifiedByName: krish.displayName,
      lastModifiedAt: earlier + 3000,
      deleted: false,
      auditLogs: [
        {
          id: 'log_hotel_1',
          type: 'created',
          byUid: krish.uid,
          byName: krish.displayName,
          timestamp: earlier + 3000,
          formattedTimestamp: formatAuditTimestamp(earlier + 3000),
        },
      ],
    },
    {
      id: 'exp_dinner',
      eventId,
      itemId: 'item_food',
      name: 'Dinner',
      emoji: '🍽️',
      costMinor: 350000, // ₹3,500
      paidBy: priya.uid,
      splitBy: 'equal',
      participants,
      shares: calculateEqualShares(350000, participants),
      comment: 'Seafood dinner at Curlies',
      createdBy: priya.uid,
      createdByName: priya.displayName,
      createdAt: earlier + 4000,
      lastModifiedBy: priya.uid,
      lastModifiedByName: priya.displayName,
      lastModifiedAt: earlier + 4000,
      deleted: false,
      auditLogs: [
        {
          id: 'log_dinner_1',
          type: 'created',
          byUid: priya.uid,
          byName: priya.displayName,
          timestamp: earlier + 4000,
          formattedTimestamp: formatAuditTimestamp(earlier + 4000),
        },
      ],
    },
  ];

  localStorage.setItem(`splitify_store_expenses_${eventId}`, JSON.stringify(expenses));

  // 5. Demo friendships
  const friendships = [
    { id: 'fs_1', user1Uid: krish.uid, user2Uid: rahul.uid, createdAt: earlier },
    { id: 'fs_2', user1Uid: krish.uid, user2Uid: priya.uid, createdAt: earlier },
  ];
  localStorage.setItem('splitify_store_friendships', JSON.stringify(friendships));
}
