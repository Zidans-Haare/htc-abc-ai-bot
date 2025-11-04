const { DateTime } = require('luxon');

const {
  shouldHandleOpenMensa,
  resolveDateFromPrompt,
  resolveCanteensForPrompt,
  DEFAULT_CANTEENS,
  normalizeInput,
} = require('../server/utils/openmensa');

describe('OpenMensa utilities', () => {
  test('detects mensa related prompts', () => {
    expect(shouldHandleOpenMensa('Was gibt es heute in der Mensa?')).toBe(true);
    expect(shouldHandleOpenMensa('Erzähl mir etwas über Prüfungen.')).toBe(false);
  });

  test('normalizes input for alias matching', () => {
    expect(normalizeInput('ZeltschlÖßchen')).toBe('zeltschlosschen');
  });

  test('resolves relative phrases like morgen', () => {
    const baseDate = DateTime.fromISO('2025-11-05', { zone: 'Europe/Berlin' }); // Mittwoch
    const result = resolveDateFromPrompt('Was gibt es morgen in der Mensa?', { baseDate });
    expect(result.date).toBe('2025-11-06');
    expect(result.source).toBe('phrase');
  });

  test('resolves weekdays to next occurrence', () => {
    const baseDate = DateTime.fromISO('2025-11-05', { zone: 'Europe/Berlin' }); // Mittwoch
    const result = resolveDateFromPrompt('Zeig mir den Plan für Freitag', { baseDate });
    expect(result.date).toBe('2025-11-07');
    expect(result.source).toBe('weekday');
  });

  test('resolves explicit short german date', () => {
    const baseDate = DateTime.fromISO('2025-11-05', { zone: 'Europe/Berlin' });
    const result = resolveDateFromPrompt('Was gibt es am 10.11.?', { baseDate });
    expect(result.date).toBe('2025-11-10');
    expect(result.source).toBe('explicit');
  });

  test('filters canteens by alias', () => {
    const result = resolveCanteensForPrompt('Gibt es in der Mensa Matrix vegetarische Gerichte?');
    expect(result.length).toBe(1);
    expect(result[0].displayName).toMatch(/Matrix/i);
  });

  test('falls back to default canteen list when no alias is matched', () => {
    const result = resolveCanteensForPrompt('Was gibt es in der Mensa?');
    expect(result.length).toBe(DEFAULT_CANTEENS.length);
  });
});
