const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Read version from package.json for cache busting
const packageJson = require('./package.json');
const APP_VERSION = packageJson.version;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'leaderboard.db');
const MAX_TIME_MS = 10 * 60 * 1000;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 24;
const RATE_LIMIT_MS = 2000;
const RESET_TOKEN = process.env.LEADERBOARD_RESET_TOKEN || null;

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

// Version API endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION });
});

// Serve index.html with version-tagged assets for cache busting
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      res.status(500).send('Error loading page');
      return;
    }

    // Set no-cache headers to ensure we always get the latest version injection
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    // Inject version query params into CSS and JS references
    const versionedHtml = html
      .replace('href="styles.css"', `href="styles.css?v=${APP_VERSION}"`)
      .replace('src="main.js"', `src="main.js?v=${APP_VERSION}"`)
      .replace("register('/service-worker.js')", `register('/service-worker.js?v=${APP_VERSION}')`);
    res.send(versionedHtml);
  });
});

app.use(express.static(path.join(__dirname, 'public')));

const lastSubmitByIp = new Map();

app.get('/api/scores', (req, res) => {
  // Set cache control headers to prevent stale data
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  db.all(
    'SELECT name, time_ms, created_at FROM scores ORDER BY time_ms DESC, created_at ASC LIMIT 20',
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

// Reset leaderboard endpoint - requires LEADERBOARD_RESET_TOKEN env var
app.delete('/api/scores', (req, res) => {
  // Check if reset token is configured
  if (!RESET_TOKEN) {
    res.status(403).json({ error: 'reset_not_configured', message: 'LEADERBOARD_RESET_TOKEN environment variable not set' });
    return;
  }

  // Validate the provided token
  const providedToken = req.headers['x-reset-token'] || req.query.token;
  if (!providedToken || providedToken !== RESET_TOKEN) {
    res.status(401).json({ error: 'invalid_token', message: 'Invalid or missing reset token' });
    return;
  }

  db.run('DELETE FROM scores', (err) => {
    if (err) {
      res.status(500).json({ error: 'db_error' });
      return;
    }
    console.log('Leaderboard reset by authorized request');
    res.json({ ok: true, message: 'Leaderboard has been reset' });
  });
});

app.listen(PORT, () => {
  console.log(`Maintain v${APP_VERSION} running on http://localhost:${PORT}`);
  if (RESET_TOKEN) {
    console.log('Leaderboard reset endpoint enabled (DELETE /api/scores)');
  }
});
