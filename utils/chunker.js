const { estimateTokens } = require('./tokenizer');

const DEFAULT_MAX_TOKENS = 380;
const DEFAULT_MIN_TOKENS = 120;
const DEFAULT_OVERLAP_TOKENS = 60;
const AVG_CHARS_PER_TOKEN = 4;
const HEADER_TOKEN_BUFFER = 35;

function collectBreakpoints(text, startOffset, endOffset) {
  const windowText = text.slice(startOffset, endOffset);
  if (!windowText) return [];

  const breakpoints = new Set();

  const addBreakpoint = (relativeIndex, includeLength = 0) => {
    if (relativeIndex === null || relativeIndex === undefined) return;
    const absoluteIndex = startOffset + relativeIndex + includeLength;
    if (absoluteIndex > startOffset && absoluteIndex < endOffset) {
      breakpoints.add(absoluteIndex);
    }
  };

  const paragraphRegex = /\n{2,}/g;
  let match;
  while ((match = paragraphRegex.exec(windowText)) !== null) {
    addBreakpoint(match.index);
  }

  const sentenceRegex = /[.!?;]+\s+/g;
  while ((match = sentenceRegex.exec(windowText)) !== null) {
    addBreakpoint(match.index, match[0].length);
  }

  const newlineRegex = /\n/g;
  while ((match = newlineRegex.exec(windowText)) !== null) {
    addBreakpoint(match.index);
  }

  const whitespaceRegex = /\s+/g;
  while ((match = whitespaceRegex.exec(windowText)) !== null) {
    addBreakpoint(match.index, match[0].length);
  }

  return Array.from(breakpoints).sort((a, b) => b - a);
}

function clampSliceToTokenLimit(baseText, sliceStart, initialSliceEnd, maxTokens) {
  const maxChars = Math.max(1, maxTokens * AVG_CHARS_PER_TOKEN);
  const upperBound = Math.min(
    baseText.length,
    Math.max(sliceStart + 1, initialSliceEnd, sliceStart + maxChars)
  );

  const candidateBreaks = collectBreakpoints(baseText, sliceStart, upperBound);
  const evaluatedBreaks = [upperBound, ...candidateBreaks.filter(end => end !== upperBound)];

  for (const candidateEnd of evaluatedBreaks) {
    if (candidateEnd <= sliceStart) continue;
    const candidateSlice = baseText.slice(sliceStart, candidateEnd);
    const candidateText = candidateSlice.trim();
    if (!candidateText) continue;
    const candidateTokens = estimateTokens(candidateText);
    if (candidateTokens <= maxTokens) {
      return { end: candidateEnd, text: candidateText };
    }
  }

  let low = sliceStart + 1;
  let high = upperBound;
  let best = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midSlice = baseText.slice(sliceStart, mid);
    const midText = midSlice.trim();

    if (!midText) {
      low = mid + 1;
      continue;
    }

    const midTokens = estimateTokens(midText);

    if (midTokens <= maxTokens) {
      best = { end: mid, text: midText };
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best) {
    return best;
  }

  const minimalEnd = Math.min(
    baseText.length,
    Math.max(sliceStart + 1, sliceStart + Math.floor(maxChars * 0.5))
  );
  const fallbackSlice = baseText.slice(sliceStart, minimalEnd);
  const fallbackText = fallbackSlice.trim() || fallbackSlice;
  return {
    end: minimalEnd,
    text: fallbackText.trim()
  };
}

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
  const parts = [];
  let relativeCursor = 0;
  const base = segment.text;

  while (relativeCursor < base.length) {
    const proposedEnd = relativeCursor + maxTokens * AVG_CHARS_PER_TOKEN;
    const { end, text: trimmed } = clampSliceToTokenLimit(base, relativeCursor, proposedEnd, maxTokens);

    if (!trimmed) {
      relativeCursor = end;
      continue;
    }

    const rawSlice = base.slice(relativeCursor, end);
    const localLeading = rawSlice.match(/^\s*/)[0].length;
    const localIndex = relativeCursor + localLeading;
    const partStart = segment.start !== null ? segment.start + localIndex : null;
    const partEnd = partStart !== null ? partStart + trimmed.length : null;

    parts.push({
      text: trimmed,
      start: partStart,
      end: partEnd,
      type: segment.type
    });

    relativeCursor = end;
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

  const bodyTokenBudget = Math.max(1, maxTokens - HEADER_TOKEN_BUFFER - overlapTokens);
  const baseSegments = segmentArticle(article.text);
  const segments = baseSegments.flatMap(segment => ensureSegmentSize(segment, bodyTokenBudget));

  const chunks = [];
  let currentParts = [];
  let currentStart = null;
  let currentEnd = null;
  let currentHeading = null;
  let chunkIndex = 0;
  let lastActiveHeading = null;

  const getActiveTokenCount = () => currentParts.reduce((sum, part) => {
    if (part.__isOverlap) {
      return sum;
    }
    return sum + estimateTokens(part.text);
  }, 0);

  const flushChunk = (force = false) => {
    if (!currentParts.length) {
      currentStart = null;
      currentEnd = null;
      return false;
    }

    const body = currentParts.map(part => part.text).join('\n\n').trim();
    if (!body) {
      currentParts = [];
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
      let tokensRemaining = overlapTokens;

      for (let i = currentParts.length - 1; i >= 0 && tokensRemaining > 0; i -= 1) {
        const part = currentParts[i];
        const partTokens = estimateTokens(part.text);

        if (partTokens <= tokensRemaining) {
          const overlapPart = {
            ...part,
            __isOverlap: true
          };
          overlapParts.unshift(overlapPart);
          tokensRemaining -= partTokens;
          continue;
        }

        const baseText = part.text;
        let low = 0;
        let high = baseText.length - 1;
        let bestStart = baseText.length - 1;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const candidate = baseText.slice(mid).trim();
          if (!candidate) {
            low = mid + 1;
            continue;
          }
          const candidateTokens = estimateTokens(candidate);
          if (candidateTokens <= tokensRemaining) {
            bestStart = mid;
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }

        let rawSlice = baseText.slice(bestStart);
        let trimmedSlice = rawSlice.trimStart();
        let leadingTrim = rawSlice.length - trimmedSlice.length;
        let effectiveStartIndex = bestStart + leadingTrim;
        let overlapText = trimmedSlice || baseText;
        let overlapStart = part.start !== null && part.start !== undefined
          ? part.start + effectiveStartIndex
          : null;

        let overlapTokens = estimateTokens(overlapText);
        while (overlapTokens > tokensRemaining && overlapText.length > 1) {
          rawSlice = rawSlice.slice(1);
          trimmedSlice = rawSlice.trimStart();
          leadingTrim = rawSlice.length - trimmedSlice.length;
          effectiveStartIndex += 1 + leadingTrim;
          overlapText = trimmedSlice || rawSlice;
          overlapStart = part.start !== null && part.start !== undefined
            ? part.start + effectiveStartIndex
            : null;
          overlapTokens = estimateTokens(overlapText);
        }

        const overlapEnd = part.end;

        overlapParts.unshift({
          ...part,
          text: overlapText,
          start: overlapStart,
          end: overlapEnd,
          __isOverlap: true
        });

        tokensRemaining = 0;
      }

      currentParts = overlapParts.slice();
      currentStart = overlapParts.length ? overlapParts[0].start : null;
      currentEnd = overlapParts.length ? overlapParts[overlapParts.length - 1].end : null;
    } else {
      currentParts = [];
      currentStart = null;
      currentEnd = null;
    }

    return true;
  };

  for (const segment of segments) {
    if (segment.type === 'heading') {
      let flushed = flushChunk();
      if (!flushed) {
        flushed = flushChunk(true);
      }
      if (flushed) {
        currentParts = [];
        currentStart = null;
        currentEnd = null;
      }
      currentHeading = extractHeadingTitle(segment.text);
      lastActiveHeading = currentHeading;
      continue;
    }

    const segmentTokens = estimateTokens(segment.text);

    if (getActiveTokenCount() + segmentTokens > bodyTokenBudget && currentParts.length) {
      if (!flushChunk()) {
        flushChunk(true);
      }
    }

    currentParts.push({
      ...segment,
      sectionHeading: currentHeading || lastActiveHeading || null,
      __isOverlap: false
    });
    currentStart = currentStart ?? segment.start;
    currentEnd = segment.end ?? currentEnd;
  }

  if (!flushChunk()) {
    flushChunk(true);
  }

  return chunks;
}

module.exports = {
  chunkArticle,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MIN_TOKENS,
  DEFAULT_OVERLAP_TOKENS
};
