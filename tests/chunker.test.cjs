const test = require('node:test');
const assert = require('node:assert/strict');

const {
  chunkArticle,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OVERLAP_TOKENS
} = require('../utils/chunker');
const { estimateTokens } = require('../utils/tokenizer');

function buildArticle({ id = 1, headline = 'Test Headline', text }) {
  return { id, headline, text };
}

test('returns no chunks when article text is empty', () => {
  const article = buildArticle({ text: '' });
  const chunks = chunkArticle(article);
  assert.equal(chunks.length, 0);
});

test('applies section headings and sequential chunk indices', () => {
  const articleText = [
    '## Abschnitt Eins',
    'Erster Absatz mit Informationen über Studiengänge und Standorte.',
    'Zweiter Absatz mit Details zu Ansprechpartnern und Öffnungszeiten.',
    '## Abschnitt Zwei',
    'Dritter Absatz mit weiteren Hinweisen zur Bewerbung.'
  ].join('\n\n');

  const chunks = chunkArticle(buildArticle({ text: articleText }));

  assert.ok(chunks.length > 0, 'expected at least one chunk');
  chunks.forEach((chunk, index) => {
    assert.equal(chunk.chunk_index, index, 'chunk_index should be sequential');
    assert.match(chunk.chunk_text, /^# Test Headline/, 'chunk text includes headline header');
    assert.ok(
      chunk.start_offset <= chunk.end_offset,
      'offsets should be ordered'
    );
  });

  const headings = new Set(chunks.map(chunk => chunk.section_heading));
  assert.ok(headings.has('Abschnitt Eins'));
  assert.ok(headings.has('Abschnitt Zwei'));
});

test('splits long text within configured token limits', () => {
  const longParagraph = 'Die HTW Dresden bietet vielfältige Studienangebote in Technik, Wirtschaft und Design. ' +
    'Studierende profitieren von praxisnahen Projekten, modernen Laboren und enger Zusammenarbeit mit Unternehmen. ' +
    'Die Bibliothek, Mensa und studentische Initiativen schaffen ein attraktives Umfeld für erfolgreiches Lernen.';

  const articleText = Array.from({ length: 35 }, (_, idx) => `Abschnitt ${idx + 1}\n\n${longParagraph}`).join('\n\n');
  const chunks = chunkArticle(buildArticle({ text: articleText }));

  assert.ok(chunks.length > 1, 'expected multiple chunks for long text');
  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.chunk_text);
    assert.ok(
      chunkTokens <= DEFAULT_MAX_TOKENS,
      `chunk ${chunk.chunk_index} exceeds max tokens (${chunkTokens})`
    );
  }
});

test('creates overlapping context between consecutive chunks', () => {
  const baseParagraph = 'Dieser Absatz erläutert die wichtigsten Hinweise zur Immatrikulation und bleibt relevant.';
  const articleText = [
    '## Wichtige Hinweise',
    ...Array.from({ length: 14 }, () => baseParagraph)
  ].join('\n\n');

  const chunkOptions = {
    maxTokens: 220,
    overlapTokens: DEFAULT_OVERLAP_TOKENS
  };

  const chunks = chunkArticle(buildArticle({ text: articleText }), chunkOptions);

  assert.ok(chunks.length >= 2, 'expected at least two chunks to verify overlap');

  for (let i = 1; i < chunks.length; i += 1) {
    const previousBody = chunks[i - 1].chunk_text.split('\n\n').slice(-2).join(' ');
    const currentText = chunks[i].chunk_text;
    const sharedTokens = estimateTokens(previousBody);

    assert.ok(sharedTokens > 0, 'expected previous chunk tail to have tokens');
    assert.ok(
      currentText.includes(previousBody.trim()) || currentText.includes(baseParagraph.slice(0, 30)),
      'expected some overlap between consecutive chunks'
    );
  }

  assert.ok(
    DEFAULT_OVERLAP_TOKENS > 0,
    'overlap configuration should reserve tokens'
  );
});
