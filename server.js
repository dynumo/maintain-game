const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'leaderboard.db');
const MAX_TIME_MS = 10 * 60 * 1000;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 24;
const RATE_LIMIT_MS = 2000;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const lastSubmitByIp = new Map();

app.get('/api/scores', (req, res) => {
  db.all(
    'SELECT name, time_ms, created_at FROM scores ORDER BY time_ms DESC, created_at ASC LIMIT 10',
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: 'db_error' });
        return;
      }
      res.json({ scores: rows });
    }
  );
});

app.post('/api/scores', (req, res) => {
  const now = Date.now();
  const ip = req.ip || 'unknown';
  const lastSubmit = lastSubmitByIp.get(ip) || 0;

  if (now - lastSubmit < RATE_LIMIT_MS) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const name = String(req.body.name || '').trim();
  const timeMs = Number(req.body.timeMs || 0);

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: 'invalid_name' });
    return;
  }

  if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > MAX_TIME_MS) {
    res.status(400).json({ error: 'invalid_time' });
    return;
  }

  const sanitizedName = name.replace(/[\n\r\t]/g, ' ');
  lastSubmitByIp.set(ip, now);

  db.run(
    'INSERT INTO scores (name, time_ms) VALUES (?, ?)',
    [sanitizedName, Math.round(timeMs)],
    (err) => {
      if (err) {
        res.status(500).json({ error: 'db_error' });
        return;
      }
      res.json({ ok: true });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Maintain running on http://localhost:${PORT}`);
});
