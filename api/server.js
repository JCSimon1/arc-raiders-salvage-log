const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = process.env.CONFIG_DIR || '/config';

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function deepMerge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function readJson(file, required) {
  const p = path.join(CONFIG_DIR, file);
  if (!fs.existsSync(p)) {
    if (required) throw new Error(`Config-Datei fehlt: ${p}`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    throw new Error(`${file} ist kein gültiges JSON: ${err.message}`);
  }
}

function validateConfig(c) {
  if (!Array.isArray(c.lootCatalog) ||
      !c.lootCatalog.every(i => i.key && i.name && Number.isFinite(i.price))) {
    throw new Error('Config: lootCatalog braucht key, name und numerischen price je Eintrag.');
  }
  if (!Array.isArray(c.ranks) || !c.ranks.every(r => r.key && r.name)) {
    throw new Error('Config: ranks braucht key und name je Eintrag.');
  }
  if (!Array.isArray(c.companyLogos)) throw new Error('Config: companyLogos muss ein Array sein.');
  for (const m of ['money', 'xp', 'rounds']) {
    const b = c.badges && c.badges[m];
    if (!b || !['bronze', 'silver', 'gold', 'platinum'].every(t => Number.isFinite(b[t]))) {
      throw new Error(`Config: badges.${m} braucht bronze/silver/gold/platinum als Zahlen.`);
    }
  }
}

const CONFIG = deepMerge(readJson('config.default.json', true), readJson('config.json', false));
validateConfig(CONFIG);

const LOOT_CATALOG = CONFIG.lootCatalog;
const RANK_CATALOG = CONFIG.ranks;


const app = express();
app.use(cors());
app.use('/api/import', express.json({ limit: '10mb' }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rounds (
    id SERIAL PRIMARY KEY,
    round_number INTEGER NOT NULL,
    round_date DATE NOT NULL,
    round_time TIME NOT NULL,
    map TEXT NOT NULL,
    map_condition TEXT NOT NULL,
    money INTEGER NOT NULL,
    xp INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS loot_items (
    id SERIAL PRIMARY KEY,
    item_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

async function seedLootCatalog() {
  for (const item of LOOT_CATALOG) {
    await pool.query(
      `INSERT INTO loot_items (item_key, name, price)
       VALUES ($1, $2, $3)
       ON CONFLICT (item_key) DO UPDATE
       SET name = EXCLUDED.name, price = EXCLUDED.price`,
      [item.key, item.name, item.price]
    );
  }
}

async function initDb(retries = 20, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(SCHEMA);
      await seedLootCatalog();
      console.log('Datenbank bereit.');
      return;
    } catch (err) {
      console.log(`DB noch nicht bereit (Versuch ${attempt}/${retries}): ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Konnte keine Verbindung zur Datenbank herstellen.');
}

function toApi(row) {
  return {
    id: row.id,
    number: row.round_number,
    date: row.round_date instanceof Date
      ? row.round_date.toISOString().slice(0, 10)
      : String(row.round_date),
    time: String(row.round_time).slice(0, 5),
    map: row.map,
    condition: row.map_condition,
    money: row.money,
    xp: row.xp
  };
}

function toLootApi(row) {
  return {
    key: row.item_key,
    name: row.name,
    price: row.price,
    amount: row.amount
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  const { ui, maps, companyLogos, badges, badgeRules, charts, trophyRoom } = CONFIG;
  res.json({ ui, maps, companyLogos, badges, badgeRules, charts, trophyRoom, steamConfigured: steamConfigured()  });
});

app.get('/api/rounds', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM rounds ORDER BY round_date DESC, round_time DESC, round_number DESC'
    );
    res.json(rows.map(toApi));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Runden nicht laden.' });
  }
});

app.post('/api/rounds', async (req, res) => {
  const { round_number, round_date, round_time, map, map_condition, money, xp } = req.body;
  if (!round_date || !round_time || !map || !map_condition) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO rounds (round_number, round_date, round_time, map, map_condition, money, xp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [round_number, round_date, round_time, map, map_condition, money, xp]
    );
    res.status(201).json(toApi(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Runde nicht speichern.' });
  }
});

app.put('/api/rounds/:id', async (req, res) => {
  const { round_number, round_date, round_time, map, map_condition, money, xp } = req.body;
  if (!round_date || !round_time || !map || !map_condition) {
    return res.status(400).json({ error: 'Pflichtfelder fehlen.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE rounds
       SET round_number = $1,
           round_date = $2,
           round_time = $3,
           map = $4,
           map_condition = $5,
           money = $6,
           xp = $7
       WHERE id = $8
       RETURNING *`,
      [round_number, round_date, round_time, map, map_condition, money, xp, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Runde nicht gefunden.' });
    }
    res.json(toApi(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Runde nicht aktualisieren.' });
  }
});

app.delete('/api/rounds/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rounds WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Runde nicht löschen.' });
  }
});

// ---------- Loot ----------

app.get('/api/loot', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM loot_items ORDER BY price DESC, name ASC');
    res.json(rows.map(toLootApi));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Loot-Items nicht laden.' });
  }
});

app.put('/api/loot/:key', async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'Ungültige Menge.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE loot_items
       SET amount = $1, updated_at = now()
       WHERE item_key = $2
       RETURNING *`,
      [amount, req.params.key]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item nicht gefunden.' });
    }
    res.json(toLootApi(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Menge nicht aktualisieren.' });
  }
});

// ---------- Settings (Profil, aktuell nur Trials-Rang) ----------

async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return rows.length ? rows[0].value : null;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  );
}

app.get('/api/settings', async (req, res) => {
  try {
    const rank = await getSetting('rank');
    res.json({
      rank: rank || null,
      ranks: RANK_CATALOG
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Einstellungen nicht laden.' });
  }
});

app.put('/api/settings/rank', async (req, res) => {
  const { rank } = req.body;
  if (rank !== null && rank !== '' && typeof rank !== 'string') {
    return res.status(400).json({ error: 'Ungültiger Rang.' });
  }
  if (rank && !RANK_CATALOG.some(r => r.key === rank)) {
    return res.status(400).json({ error: 'Unbekannter Rang.' });
  }
  try {
    await setSetting('rank', rank || '');
    res.json({ rank: rank || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Rang nicht speichern.' });
  }
});

const STEAM_API_KEY = process.env.STEAM_API_KEY || '';
const STEAM_ID = process.env.STEAM_ID || '';
const STEAM_CACHE_MS = (CONFIG.steam.cacheSeconds || 300) * 1000;
let steamProfileCache = { data: null, ts: 0 };

function steamConfigured() {
  return Boolean(STEAM_API_KEY && STEAM_ID);
}

function personaStateLabel(state) {
  const map = {
    0: 'offline',
    1: 'online',
    2: 'busy',
    3: 'away',
    4: 'snooze',
    5: 'looking_to_trade',
    6: 'looking_to_play'
  };
  return map[state] ?? 'offline';
}

app.get('/api/steam/profile', async (req, res) => {
  if (!steamConfigured()) {
    return res.json({ configured: false });
  }
  try {
    const now = Date.now();
    if (steamProfileCache.data && (now - steamProfileCache.ts) < STEAM_CACHE_MS) {
      return res.json(steamProfileCache.data);
    }
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(STEAM_API_KEY)}&steamids=${encodeURIComponent(STEAM_ID)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Steam API Status ${r.status}`);
    const data = await r.json();
    const player = data && data.response && data.response.players && data.response.players[0];
    if (!player) throw new Error('Kein Steam-Profil in der Antwort gefunden.');

    const result = {
      configured: true,
      name: player.personaname,
      avatar: player.avatarfull,
      profileUrl: player.profileurl,
      status: personaStateLabel(player.personastate),
      inGame: Boolean(player.gameid)
    };
    steamProfileCache = { data: result, ts: now };
    res.json(result);
  } catch (err) {
    console.error('Steam-Profil-Fehler:', err.message);
    res.status(502).json({ configured: true, error: 'Steam-Profil konnte nicht geladen werden.' });
  }
});

const CSV_COLUMNS = ['number', 'date', 'time', 'map', 'condition', 'money', 'xp'];

function csvCell(value, sep) {
  const s = String(value ?? '');
  return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

app.get('/api/export', async (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await pool.query(
      'SELECT * FROM rounds ORDER BY round_date, round_time, round_number'
    );
    const rounds = rows.map(toApi).map(({ id, ...rest }) => rest);

    if (format === 'csv') {
      const sep = ';';
      const lines = [
        CSV_COLUMNS.join(sep),
        ...rounds.map(r => CSV_COLUMNS.map(c => csvCell(r[c], sep)).join(sep))
      ];
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="arc-log-rounds-${stamp}.csv"`
      });
      return res.send('\uFEFF' + lines.join('\r\n') + '\r\n');
    }

    const [lootRes, rank] = await Promise.all([
      pool.query('SELECT item_key, amount FROM loot_items ORDER BY item_key'),
      getSetting('rank')
    ]);

    const payload = {
      app: 'arc-log',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      rounds,
      loot: lootRes.rows.map(r => ({ key: r.item_key, amount: r.amount })),
      settings: { rank: rank || null }
    };

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="arc-log-backup-${stamp}.json"`
    });
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export fehlgeschlagen.' });
  }
});

// ---------- Import ----------

const IMPORT_MAX_ROUNDS = 50000;
const INT_MAX = 2147483647;

function parseRound(r) {
  if (!isObj(r)) return null;
  const date = String(r.date ?? '');
  const time = String(r.time ?? '').slice(0, 5);
  const map = String(r.map ?? '').trim();
  const condition = String(r.condition ?? '').trim();
  const number = Number(r.number), money = Number(r.money), xp = Number(r.xp);

  const d = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(d.getTime()) ||
      d.toISOString().slice(0, 10) !== date) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  if (!map || !condition) return null;
  for (const n of [number, money, xp]) {
    if (!Number.isInteger(n) || Math.abs(n) > INT_MAX) return null;
  }
  return { number, date, time, map, condition, money, xp };
}

const roundKey = r => [r.date, r.time, r.number, r.map].join('|');

app.post('/api/import', async (req, res) => {
  const mode = req.query.mode;
  if (mode !== 'merge' && mode !== 'replace') {
    return res.status(400).json({ error: 'Ungültiger Modus.' });
  }
  const dryRun = req.query.dryRun === '1';
  const data = req.body;

  if (!isObj(data) || data.app !== 'arc-log' || !Array.isArray(data.rounds)) {
    return res.status(400).json({ error: 'Keine gültige Arc-Log-Sicherung.' });
  }
  if (data.schemaVersion !== 1) {
    return res.status(400).json({ error: 'Nicht unterstützte Schema-Version.' });
  }
  if (data.rounds.length > IMPORT_MAX_ROUNDS) {
    return res.status(400).json({ error: `Maximal ${IMPORT_MAX_ROUNDS} Runden pro Import.` });
  }

  const valid = [];
  const errors = [];
  let invalid = 0;
  data.rounds.forEach((raw, i) => {
    const r = parseRound(raw);
    if (r) valid.push(r);
    else { invalid++; if (errors.length < 5) errors.push(i + 1); }
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT round_number, round_date, round_time, map FROM rounds'
    );
    const seen = new Set(
      mode === 'merge' ? existing.rows.map(row => roundKey(toApi(row))) : []
    );

    const fresh = [];
    let duplicates = 0;
    for (const r of valid) {
      const k = roundKey(r);
      if (seen.has(k)) { duplicates++; continue; }
      seen.add(k);
      fresh.push(r);
    }

    if (mode === 'replace') await client.query('DELETE FROM rounds');

    if (fresh.length) {
      await client.query(
        `INSERT INTO rounds (round_number, round_date, round_time, map, map_condition, money, xp)
         SELECT * FROM unnest($1::int[], $2::date[], $3::time[], $4::text[], $5::text[], $6::int[], $7::int[])`,
        [
          fresh.map(r => r.number), fresh.map(r => r.date), fresh.map(r => r.time),
          fresh.map(r => r.map), fresh.map(r => r.condition),
          fresh.map(r => r.money), fresh.map(r => r.xp)
        ]
      );
    }

    let lootUpdated = null;
    let rankApplied = false;

    if (mode === 'replace') {
      if (Array.isArray(data.loot)) {
        await client.query('UPDATE loot_items SET amount = 0, updated_at = now()');
        lootUpdated = 0;
        for (const l of data.loot) {
          if (!isObj(l) || typeof l.key !== 'string' ||
              !Number.isInteger(l.amount) || l.amount < 0 || l.amount > INT_MAX) continue;
          const r = await client.query(
            'UPDATE loot_items SET amount = $1, updated_at = now() WHERE item_key = $2',
            [l.amount, l.key]
          );
          lootUpdated += r.rowCount;
        }
      }
      const rank = isObj(data.settings) ? data.settings.rank : undefined;
      if (rank === null || (typeof rank === 'string' &&
          (rank === '' || RANK_CATALOG.some(r => r.key === rank)))) {
        await client.query(
          `INSERT INTO app_settings (key, value, updated_at) VALUES ('rank', $1, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [rank || '']
        );
        rankApplied = true;
      }
    }

    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');

    res.json({
      mode, dryRun,
      total: data.rounds.length,
      inserted: fresh.length,
      duplicates,
      invalid,
      errors,
      deleted: mode === 'replace' ? existing.rowCount : 0,
      lootUpdated,
      rankApplied
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Import fehlgeschlagen. Es wurde nichts verändert.' });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API läuft auf Port ${PORT}`));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });