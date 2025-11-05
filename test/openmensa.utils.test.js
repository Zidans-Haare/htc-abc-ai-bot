const { DateTime } = require('luxon');

const {
  shouldHandleOpenMensa,
  resolveDateFromPrompt,
  resolveCanteensForPrompt,
  DEFAULT_CANTEENS,
  normalizeInput,
  extractIntent,
  filterMealsByIntent,
} = require('../server/utils/openmensa');

describe('OpenMensa utilities', () => {
  test('detects mensa related prompts', () => {
    expect(shouldHandleOpenMensa('Was gibt es heute in der Mensa?')).toBe(true);
    expect(shouldHandleOpenMensa('Erzähl mir etwas über Prüfungen.')).toBe(false);
  });

  test('detects implicit mensa queries with day and vegan mention', () => {
    expect(shouldHandleOpenMensa('Wo gibt es diesen Freitag was Veganes?')).toBe(true);
  });

  test('detects implicit mensa queries asking for noodles', () => {
    expect(shouldHandleOpenMensa('Wo gibt es diesen Freitag Nudeln?')).toBe(true);
  });

  test('detects hunger statement with specific dish', () => {
    expect(shouldHandleOpenMensa('Ich habe Hunger auf Nudeln mit Gulasch, wo gibt es das heute?')).toBe(true);
  });

  test('detects weekly burger question', () => {
    expect(shouldHandleOpenMensa('Wer hat diese Woche Burger im Angebot?')).toBe(true);
  });

  test('normalizes input for alias matching', () => {
    expect(normalizeInput('ZeltschlÖßchen')).toBe('zeltschlosschen');
  });

  test('extractIntent identifies keywords and dietary preference', () => {
    const intent = extractIntent('Ich hätte gerne einen veganen Burger oder Wrap.');
    expect(intent.keywords).toEqual(expect.arrayContaining(['burger', 'wrap', 'vegan']));
    expect(intent.dietaryPreference).toBe('vegan');
  });

  test('filterMealsByIntent returns matching meals based on intent', () => {
    const meals = [
      {
        name: 'Veganer BBQ-Burger',
        notes: ['vegan'],
        category: 'Grill',
        prices: { students: 4.2 },
      },
      {
        name: 'Pasta Bolognese',
        notes: ['mit Rindfleisch'],
        category: 'Pasta',
        prices: { students: 3.5 },
      },
    ];
    const intent = extractIntent('Ich möchte einen veganen Burger');
    const matches = filterMealsByIntent(meals, intent);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toContain('Burger');
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
