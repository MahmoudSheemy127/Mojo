// src/features/presence/presence.test.ts
import { describe, it, expect } from 'vitest';
import { toUiPresence, toSettableStatus } from './presence';

describe('toUiPresence', () => {
  it('maps "away" to "idle"', () => {
    expect(toUiPresence('away')).toBe('idle');
  });

  it('passes through the other statuses', () => {
    expect(toUiPresence('online')).toBe('online');
    expect(toUiPresence('dnd')).toBe('dnd');
    expect(toUiPresence('offline')).toBe('offline');
  });
});

describe('toSettableStatus', () => {
  it('maps "idle" to the contract "away"', () => {
    expect(toSettableStatus('idle')).toBe('away');
  });

  it('passes through online and dnd', () => {
    expect(toSettableStatus('online')).toBe('online');
    expect(toSettableStatus('dnd')).toBe('dnd');
  });

  it('returns null for offline (not settable via the contract)', () => {
    expect(toSettableStatus('offline')).toBeNull();
  });
});
