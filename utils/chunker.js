const { estimateTokens } = require('./tokenizer');

const DEFAULT_MAX_TOKENS = 380;
const DEFAULT_MIN_TOKENS = 120;
const DEFAULT_OVERLAP_TOKENS = 60;
const AVG_CHARS_PER_TOKEN = 4;

function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+\n/g, '\n')
    .trim();
}

function classifySegment(content) {
  if (/^#{1,6}\s+/.test(content)) {
    return 'heading';
  }
  return 'text';
}

function extractHeadingTitle(content) {
  const match = content.match(/^#{1,6}\s+(.*)$/);
  if (match) {
    return match[1].trim();
  }
  return content.trim();
}

function segmentArticle(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const segments = [];
  const separator = /\n{2,}/g;
  let cursor = 0;
  let match;

  while ((match = separator.exec(normalized)) !== null) {
    const raw = normalized.slice(cursor, match.index);
    addSegment(segments, raw, cursor);
    cursor = match.index + match[0].length;
  }

  const tail = normalized.slice(cursor);
  addSegment(segments, tail, cursor);

  return segments;
}

function addSegment(segments, raw, globalStart) {
  if (!raw) return;
  const leading = raw.match(/^\s*/)[0].length;
  const trailing = raw.match(/\s*$/)[0].length;
  const trimmed = raw.trim();
  if (!trimmed) return;

  const start = globalStart + leading;
  const end = globalStart + raw.length - trailing;

  segments.push({
    text: trimmed,
    start,
    end,
    type: classifySegment(trimmed)
  });
}

function splitOversizedSegment(segment, maxTokens) {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
  const parts = [];
  let relativeCursor = 0;
  const base = segment.text;

  while (relativeCursor < base.length) {
    let sliceEnd = Math.min(base.length, relativeCursor + maxChars);
    let slice = base.slice(relativeCursor, sliceEnd);

    if (sliceEnd < base.length) {
      const lastParagraphBreak = slice.lastIndexOf('\n\n');
      const lastSentenceBreak = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('; ')
      );
      const preferredBreak = Math.max(lastParagraphBreak, lastSentenceBreak);
      if (preferredBreak > slice.length * 0.5) {
        sliceEnd = relativeCursor + preferredBreak + 1;
        slice = base.slice(relativeCursor, sliceEnd);
      }
    }

    const trimmed = slice.trim();
    if (trimmed) {
      const localLeading = slice.match(/^\s*/)[0].length;
      const localIndex = relativeCursor + localLeading;
      const partStart = segment.start !== null ? segment.start + localIndex : null;
      const partEnd = partStart !== null ? partStart + trimmed.length : null;
      parts.push({
        text: trimmed,
        start: partStart,
        end: partEnd,
        type: segment.type
      });
    }

    relativeCursor = sliceEnd;
  }

  return parts;
}

function ensureSegmentSize(segment, maxTokens) {
  if (estimateTokens(segment.text) <= maxTokens) {
    return [segment];
  }
  return splitOversizedSegment(segment, maxTokens);
}

function buildChunkText(headline, sectionHeading, body) {
  const parts = [`# ${headline.trim()}`];
  if (sectionHeading && !body.startsWith('#')) {
    parts.push(`## ${sectionHeading.trim()}`);
  }
  parts.push(body.trim());
  return parts.filter(Boolean).join('\n\n');
}

function chunkArticle(article, options = {}) {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    minTokens = DEFAULT_MIN_TOKENS,
    overlapTokens = DEFAULT_OVERLAP_TOKENS
  } = options;

  if (!article || !article.text) return [];

  const baseSegments = segmentArticle(article.text);
  const segments = baseSegments.flatMap(segment => ensureSegmentSize(segment, maxTokens));

  const chunks = [];
  let currentParts = [];
  let currentTokens = 0;
  let currentStart = null;
  let currentEnd = null;
  let currentHeading = null;
  let chunkIndex = 0;
  let lastActiveHeading = null;

  const flushChunk = (force = false) => {
    if (!currentParts.length) {
      currentTokens = 0;
      currentStart = null;
      currentEnd = null;
      return false;
    }

    const body = currentParts.map(part => part.text).join('\n\n').trim();
    if (!body) {
      currentParts = [];
      currentTokens = 0;
      currentStart = null;
      currentEnd = null;
      return false;
    }

    const sectionForChunk = currentParts.find(part => part.sectionHeading)?.sectionHeading || lastActiveHeading;
    const chunkText = buildChunkText(article.headline, sectionForChunk, body);
    const tokens = estimateTokens(chunkText);

    if (!force && tokens < minTokens) {
      return false;
    }

    chunks.push({
      article_id: article.id,
      chunk_index: chunkIndex,
      headline: article.headline,
      section_heading: sectionForChunk || null,
      chunk_text: chunkText,
      chunk_tokens: tokens,
      chunk_char_length: chunkText.length,
      start_offset: currentStart ?? 0,
      end_offset: currentEnd ?? currentStart ?? chunkText.length
    });

    chunkIndex += 1;

    if (overlapTokens > 0) {
      const overlapParts = [];
      let overlapCount = 0;
      for (let i = currentParts.length - 1; i >= 0 && overlapCount < overlapTokens; i -= 1) {
        const part = currentParts[i];
        overlapParts.unshift(part);
        overlapCount += estimateTokens(part.text);
      }
      currentParts = overlapParts.slice();
      currentTokens = overlapParts.reduce((sum, part) => sum + estimateTokens(part.text), 0);
      currentStart = overlapParts.length ? overlapParts[0].start : null;
      currentEnd = overlapParts.length ? overlapParts[overlapParts.length - 1].end : null;
    } else {
      currentParts = [];
      currentTokens = 0;
      currentStart = null;
      currentEnd = null;
    }

    return true;
  };

  for (const segment of segments) {
    if (segment.type === 'heading') {
      const flushed = flushChunk(true);
      if (flushed) {
        currentParts = [];
        currentTokens = 0;
        currentStart = null;
        currentEnd = null;
      }
      currentHeading = extractHeadingTitle(segment.text);
      lastActiveHeading = currentHeading;
      continue;
    }

    const segmentTokens = estimateTokens(segment.text);

    if (currentTokens + segmentTokens > maxTokens && currentParts.length) {
      flushChunk(true);
    }

    currentParts.push({
      ...segment,
      sectionHeading: currentHeading || lastActiveHeading || null
    });
    currentTokens += segmentTokens;
    currentStart = currentStart ?? segment.start;
    currentEnd = segment.end ?? currentEnd;
  }

  flushChunk(true);

  return chunks;
}

module.exports = {
  chunkArticle,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MIN_TOKENS,
  DEFAULT_OVERLAP_TOKENS
};
