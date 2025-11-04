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
];

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
  return KEYWORDS.some(keyword => normalized.includes(keyword));
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

function formatMealsForContext(canteen, data, displayDate) {
  if (data.error) {
    return `### ${canteen.displayName}\nFehler beim Abrufen der Daten (${data.error.message}).`;
  }
  if (data.closed) {
    return `### ${canteen.displayName}\nDie Mensa ist am ${displayDate} geschlossen oder hat keine veröffentlichten Daten.`;
  }
  if (!data.available || data.meals.length === 0) {
    return `### ${canteen.displayName}\nFür den ${displayDate} sind keine Mahlzeiten veröffentlicht.`;
  }

  const maxItems = 3;
  const visibleMeals = data.meals.slice(0, maxItems);
  const rows = visibleMeals.map(meal => {
    const category = meal.category ? `[${meal.category}] ` : '';
    const notes = Array.isArray(meal.notes) && meal.notes.length > 0 ? ` (${meal.notes.join(', ')})` : '';
    const prices = formatPrices(meal.prices);
    const priceText = prices ? ` – Preise: ${prices}` : '';
    return `- ${category}${meal.name}${notes}${priceText}`;
  });

  if (data.meals.length > visibleMeals.length) {
    rows.push('- Weitere Angebote findest du im vollständigen Speiseplan auf OpenMensa.');
  }

  return `### ${canteen.displayName}\n${rows.join('\n')}`;
}

async function buildOpenMensaContext({ prompt }) {
  if (!shouldHandleOpenMensa(prompt)) {
    return null;
  }

  const canteens = resolveCanteensForPrompt(prompt);
  const dateInfo = resolveDateFromPrompt(prompt);
  const formattedDate = dateInfo.target.setLocale('de-DE').toFormat('cccc, dd. LLLL yyyy');

  const results = [];
  for (const canteen of canteens) {
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchMeals(canteen.id, dateInfo.date);
    results.push({ canteen, data });
  }

  const sections = results.map(result => formatMealsForContext(result.canteen, result.data, formattedDate));
  const contextText = `Datum: ${formattedDate}\n${sections.join('\n\n')}`;

  return {
    contextText,
    date: dateInfo.date,
    canteens: results.map(r => ({
      id: r.canteen.id,
      name: r.canteen.displayName,
      hasMeals: r.data.available && !r.data.closed && r.data.meals.length > 0,
    })),
  };
}

module.exports = {
  DEFAULT_CANTEENS,
  buildOpenMensaContext,
  resolveDateFromPrompt,
  resolveCanteensForPrompt,
  shouldHandleOpenMensa,
  normalizeInput,
};
