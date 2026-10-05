import { describe, it, expect } from 'vitest';
import {
  normalizeEmail, validateEmail, validatePassword, validatePin, validateName
} from '../admin/lib/validation.ts';
import { bucketize, computeCards } from '../admin/lib/metrics.ts';

describe('admin validation', () => {
  it('accepts good signup input', () => {
    expect(validateEmail('Creator@Example.com')).toBe(null);
    expect(validatePassword('Creator123!')).toBe(null);
    expect(validatePin('4321')).toBe(null);
    expect(validateName('Creator')).toBe(null);
  });

  it('rejects bad input with messages', () => {
    expect(validateEmail('not-an-email')).toMatch(/valid email/i);
    expect(validateEmail('')).toMatch(/required/i);
    expect(validatePassword('short')).toMatch(/8 characters/i);
    expect(validatePin('12')).toMatch(/4 digits/i);
    expect(validatePin('abcd')).toMatch(/4 digits/i);
    expect(validatePin('12345')).toMatch(/4 digits/i);
  });

  it('normalizes email', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(normalizeEmail('stardeepan22@gamil.com')).toBe('stardeepan22@gmail.com');
    expect(normalizeEmail('user@hotmial.com')).toBe('user@hotmail.com');
  });
});

describe('admin metrics', () => {
  const users = [
    { id: 'u1', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'u2', created_at: new Date(Date.now() - 40 * 86400000).toISOString() }
  ];
  const events = [
    { user_id: 'u1', event_name: 'convert_success', properties: { tokens_saved: 1000 }, created_at: new Date().toISOString() },
    { user_id: 'u1', event_name: 'copy', properties: {}, created_at: new Date().toISOString() },
    { user_id: null, event_name: 'file_select', properties: {}, created_at: new Date().toISOString() }
  ];

  it('buckets 7 days with conversions and active users', () => {
    const rows = bucketize(users, events, 7);
    expect(rows).toHaveLength(7);
    const today = rows[rows.length - 1];
    expect(today.conversions).toBe(1);
    expect(today.tokensSaved).toBe(1000);
    expect(today.activeUsers).toBe(1);
    expect(rows[0].conversions).toBe(0);
  });

  it('computes headline cards', () => {
    const cards = computeCards(users, events);
    expect(cards.totalUsers).toBe(2);
    expect(cards.newSignups7d).toBe(1);
    expect(cards.activeUsers7d).toBe(1);
    expect(cards.conversions30d).toBe(1);
    expect(cards.tokensSaved30d).toBe(1000);
  });

  it('ignores non-numeric tokens_saved', () => {
    const bad = [{ user_id: 'u1', event_name: 'convert_success', properties: { tokens_saved: 'lots' }, created_at: new Date().toISOString() }];
    expect(computeCards(users, bad).tokensSaved30d).toBe(0);
  });
});
