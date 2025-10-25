const fs = require('fs');
const path = require('path');

// Static config based on current schema - can be made dynamic later
const tableMappings = {
  users: 'users',
  artikels: 'hochschuhl_abc',
  fragen: 'questions',
  conversations: 'conversations',
  messages: 'messages',
  dokumente: 'documents',
  bilder: 'images',
  feedback: 'feedback',
  dashboard: ['article_views', 'page_views', 'daily_question_stats', 'daily_unanswered_stats', 'question_analysis_cache', 'token_usage', 'user_sessions', 'chat_interactions']
};

const dateFields = {
  users: ['created_at', 'updated_at'],
  hochschuhl_abc: ['archived', 'created_at', 'updated_at'],
  questions: ['answered_at', 'created_at', 'updated_at'],
  conversations: ['created_at', 'updated_at'],
  messages: ['created_at', 'updated_at'],
  feedback: ['submitted_at', 'created_at', 'updated_at'],
  documents: ['uploaded_at', 'created_at', 'updated_at'],
  images: ['created_at', 'updated_at'],
  article_views: ['viewed_at', 'created_at', 'updated_at'],
  page_views: ['timestamp', 'created_at', 'updated_at'],
  daily_question_stats: ['created_at', 'updated_at'],
  daily_unanswered_stats: ['created_at', 'updated_at'],
  question_analysis_cache: ['created_at', 'updated_at'],
  token_usage: ['timestamp', 'created_at', 'updated_at'],
  user_sessions: ['started_at', 'last_activity', 'ended_at', 'created_at', 'updated_at'],
  chat_interactions: ['timestamp', 'created_at', 'updated_at']
};

const fileMappings = {
  fragen: ['ai_fragen/offene_fragen.txt', 'ai_input/faq.txt'],
  dokumente: 'documents',
  bilder: 'images'
};

const whereKeys = {
  user_sessions: 'session_id'
};

// Function to dynamically parse schema.prisma
function parseSchema() {
  const schemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const models = {};
  const dateFieldsParsed = {};

  // Regex to match model definitions
  const modelRegex = /model (\w+) \{([^}]+)\}/g;
  let match;
  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const fieldsBlock = match[2];

    models[modelName] = modelName; // Assume table name same as model

    // Find DateTime fields
    const fieldRegex = /(\w+)\s+DateTime/g;
    let fieldMatch;
    const dates = [];
    while ((fieldMatch = fieldRegex.exec(fieldsBlock)) !== null) {
      dates.push(fieldMatch[1]);
    }
    if (dates.length > 0) {
      dateFieldsParsed[modelName] = dates;
    }
  }

  // Use static config only for tableMappings to avoid parsed conflicts
  const mergedTableMappings = tableMappings;
  const mergedDateFields = { ...dateFieldsParsed, ...dateFields };

  return { tableMappings: mergedTableMappings, dateFields: mergedDateFields, fileMappings, whereKeys };
}

const parsed = parseSchema();

module.exports = {
  tableMappings: parsed.tableMappings,
  dateFields: parsed.dateFields,
  fileMappings,
  whereKeys,
  parseSchema
};