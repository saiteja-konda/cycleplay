const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'cycleplay.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Initialize schema
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error initializing schema', err.message);
      } else {
        console.log('Database schema initialized.');
        // Migration: add username column if missing
        db.run(`ALTER TABLE rides ADD COLUMN username TEXT DEFAULT 'Guest'`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added username column.');
          }
        });
        db.run(`ALTER TABLE rides ADD COLUMN name TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added name column.');
          }
        });
        db.run(`ALTER TABLE rides ADD COLUMN notes TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added notes column.');
          }
        });
        db.run(`ALTER TABLE rides ADD COLUMN rating INTEGER`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added rating column.');
          }
        });
        db.run(`ALTER TABLE rides ADD COLUMN photo_url TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added photo_url column.');
          }
        });
        db.run(`ALTER TABLE rides ADD COLUMN weather_condition TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added weather_condition column.');
          }
        });
        db.run(`ALTER TABLE rides ADD COLUMN weather_temp REAL`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added weather_temp column.');
          }
        });
        db.run(`ALTER TABLE rides ADD COLUMN weather_wind REAL`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Migration error:', err.message);
          } else if (!err) {
            console.log('Migration successful: added weather_wind column.');
          }
        });
      }
    });
  }
});

// Helper for promise-based queries
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = { db, dbRun, dbAll, dbGet };
