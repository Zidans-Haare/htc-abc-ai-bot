const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../hochschuhl-abc.db');
const db = new sqlite3.Database(dbPath);

const tablesToFix = [
  'auth_sessions',
  'chat_interactions',
  'conversations',
  'hochschuhl_abc',
  'messages',
  'pdfs',
  'question_cache',
  'user_sessions'
];

const dateFields = {
  auth_sessions: ['created_at', 'last_activity', 'expires_at'],
  chat_interactions: ['timestamp'],
  conversations: ['created_at'],
  hochschuhl_abc: ['lastUpdated', 'updated_at', 'archived'],
  messages: ['created_at'],
  pdfs: ['createdAt', 'updatedAt'],
  question_cache: ['createdAt', 'updatedAt'],
  user_sessions: ['started_at', 'last_activity', 'ended_at']
};

const textFields = {
  auth_sessions: ['session_token', 'username', 'role'],
  chat_interactions: ['session_id', 'question', 'answer', 'error_message'],
  conversations: ['id', 'anonymous_user_id', 'category'],
  hochschuhl_abc: ['headline', 'text', 'editor', 'pdfPath'],
  messages: ['conversation_id', 'role', 'content'],
  pdfs: ['filename', 'filepath', 'description'],
  question_cache: ['question', 'answer', 'status'],
  user_sessions: ['session_id', 'ip_address', 'user_agent']
};

async function fixTable(table) {
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
          if (row[field] && typeof row[field] === 'string') {
            const date = new Date(row[field]);
            if (!isNaN(date.getTime())) {
              const iso = date.toISOString();
              db.run(`UPDATE ${table} SET ${field} = ? WHERE id = ?`, [iso, row.id], (err) => {
                if (err) console.error(`Error updating ${field} in ${table}:`, err);
                else updates++;
              });
            }
          }
        }

        // Clean text fields
        const tf = textFields[table] || [];
        for (const field of tf) {
          if (row[field] && typeof row[field] === 'string') {
            const cleaned = row[field].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
            if (cleaned !== row[field]) {
              db.run(`UPDATE ${table} SET ${field} = ? WHERE id = ?`, [cleaned, row.id], (err) => {
                if (err) console.error(`Error updating ${field} in ${table}:`, err);
                else updates++;
              });
            }
          }
        }
      }

      // Wait a bit for updates
      setTimeout(() => {
        console.log(`${table}: ${updates} updates made`);
        resolve();
      }, 100);
    });
  });
}

async function fixAll() {
  for (const table of tablesToFix) {
    await fixTable(table);
  }
  db.close((err) => {
    if (err) console.error('Error closing db:', err);
    else console.log('DB closed');
  });
}

fixAll();