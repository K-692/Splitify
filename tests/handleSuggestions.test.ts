import { describe, it, expect } from 'vitest';
import { generateHandleCandidates } from '@/utils/handleSuggestions';

describe('generateHandleCandidates', () => {
  it('generates name-related candidate handles for Krishnendu Pal', () => {
    const candidates = generateHandleCandidates('Krishnendu Pal', 'krish');

    // Should include first name, full name, initials, requested handle variations
    expect(candidates).toContain('krishnendu');
    expect(candidates).toContain('krishnendu_pal');
    expect(candidates).toContain('krish_pal');
    expect(candidates).toContain('krishnendu01');
    expect(candidates).toContain('krish_692');

    // Every candidate must be 3-20 lowercase alphanumeric + underscore
    for (const cand of candidates) {
      expect(cand.length).toBeGreaterThanOrEqual(3);
      expect(cand.length).toBeLessThanOrEqual(20);
      expect(/^[a-z0-9_]+$/.test(cand)).toBe(true);
      expect(cand).not.toBe('krish'); // Never suggests the exact taken handle
    }
  });

  it('generates handles for a single name', () => {
    const candidates = generateHandleCandidates('Rahul', 'rahul');

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates).toContain('rahul01');
    expect(candidates).toContain('rahul_01');
    expect(candidates).toContain('rahul_692');
  });

  it('filters out invalid characters and handles empty strings gracefully', () => {
    const candidates = generateHandleCandidates('', '');
    expect(candidates.length).toBeGreaterThan(0);
    for (const cand of candidates) {
      expect(cand.length).toBeGreaterThanOrEqual(3);
      expect(cand.length).toBeLessThanOrEqual(20);
    }
  });
});
