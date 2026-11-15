/**
 * Automatic Emoji Selection Utility for Splitify
 * Detects keywords in event/item/expense names and returns a matching emoji.
 * Fallback is 📌 as specified in requirements.
 */

const KEYWORD_MAP: Array<{ keywords: string[]; emoji: string }> = [
  // Settlements & Payments
  { keywords: ['settle', 'settled', 'settlement', 'repay', 'refund', 'paid', 'transfer', 'clear debt'], emoji: '💸' },
  
  // Trips, Travel & Places
  { keywords: ['goa', 'beach', 'sea', 'coast', 'ocean', 'island', 'resort', 'vacation', 'holiday', 'trip'], emoji: '🏖️' },
  { keywords: ['mountain', 'hike', 'hiking', 'trek', 'manali', 'ladakh', 'hill', 'camping'], emoji: '⛰️' },
  { keywords: ['flight', 'airline', 'ticket', 'airport', 'plane', 'air'], emoji: '✈️' },
  { keywords: ['train', 'metro', 'railway', 'irctc', 'subway'], emoji: '🚆' },
  { keywords: ['bus', 'volvo', 'sleeper'], emoji: '🚌' },
  { keywords: ['taxi', 'cab', 'uber', 'ola', 'auto', 'rickshaw'], emoji: '🚕' },
  { keywords: ['car', 'drive', 'rental', 'zoomcar'], emoji: '🚗' },
  { keywords: ['petrol', 'diesel', 'fuel', 'gas', 'cng'], emoji: '⛽' },
  { keywords: ['toll', 'fastag', 'parking'], emoji: '🛣️' },
  
  // Lodging & Household
  { keywords: ['hotel', 'stay', 'motel', 'hostel', 'lodge', 'inn', 'airbnb', 'oyo'], emoji: '🏨' },
  { keywords: ['rent', 'house', 'apartment', 'flat', 'room', 'home', 'maintenance', 'society'], emoji: '🏠' },
  { keywords: ['electricity', 'power', 'bijli', 'current', 'eb bill'], emoji: '⚡' },
  { keywords: ['water', 'paani', 'aquaguard', 'tanker'], emoji: '💧' },
  { keywords: ['internet', 'wifi', 'broadband', 'router', 'jiofiber', 'airtel'], emoji: '🌐' },
  { keywords: ['maid', 'cook', 'cleaning', 'cleaner', 'housekeeping', 'laundry'], emoji: '🧹' },
  
  // Food & Dining
  { keywords: ['breakfast', 'brunch', 'nashta', 'pancake', 'egg', 'omelette', 'toast'], emoji: '🍳' },
  { keywords: ['lunch', 'thali', 'dosa', 'biryani', 'meal'], emoji: '🍛' },
  { keywords: ['dinner', 'dining', 'supper'], emoji: '🍽️' },
  { keywords: ['restaurant', 'cafe', 'dhaba', 'bistro', 'eatery', 'buffet', 'food'], emoji: '🍴' },
  { keywords: ['coffee', 'tea', 'chai', 'starbucks', 'espresso', 'cappuccino'], emoji: '☕' },
  { keywords: ['beer', 'pub', 'bar', 'drinks', 'alcohol', 'brewery', 'cocktail', 'wine'], emoji: '🍻' },
  { keywords: ['pizza', 'dominos', 'pizzahut'], emoji: '🍕' },
  { keywords: ['burger', 'mcdonalds', 'kfc', 'fast food'], emoji: '🍔' },
  { keywords: ['dessert', 'ice cream', 'cake', 'pastry', 'bakery', 'sweet'], emoji: '🍦' },
  { keywords: ['snack', 'chips', 'munchies', 'popcorn'], emoji: '🍿' },
  
  // Groceries & Essentials
  { keywords: ['grocery', 'groceries', 'supermarket', 'zepto', 'blinkit', 'instamart', 'market', 'vegetables', 'fruits', 'kirana'], emoji: '🛒' },
  { keywords: ['milk', 'dairy', 'curd', 'paneer'], emoji: '🥛' },
  { keywords: ['medicine', 'pharmacy', 'medical', 'doctor', 'hospital', 'clinic', 'pharma', 'tablets'], emoji: '💊' },
  
  // Entertainment & Social
  { keywords: ['movie', 'cinema', 'theatre', 'pvr', 'inox', 'netflix', 'film'], emoji: '🎬' },
  { keywords: ['party', 'birthday', 'celebration', 'gathering', 'festival', 'club', 'nightlife'], emoji: '🎉' },
  { keywords: ['gift', 'present', 'anniversary'], emoji: '🎁' },
  { keywords: ['shopping', 'clothes', 'zara', 'h&m', 'mall', 'shoes', 'fashion'], emoji: '🛍️' },
  { keywords: ['game', 'gaming', 'bowling', 'arcade', 'playstation', 'ps5'], emoji: '🎮' },
  { keywords: ['concert', 'music', 'gig', 'show', 'festival'], emoji: '🎵' },
  { keywords: ['gym', 'fitness', 'workout', 'sports', 'turf', 'badminton', 'football', 'cricket'], emoji: '🏋️' },
  { keywords: ['office', 'work', 'project', 'coworking', 'team'], emoji: '💼' },
];

export function getEmojiForName(name: string): string {
  if (!name || typeof name !== 'string') return '📌';

  const normalized = name.toLowerCase().trim();

  // Explicit check for settlements
  if (normalized.includes('settle')) {
    return '💸';
  }

  // Tokenize the name into words
  const words = normalized.split(/[\s,._\-/\\()]+/).filter(Boolean);

  // 1. First pass: exact word match (highest accuracy)
  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (words.includes(kw)) {
        return entry.emoji;
      }
    }
  }

  // 2. Second pass: multi-word keyword phrases (e.g. "flight tickets", "clear debt") or longer substring match
  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (kw.includes(' ') && normalized.includes(kw)) {
        return entry.emoji;
      }
      if (kw.length >= 4 && normalized.includes(kw)) {
        return entry.emoji;
      }
    }
  }

  return '📌';
}
