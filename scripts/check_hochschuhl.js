const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../hochschuhl-abc.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, archived FROM hochschuhl_abc WHERE archived IS NOT NULL", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }

  for (const row of rows) {
    console.log(`Row ${row.id}: archived = ${row.archived}`);
  }

  db.close();
});