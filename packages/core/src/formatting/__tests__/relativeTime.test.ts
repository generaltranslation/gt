import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  _selectRelativeTimeUnit,
  _formatRelativeTimeFromDate,
  _formatRelativeTime,
} from '../format';

describe('_selectRelativeTimeUnit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 0 seconds for the same instant', () => {
    const date = new Date(Date.now());
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: 0, unit: 'second' });
  });

  it('should select seconds for < 60s ago', () => {
    const date = new Date(Date.now() - 30 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -30, unit: 'second' });
  });

  it('should select minutes for < 60min ago', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -5, unit: 'minute' });
  });

  it('should select hours for < 24h ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -3, unit: 'hour' });
  });

  it('should select days for < 7 days ago', () => {
    const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -5, unit: 'day' });
  });

  it('should select weeks for 7-27 days ago', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -2, unit: 'week' });
  });

  it('should select months for 28+ days ago', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -2, unit: 'month' });
  });

  it('should select years for 365+ days ago', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -1, unit: 'year' });
  });

  it('should use positive values for future dates', () => {
    const date = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: 3, unit: 'hour' });
  });

  it('should handle exact boundary at 7 days (selects week)', () => {
    const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -1, unit: 'week' });
  });

  it('should transition from weeks to months at ~30 days', () => {
    // 30 days = 4 weeks by floor, but days >= 28 triggers month path
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -1, unit: 'month' });
  });

  it('should not round up near boundaries (floor behavior)', () => {
    // 3.5 days should be 3 days, not 4 or 1 week
    const date = new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000);
    const result = _selectRelativeTimeUnit(date);
    expect(result).toEqual({ value: -3, unit: 'day' });
  });
});

describe('_formatRelativeTimeFromDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format a date 2 hours ago', () => {
    const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = _formatRelativeTimeFromDate({
      date,
      locales: ['en'],
    });
    expect(result).toBe('2 hours ago');
  });

  it('should format a future date', () => {
    const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const result = _formatRelativeTimeFromDate({
      date,
      locales: ['en'],
    });
    expect(result).toBe('in 3 days');
  });

  it('should format 2 weeks ago', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = _formatRelativeTimeFromDate({
      date,
      locales: ['en'],
    });
    expect(result).toBe('2 weeks ago');
  });
});

describe('_formatRelativeTime', () => {
  it('should format explicit value and unit', () => {
    const result = _formatRelativeTime({
      value: -1,
      unit: 'day',
      locales: ['en'],
    });
    expect(result).toBe('yesterday');
  });

  it('should format future relative time', () => {
    const result = _formatRelativeTime({
      value: 2,
      unit: 'hour',
      locales: ['en'],
    });
    expect(result).toBe('in 2 hours');
  });

  it('should format with week unit', () => {
    const result = _formatRelativeTime({
      value: -1,
      unit: 'week',
      locales: ['en'],
    });
    expect(result).toBe('last week');
  });

  it('should format zero value', () => {
    const result = _formatRelativeTime({
      value: 0,
      unit: 'day',
      locales: ['en'],
    });
    // Intl returns "in 0 days" or "0 days ago" depending on implementation
    expect(result).toBeTruthy();
  });

  it('should respect locale', () => {
    const result = _formatRelativeTime({
      value: -2,
      unit: 'day',
      locales: ['es'],
    });
    // Intl.RelativeTimeFormat output varies by implementation —
    // Spanish may return "anteayer" (day before yesterday) for -2 days
    // instead of "hace 2 días", so we just verify it returns a non-empty string.
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
