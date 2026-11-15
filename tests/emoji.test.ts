import { describe, it, expect } from 'vitest';
import { getEmojiForName } from '../src/utils/emoji';

describe('Automatic Emoji Selection', () => {
  it('should match all required examples from the specification', () => {
    expect(getEmojiForName('Goa Trip')).toBe('🏖️');
    expect(getEmojiForName('Flight Tickets')).toBe('✈️');
    expect(getEmojiForName('Hotel')).toBe('🏨');
    expect(getEmojiForName('Breakfast')).toBe('🍳');
    expect(getEmojiForName('Dinner')).toBe('🍽️');
    expect(getEmojiForName('Petrol')).toBe('⛽');
    expect(getEmojiForName('Taxi')).toBe('🚕');
    expect(getEmojiForName('Grocery')).toBe('🛒');
    expect(getEmojiForName('Movie')).toBe('🎬');
    expect(getEmojiForName('Shopping')).toBe('🛍️');
    expect(getEmojiForName('Rent')).toBe('🏠');
    expect(getEmojiForName('Internet')).toBe('🌐');
    expect(getEmojiForName('Electricity')).toBe('⚡');
    expect(getEmojiForName('Medicine')).toBe('💊');
    expect(getEmojiForName('Restaurant')).toBe('🍴');
    expect(getEmojiForName('Settlement')).toBe('💸');
  });

  it('should fallback to 📌 when no match is found', () => {
    expect(getEmojiForName('Some Unknown Gizmo 12345')).toBe('📌');
    expect(getEmojiForName('')).toBe('📌');
  });
});
