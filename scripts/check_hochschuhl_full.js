const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../hochschuhl-abc.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM hochschuhl_abc WHERE id > 75", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }

  for (const row of rows) {
    console.log(`Row ${row.id}:`, row);
    // Fix text
    if (row.text) {
      let cleanedText = row.text;
      if (cleanedText.includes('nnjkkk')) {
        cleanedText = cleanedText.replace(/nnjkkk/g, '');
      }
      if (cleanedText.endsWith('uu')) {
        cleanedText = cleanedText.replace(/uu$/, '');
      }
      if (cleanedText.endsWith('jj')) {
        cleanedText = cleanedText.replace(/jj$/, '');
      }
      if (cleanedText.endsWith('hh')) {
        cleanedText = cleanedText.replace(/hh$/, '');
      }
      if (cleanedText !== row.text) {
        db.run(`UPDATE hochschuhl_abc SET text = ? WHERE id = ?`, [cleanedText, row.id], (err) => {
          if (err) console.error('Error updating text:', err);
          else console.log('Cleaned text for id', row.id);
        });
      }
    }
    // Fix lastUpdated
    if (typeof row.lastUpdated === 'number') {
      const iso = new Date(row.lastUpdated).toISOString();
      db.run(`UPDATE hochschuhl_abc SET lastUpdated = ? WHERE id = ?`, [iso, row.id], (err) => {
        if (err) console.error('Error updating lastUpdated:', err);
        else console.log('Fixed lastUpdated for id', row.id);
      });
    }
    // Fix updated_at
    if (row.updated_at && typeof row.updated_at === 'string' && !row.updated_at.includes('T')) {
      const date = new Date(row.updated_at);
      if (!isNaN(date.getTime())) {
        const iso = date.toISOString();
        db.run(`UPDATE hochschuhl_abc SET updated_at = ? WHERE id = ?`, [iso, row.id], (err) => {
          if (err) console.error('Error updating updated_at:', err);
          else console.log('Fixed updated_at for id', row.id);
        });
      }
    }
  }

  setTimeout(() => {
    db.close();
  }, 1000);
});