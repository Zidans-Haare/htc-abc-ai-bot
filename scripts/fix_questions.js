const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../hochschuhl-abc.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM questions", [], (err, rows) => {
  if (err) {
    console.error('Error querying:', err);
    return;
  }

  console.log('Total rows:', rows.length);

  for (const row of rows) {
    if (row.lastUpdated) {
      // Convert to ISO
      const date = new Date(row.lastUpdated);
      if (!isNaN(date.getTime())) {
        const iso = date.toISOString();
        console.log(`Updating lastUpdated for id ${row.id} from ${row.lastUpdated} to ${iso}`);
        db.run(`UPDATE questions SET lastUpdated = ? WHERE id = ?`, [iso, row.id], (err) => {
          if (err) console.error('Error updating date:', err);
        });
      } else {
        console.log(`Invalid date for id ${row.id}: ${row.lastUpdated}`);
      }
    }
    // Clean newlines in text fields
    const textFields = ['question', 'answer', 'user', 'translation', 'feedback'];
    for (const field of textFields) {
      if (row[field] && typeof row[field] === 'string') {
        const cleaned = row[field].replace(/\n/g, ' ').replace(/\r/g, ' ');
        if (cleaned !== row[field]) {
          console.log(`Cleaning ${field} for id ${row.id}`);
          db.run(`UPDATE questions SET ${field} = ? WHERE id = ?`, [cleaned, row.id], (err) => {
            if (err) console.error('Error updating:', err);
          });
        }
      }
    }
  }
});

function isValidUTF8(str) {
  try {
    return Buffer.from(str, 'utf8').toString('utf8') === str;
  } catch {
    return false;
  }
}

function cleanString(str) {
  // Remove invalid UTF-8 characters
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

db.close((err) => {
  if (err) console.error('Error closing db:', err);
  else console.log('DB closed');
});