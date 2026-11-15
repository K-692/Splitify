import { describe, it, expect } from 'vitest';
import { getFirstName } from '@/utils/name';

describe('getFirstName', () => {
  it('extracts first name from full names', () => {
    expect(getFirstName('Krishnendu Pal')).toBe('Krishnendu');
    expect(getFirstName('Rahul Sharma')).toBe('Rahul');
    expect(getFirstName('Priya Das')).toBe('Priya');
  });

  it('handles single names correctly', () => {
    expect(getFirstName('Krishnendu')).toBe('Krishnendu');
    expect(getFirstName('Aman')).toBe('Aman');
  });

  it('handles handles and usernames cleanly', () => {
    expect(getFirstName('@krish')).toBe('krish');
    expect(getFirstName('@rahul_sharma')).toBe('Rahul');
  });

  it('falls back gracefully on empty or null inputs', () => {
    expect(getFirstName(undefined)).toBe('Member');
    expect(getFirstName(null)).toBe('Member');
    expect(getFirstName('', 'Guest')).toBe('Guest');
  });
});
