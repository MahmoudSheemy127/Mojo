// src/utils/formatDate.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelative, formatTime } from './formatDate';

describe('formatRelative', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(pastMs: number) {
    const now = new Date('2026-06-26T12:00:00.000Z');
    vi.setSystemTime(now);
    return new Date(now.getTime() - pastMs).toISOString();
  }

  it('returns "now" for timestamps under 60 seconds ago', () => {
    const iso = setup(30_000);
    expect(formatRelative(iso)).toBe('now');
  });

  it('returns minutes for timestamps under 1 hour ago', () => {
    const iso = setup(5 * 60 * 1000);
    expect(formatRelative(iso)).toBe('5m');
  });

  it('returns hours for timestamps under 24 hours ago', () => {
    const iso = setup(2 * 60 * 60 * 1000);
    expect(formatRelative(iso)).toBe('2h');
  });

  it('returns weekday for timestamps under 7 days ago', () => {
    const iso = setup(2 * 24 * 60 * 60 * 1000);
    const result = formatRelative(iso);
    // Must be a short weekday name
    expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  });

  it('returns month+day for timestamps 7+ days ago', () => {
    const iso = setup(10 * 24 * 60 * 60 * 1000);
    const result = formatRelative(iso);
    // e.g. "Jun 16"
    expect(result).toMatch(/[A-Z][a-z]+ \d+/);
  });
});

describe('formatTime', () => {
  it('returns HH:MM format', () => {
    const result = formatTime('2026-06-26T14:05:00.000Z');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});
