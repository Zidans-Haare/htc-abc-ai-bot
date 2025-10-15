const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../hochschuhl-abc.db');
const db = new sqlite3.Database(dbPath);

const tables = [
  'users',
  'auth_sessions',
  'feedback',
  'articles',
  'hochschuhl_abc',
  'questions',
  'conversations',
  'messages',
  'images',
  'pdfs',
  'question_cache',
  'user_sessions',
  'chat_interactions',
  'daily_question_stats',
  'token_usage',
  'page_views',
  'question_analysis_cache'
];

const dateFields = {
  users: ['created_at', 'updated_at'],
  auth_sessions: ['expires_at', 'created_at', 'updated_at'],
  feedback: ['submitted_at', 'created_at', 'updated_at'],
  articles: ['published_at', 'created_at', 'updated_at'],
  hochschuhl_abc: ['last_updated', 'archived', 'created_at', 'updated_at'],
  questions: ['last_updated', 'answered_at', 'created_at', 'updated_at'],
  conversations: ['created_at', 'updated_at'],
  messages: ['created_at', 'updated_at'],
  images: ['created_at', 'updated_at'],
  pdfs: ['created_at', 'updated_at'],
  question_cache: ['created_at', 'updated_at'],
  user_sessions: ['started_at', 'last_activity', 'ended_at', 'created_at', 'updated_at'],
  chat_interactions: ['timestamp', 'created_at', 'updated_at'],
  daily_question_stats: ['created_at', 'updated_at'],
  token_usage: ['timestamp', 'created_at', 'updated_at'],
  page_views: ['timestamp', 'created_at', 'updated_at'],
  question_analysis_cache: ['last_updated', 'created_at', 'updated_at']
};

const textFields = {
  users: ['username', 'password', 'role'],
  auth_sessions: ['token'],
  feedback: ['text'],
  articles: ['title', 'content', 'slug'],
  hochschuhl_abc: ['article', 'description', 'editor', 'pdf_path'],
  questions: ['question', 'answer', 'user', 'translation', 'feedback'],
  conversations: ['id', 'anonymous_user_id', 'category'],
  messages: ['conversation_id', 'role', 'content'],
  images: ['filename', 'description'],
  pdfs: ['filename', 'filepath', 'description'],
  question_cache: ['question', 'answer', 'status'],
  user_sessions: ['session_id', 'ip_address', 'user_agent'],
  chat_interactions: ['session_id', 'question', 'answer', 'error_message'],
  daily_question_stats: ['analysis_date', 'normalized_question', 'topic', 'languages_detected', 'original_questions'],
  token_usage: [],
  page_views: ['path'],
  question_analysis_cache: ['cache_key', 'normalized_question', 'topic', 'languages_detected', 'original_questions']
};

async function migrateTable(table) {
  return new Promise((resolve) => {
    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
      if (err) {
        console.error(`Error querying ${table}:`, err);
        resolve();
        return;
      }

      console.log(`${table}: ${rows.length} rows`);

      if (rows.length === 0) {
        resolve();
        return;
      }

      let updates = 0;

      for (const row of rows) {
        // Fix dates
        const df = dateFields[table] || [];
        for (const field of df) {
          if (row[field] && typeof row[field] === 'string' && !row[field].includes('T')) {
            const date = new Date(row[field]);
            if (!isNaN(date.getTime())) {
              const iso = date.toISOString();
              db.run(`UPDATE ${table} SET ${field} = ? WHERE id = ?`, [iso, row.id], (err) => {
                if (err) console.error(`Error updating ${field} in ${table}:`, err);
                else updates++;
              });
            }
          } else if (typeof row[field] === 'number') {
            const iso = new Date(row[field]).toISOString();
            db.run(`UPDATE ${table} SET ${field} = ? WHERE id = ?`, [iso, row.id], (err) => {
              if (err) console.error(`Error updating ${field} in ${table}:`, err);
              else updates++;
            });
          }
        }

        // Clean text fields
        const tf = textFields[table] || [];
        for (const field of tf) {
          if (row[field] && typeof row[field] === 'string') {
            // Remove control chars and common garbage
            const cleaned = row[field]
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
              .replace(/nnjkkk/g, '')
              .replace(/uu$/g, '')
              .replace(/jj$/g, '')
              .replace(/hh$/g, '');
            if (cleaned !== row[field]) {
              db.run(`UPDATE ${table} SET ${field} = ? WHERE id = ?`, [cleaned, row.id], (err) => {
                if (err) console.error(`Error updating ${field} in ${table}:`, err);
                else updates++;
              });
            }
          }
        }
      }

      // Wait for updates
      setTimeout(() => {
        console.log(`${table}: ${updates} updates made`);
        resolve();
      }, 500);
    });
  });
}

async function runMigration() {
  console.log('Starting Prisma migration data fixes...');
  for (const table of tables) {
    await migrateTable(table);
  }
  db.close((err) => {
    if (err) console.error('Error closing db:', err);
    else console.log('Migration complete. Database closed.');
  });
}

runMigration();