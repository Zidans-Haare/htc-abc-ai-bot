const { DateTime } = require('luxon');

const API_BASE_URL = process.env.OPENMENSA_API_BASE || 'https://openmensa.org/api/v2';
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const DEFAULT_TIMEZONE = 'Europe/Berlin';

const mealCache = new Map();

const DEFAULT_CANTEENS = [
  {
    id: 82,
    officialName: 'Dresden, Mensa Siedepunkt',
    displayName: 'Mensa Siedepunkt',
    aliases: ['siedepunkt', 'htw', 'htw mensa', 'mensa htw', 'siede punkt'],
  },
  {
    id: 80,
    officialName: 'Dresden, Mensa Matrix',
    displayName: 'Mensa Matrix',
    aliases: ['matrix', 'mensa matrix'],
  },
  {
    id: 78,
    officialName: 'Dresden, Zeltschloesschen',
    displayName: 'Mensa Zeltschlösschen',
    aliases: ['zeltschloesschen', 'zeltschlosschen'],
  },
  {
    id: 88,
    officialName: 'Dresden, Mensa U-Boot',
    displayName: 'Mensa U-Boot',
    aliases: ['u-boot', 'uboot', 'u boot'],
  },
];

const KEYWORDS = [
  'mensa',
  'speiseplan',
  'speise plan',
  'essen',
  'mittag',
  'mittagessen',
  'kantine',
  'cafeteria',
  'menu',
  'speisekarte',
  'mittagstisch',
  'verpflegung',
  'openmensa',
  'mensen',
  'vegan',
  'vegetar',
  'nudel',
  'gericht',
  'gerichte',
  'hunger',
  'appetit',
  'burger',
  'pizza',
  'wrap',
  'suppe',
  'woche',
];

const DAY_KEYWORDS = [
  'montag',
  'dienstag',
  'mittwoch',
  'donnerstag',
  'freitag',
  'samstag',
  'sonntag',
  'wochenende',
  'morgen',
  'heute',
  'uebermorgen',
  'übermorgen',
  'naechste woche',
  'naechsten',
  'kommende',
];

const FOOD_HINTS = [
  'vegan',
  'vegetar',
  'fleisch',
  'gericht',
  'gerichte',
  'nudel',
  'nudeln',
  'gulasch',
  'burger',
  'pizza',
  'wrap',
  'suppe',
  'eintopf',
  'salat',
  'menu',
  'menue',
  'speise',
  'speisen',
  'dessert',
  'fruehstueck',
  'frühstück',
  'morgens',
  'mittag',
  'mittagessen',
  'abendessen',
  'essen',
  'hunger',
  'appetit',
];

const DEFAULT_MAX_RESULTS = 3;
const MAX_LOOKAHEAD_DAYS = Number.parseInt(process.env.OPENMENSA_LOOKAHEAD_DAYS || '4', 10);

const KEYWORD_GROUPS = {
  burger: ['burger', 'cheeseburger', 'big kahuna'],
  pasta: ['nudel', 'nudeln', 'pasta', 'spaghetti', 'penne', 'fusilli', 'lasagne'],
  gulasch: ['gulasch'],
  soup: ['suppe', 'suppen', 'eintopf', 'bruehe', 'brühe'],
  salad: ['salat', 'salate'],
  pizza: ['pizza'],
  wrap: ['wrap', 'wraps', 'tortilla'],
  bowl: ['bowl', 'bowls'],
  curry: ['curry'],
  burgerweek: ['burgerwoche', 'burger woche'],
  fish: ['fisch', 'lachs', 'forelle'],
  meat: ['fleisch', 'steak', 'hähnchen', 'haehnchen', 'rind', 'schwein', 'ente'],
  vegan: ['vegan', 'pflanzlich'],
  vegetarian: ['vegetar', 'veggie', 'fleischlos', 'ohne fleisch'],
  dessert: ['dessert', 'nachspeise', 'nachtisch'],
};

const KEYWORD_LABELS = {
  burger: 'Burger',
  pasta: 'Pasta/Nudeln',
  gulasch: 'Gulasch',
  soup: 'Suppen/Eintöpfe',
  salad: 'Salate',
  pizza: 'Pizza',
  wrap: 'Wraps',
  bowl: 'Bowls',
  curry: 'Currys',
  burgerweek: 'Burger-Angebote',
  fish: 'Fischgerichte',
  meat: 'Fleischgerichte',
  vegan: 'Vegane Gerichte',
  vegetarian: 'Vegetarische Gerichte',
  dessert: 'Desserts',
};

const DIETARY_KEYWORDS = {
  vegan: ['vegan', 'pflanzlich'],
  vegetarian: ['vegetar', 'veggie', 'fleischlos', 'ohne fleisch'],
  meat: ['mit fleisch', 'fleisch', 'rind', 'schwein', 'hähnchen', 'haehnchen', 'pute', 'gulasch', 'steak', 'wurst'],
};

const DIETARY_LABELS = {
  vegan: 'vegan',
  vegetarian: 'vegetarisch',
  meat: 'mit Fleisch',
};

function normalizeInput(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

function getConfiguredCanteens() {
  const overrides = process.env.OPENMENSA_CANTEENS;
  if (!overrides) {
    return DEFAULT_CANTEENS;
  }

  return overrides.split(',').map(entry => {
    const [idPart, ...nameParts] = entry.trim().split(':');
    const id = Number(idPart);
    const name = nameParts.join(':').trim();
    if (!Number.isFinite(id)) {
      throw new Error(`Invalid OPENMENSA_CANTEENS entry "${entry}"`);
    }
    const displayName = name || `Mensa ${id}`;
    return {
      id,
      officialName: displayName,
      displayName,
      aliases: [normalizeInput(displayName)],
    };
  });
}

function shouldHandleOpenMensa(prompt) {
  const normalized = normalizeInput(prompt);
  if (!normalized) return false;
  if (KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return true;
  }

  const mentionsDay = DAY_KEYWORDS.some(keyword => normalized.includes(keyword));
  const mentionsFood = FOOD_HINTS.some(keyword => normalized.includes(keyword));
  return mentionsDay && mentionsFood;
}

function detectDietaryPreference(normalized) {
  if (!normalized) return null;
  if (DIETARY_KEYWORDS.vegan.some(term => normalized.includes(term))) {
    return 'vegan';
  }
  if (DIETARY_KEYWORDS.vegetarian.some(term => normalized.includes(term))) {
    return 'vegetarian';
  }
  if (DIETARY_KEYWORDS.meat.some(term => normalized.includes(term))) {
    return 'meat';
  }
  return null;
}

function extractIntent(prompt) {
  const normalized = normalizeInput(prompt);
  if (!normalized) {
    return {
      keywords: [],
      keywordTerms: [],
      hasKeywords: false,
      dietaryPreference: null,
    };
  }

  const detectedKeys = [];
  const keywordTerms = new Set();

  Object.entries(KEYWORD_GROUPS).forEach(([key, terms]) => {
    if (terms.some(term => normalized.includes(term))) {
      detectedKeys.push(key);
      terms.forEach(term => keywordTerms.add(term));
    }
  });

  const dietaryPreference = detectDietaryPreference(normalized);

  return {
    keywords: detectedKeys,
    keywordTerms: Array.from(keywordTerms),
    hasKeywords: detectedKeys.length > 0,
    dietaryPreference,
  };
}

function resolveCanteensForPrompt(prompt, canteens = getConfiguredCanteens()) {
  const normalized = normalizeInput(prompt);
  const matches = canteens.filter(canteen =>
    (canteen.aliases || []).some(alias => normalized.includes(alias))
  );
  if (matches.length > 0) {
    return matches;
  }
  return canteens;
}

function getBaseDate() {
  return DateTime.now().setZone(DEFAULT_TIMEZONE);
}

function parseExplicitDate(normalized, baseDate) {
  const isoMatch = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const dt = DateTime.fromISO(isoMatch[0], { zone: DEFAULT_TIMEZONE });
    if (dt.isValid) {
      return dt;
    }
  }

  const dotMatch = normalized.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10);
    if (!Number.isFinite(day) || !Number.isFinite(month)) {
      return null;
    }

    let year = baseDate.year;
    if (dotMatch[3]) {
      const yearPart = dotMatch[3];
      year = yearPart.length === 2 ? 2000 + parseInt(yearPart, 10) : parseInt(yearPart, 10);
    } else if (month < baseDate.month || (month === baseDate.month && day < baseDate.day)) {
      year += 1;
    }

    const dt = DateTime.fromObject({ year, month, day }, { zone: DEFAULT_TIMEZONE });
    if (dt.isValid) {
      return dt;
    }
  }

  return null;
}

function resolveDateFromPrompt(prompt, { baseDate = getBaseDate() } = {}) {
  const normalized = normalizeInput(prompt);

  if (!normalized) {
    return {
      date: baseDate.toISODate(),
      source: 'default',
      target: baseDate,
    };
  }

  const explicit = parseExplicitDate(normalized, baseDate);
  if (explicit) {
    return {
      date: explicit.toISODate(),
      source: 'explicit',
      target: explicit,
    };
  }

  const phrases = [
    { tokens: ['uebermorgen'], offset: 2 },
    { tokens: ['übermorgen'], offset: 2 },
    { tokens: ['morgen'], offset: 1 },
    { tokens: ['heute'], offset: 0 },
    { tokens: ['gestern'], offset: -1 },
    { tokens: ['vorgestern'], offset: -2 },
  ];

  for (const phrase of phrases) {
    if (phrase.tokens.some(token => normalized.includes(token))) {
      const target = baseDate.plus({ days: phrase.offset });
      return {
        date: target.toISODate(),
        source: 'phrase',
        target,
      };
    }
  }

  const weekdayMap = new Map([
    ['montag', 1],
    ['dienstag', 2],
    ['mittwoch', 3],
    ['donnerstag', 4],
    ['freitag', 5],
    ['samstag', 6],
    ['sonntag', 7],
  ]);

  const wantsNextWeek = ['naechste', 'naechsten', 'kommende', 'naechster', 'naechstes']
    .some(token => normalized.includes(token));

  for (const [weekdayName, weekdayValue] of weekdayMap.entries()) {
    if (normalized.includes(weekdayName)) {
      let diff = weekdayValue - baseDate.weekday;
      if (diff < 0 || (diff === 0 && wantsNextWeek)) {
        diff += 7;
      }
      if (diff === 0 && wantsNextWeek) {
        diff = 7;
      }
      const target = baseDate.plus({ days: diff });
      return {
        date: target.toISODate(),
        source: 'weekday',
        target,
      };
    }
  }

  return {
    date: baseDate.toISODate(),
    source: 'default',
    target: baseDate,
  };
}

async function fetchJson(url) {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    const error = new Error(`OpenMensa request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function fetchDayInfo(canteenId, isoDate) {
  const url = `${API_BASE_URL}/canteens/${canteenId}/days/${isoDate}`;
  try {
    const data = await fetchJson(url);
    return data;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchMeals(canteenId, isoDate) {
  const cacheKey = `${canteenId}:${isoDate}`;
  const cached = mealCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const result = {
    canteenId,
    date: isoDate,
    closed: false,
    meals: [],
    available: false,
  };

  try {
    const dayInfo = await fetchDayInfo(canteenId, isoDate);
    if (!dayInfo) {
      mealCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    result.closed = Boolean(dayInfo.closed);
    if (!result.closed) {
      const url = `${API_BASE_URL}/canteens/${canteenId}/days/${isoDate}/meals`;
      try {
        const meals = await fetchJson(url);
        if (Array.isArray(meals) && meals.length > 0) {
          result.meals = meals;
          result.available = true;
        }
      } catch (mealError) {
        if (mealError.status !== 404) {
          throw mealError;
        }
      }
    }

    mealCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    result.error = error;
    mealCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }
}

function formatPriceLabel(label) {
  const map = {
    students: 'Studierende',
    employees: 'Mitarbeitende',
    pupils: 'Schüler:innen',
    children: 'Kinder',
    others: 'Gäste',
  };
  return map[label] || label;
}

function formatPrices(prices) {
  if (!prices || typeof prices !== 'object') {
    return '';
  }
  const formatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });

  const parts = Object.entries(prices)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${formatPriceLabel(key)}: ${formatter.format(value)}`);

  return parts.join(', ');
}

function createMealHaystack(meal) {
  const parts = [];
  if (meal.name) parts.push(normalizeInput(meal.name));
  if (meal.category) parts.push(normalizeInput(meal.category));
  if (Array.isArray(meal.notes)) {
    parts.push(meal.notes.map(note => normalizeInput(note)).join(' '));
  }
  return parts.join(' ');
}

function mealMatchesIntent(meal, intent) {
  if (!intent) return true;
  const haystack = createMealHaystack(meal);
  let keywordMatch = true;
  const terms = intent.keywordTerms && intent.keywordTerms.length > 0 ? intent.keywordTerms : [];
  if (terms.length > 0) {
    keywordMatch = terms.some(term => haystack.includes(term));
  }

  let dietaryMatch = true;
  if (intent.dietaryPreference === 'vegan') {
    dietaryMatch = haystack.includes('vegan') || haystack.includes('pflanzlich');
  } else if (intent.dietaryPreference === 'vegetarian') {
    dietaryMatch = haystack.includes('vegetar') || haystack.includes('ovo-lacto') || haystack.includes('ovo lacto') || haystack.includes('veggie');
  } else if (intent.dietaryPreference === 'meat') {
    dietaryMatch = !haystack.includes('vegan') && !haystack.includes('vegetar');
  }

  return keywordMatch && dietaryMatch;
}

function filterMealsByIntent(meals, intent) {
  if (!Array.isArray(meals) || meals.length === 0) {
    return [];
  }
  if (!intent || (!intent.hasKeywords && !intent.dietaryPreference)) {
    return meals.slice(0, DEFAULT_MAX_RESULTS);
  }

  const primaryMatches = meals.filter(meal => mealMatchesIntent(meal, intent));
  if (primaryMatches.length > 0) {
    return primaryMatches.slice(0, DEFAULT_MAX_RESULTS);
  }

  if (intent.dietaryPreference) {
    const dietaryOnly = meals.filter(meal =>
      mealMatchesIntent(meal, { ...intent, keywordTerms: [], hasKeywords: false })
    );
    if (dietaryOnly.length > 0) {
      return dietaryOnly.slice(0, DEFAULT_MAX_RESULTS);
    }
  }

  if (intent.hasKeywords) {
    const keywordOnly = meals.filter(meal =>
      mealMatchesIntent(meal, { ...intent, dietaryPreference: null })
    );
    if (keywordOnly.length > 0) {
      return keywordOnly.slice(0, DEFAULT_MAX_RESULTS);
    }
  }

  return [];
}

async function findNextMatchingMeals(canteenId, isoDate, intent) {
  const start = DateTime.fromISO(isoDate, { zone: DEFAULT_TIMEZONE });
  for (let offset = 1; offset <= MAX_LOOKAHEAD_DAYS; offset += 1) {
    const nextDate = start.plus({ days: offset });
    const nextIso = nextDate.toISODate();
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchMeals(canteenId, nextIso);
    if (data.available && !data.closed && Array.isArray(data.meals) && data.meals.length > 0) {
      const matches = filterMealsByIntent(data.meals, intent);
      if (matches.length > 0 || !intent || (!intent.hasKeywords && !intent.dietaryPreference)) {
        return {
          date: nextDate,
          isoDate: nextIso,
          matches,
          data,
        };
      }
    }
  }
  return null;
}

function buildFilterSummary(formattedDate, intent) {
  const filters = [];
  if (intent && intent.hasKeywords) {
    const labels = intent.keywords.map(key => KEYWORD_LABELS[key] || key);
    if (labels.length > 0) {
      filters.push(`Suchbegriffe: ${labels.join(', ')}`);
    }
  }
  if (intent && intent.dietaryPreference) {
    filters.push(`Ernährungswunsch: ${DIETARY_LABELS[intent.dietaryPreference] || intent.dietaryPreference}`);
  }
  const filterText = filters.length > 0 ? filters.join(' · ') : 'Keine speziellen Filter erkannt.';
  return `Datum: ${formattedDate}\n${filterText}`;
}

function formatMealLine(meal) {
  const category = meal.category ? `[${meal.category}] ` : '';
  const notes = Array.isArray(meal.notes) && meal.notes.length > 0 ? ` (${meal.notes.join(', ')})` : '';
  const prices = formatPrices(meal.prices);
  const priceText = prices ? ` – ${prices}` : '';
  return `- ${category}${meal.name}${notes}${priceText}`;
}

function formatCanteenSection({ canteen, baseData, formattedDate, matchedMeals, intent, fallback }) {
  if (baseData.error) {
    return `### ${canteen.displayName}\nFehler beim Abrufen der Daten (${baseData.error.message}).`;
  }
  if (baseData.closed) {
    const closedLines = [`### ${canteen.displayName}`, `Die Mensa ist am ${formattedDate} geschlossen.`];
    if (fallback) {
      const fallbackDate = fallback.date.setLocale('de-DE').toFormat('cccc, dd. LLLL yyyy');
      if (fallback.matches.length > 0) {
        closedLines.push(`Nächste passende Gerichte am ${fallbackDate}:`);
        fallback.matches.forEach(meal => closedLines.push(formatMealLine(meal)));
      } else if (fallback.data.available && fallback.data.meals.length > 0) {
        closedLines.push(`Keine passenden Gerichte gefunden. Nächstes verfügbares Menü am ${fallbackDate}.`);
      }
    }
    return closedLines.join('\n');
  }

  if (!baseData.available || baseData.meals.length === 0) {
    const lines = [`### ${canteen.displayName}`, `Für den ${formattedDate} liegen keine Gerichte vor.`];
    if (fallback) {
      const fallbackDate = fallback.date.setLocale('de-DE').toFormat('cccc, dd. LLLL yyyy');
      if (fallback.matches.length > 0) {
        lines.push(`Nächste Treffer am ${fallbackDate}:`);
        fallback.matches.forEach(meal => lines.push(formatMealLine(meal)));
      } else {
        lines.push(`Nächstes veröffentlichtes Menü am ${fallbackDate}.`);
      }
    }
    return lines.join('\n');
  }

  const lines = [`### ${canteen.displayName}`];

  if (matchedMeals.length > 0) {
    matchedMeals.forEach(meal => lines.push(formatMealLine(meal)));
    if (baseData.meals.length > matchedMeals.length) {
      lines.push('- Weitere Gerichte findest du im vollständigen Speiseplan.');
    }
  } else if (intent && (intent.hasKeywords || intent.dietaryPreference)) {
    lines.push(`Keine passenden Treffer am ${formattedDate}.`);
    if (fallback) {
      const fallbackDate = fallback.date.setLocale('de-DE').toFormat('cccc, dd. LLLL yyyy');
      if (fallback.matches.length > 0) {
        lines.push(`Nächste passende Gerichte am ${fallbackDate}:`);
        fallback.matches.forEach(meal => lines.push(formatMealLine(meal)));
      } else {
        lines.push(`Nächstes verfügbares Menü am ${fallbackDate}.`);
      }
    }
  } else {
    baseData.meals.slice(0, DEFAULT_MAX_RESULTS).forEach(meal => lines.push(formatMealLine(meal)));
    if (baseData.meals.length > DEFAULT_MAX_RESULTS) {
      lines.push('- Weitere Gerichte findest du im vollständigen Speiseplan.');
    }
  }

  return lines.join('\n');
}

async function buildOpenMensaContext({ prompt, force = false }) {
  if (!force && !shouldHandleOpenMensa(prompt)) {
    return null;
  }

  const intent = extractIntent(prompt);
  const canteens = resolveCanteensForPrompt(prompt);
  const dateInfo = resolveDateFromPrompt(prompt);
  const formattedDate = dateInfo.target.setLocale('de-DE').toFormat('cccc, dd. LLLL yyyy');

  const sections = [];
  const meta = [];

  for (const canteen of canteens) {
    // eslint-disable-next-line no-await-in-loop
    const baseData = await fetchMeals(canteen.id, dateInfo.date);
    const matchedMeals = filterMealsByIntent(baseData.meals, intent);
    let fallback = null;

    if ((matchedMeals.length === 0 || !baseData.available || baseData.closed) && (intent.hasKeywords || intent.dietaryPreference)) {
      // eslint-disable-next-line no-await-in-loop
      fallback = await findNextMatchingMeals(canteen.id, dateInfo.date, intent);
    }

    const sectionText = formatCanteenSection({
      canteen,
      baseData,
      formattedDate,
      matchedMeals,
      intent,
      fallback,
    });

    sections.push(sectionText);
    meta.push({
      id: canteen.id,
      name: canteen.displayName,
      targetDate: dateInfo.date,
      closed: baseData.closed,
      available: baseData.available,
      matches: matchedMeals,
      fallback: fallback
        ? {
            date: fallback.isoDate,
            matches: fallback.matches,
          }
        : null,
    });
  }

  const filterSummary = buildFilterSummary(formattedDate, intent);
  const contextText = `${filterSummary}\n\n${sections.join('\n\n')}`.trim();

  return {
    contextText,
    date: dateInfo.date,
    intent,
    canteens: meta,
  };
}

module.exports = {
  DEFAULT_CANTEENS,
  buildOpenMensaContext,
  resolveDateFromPrompt,
  resolveCanteensForPrompt,
  shouldHandleOpenMensa,
  normalizeInput,
  extractIntent,
  mealMatchesIntent,
  filterMealsByIntent,
};
