const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
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

// Statischer Item-Katalog. Preise hier pflegen, wenn sich das Spiel-Balancing ändert -
// beim nächsten Start werden name/price synchronisiert, ohne die erfasste amount zu überschreiben.
const LOOT_CATALOG = [
  { key: 'matriarchreactor',    name: 'Matriarch Reactor',    price: 11000 },
  { key: 'queenreactor',        name: 'Queen Reactor',        price: 11000 },
  { key: 'assessormatrix',      name: 'Assessor Matrix',      price: 5000 },
  { key: 'bastioncell',         name: 'Bastion Cell',         price: 3000 },
  { key: 'bombadiercell',       name: 'Bombadier Cell',       price: 3000 },
  { key: 'leaperpulseunit',     name: 'Leaper Pulse Unit',    price: 3000 },
  { key: 'rocketeerdriver',     name: 'Rocketeer Driver',     price: 3000 },
  { key: 'turbinecompressor',   name: 'Turbine Compressor',   price: 5000 },
  { key: 'vaporizerregulator',  name: 'Vaporizer Regulator',  price: 6000 }
];

// Statischer Rang-Katalog für die Trials-Rangauswahl im Profil-Bereich.
// key = Dateiname (ohne .webp) unter /images/ranks/. Passe Reihenfolge/Namen/Keys
// gern an deine eigenen Logo-Dateien an - muss nicht 1:1 zum Spiel passen.
const RANK_CATALOG = [
  { key: 'rookie1',        name: 'Rookie I' },
  { key: 'rookie2',        name: 'Rookie II' },
  { key: 'rookie3',        name: 'Rookie III' },
  { key: 'raider1',        name: 'Raider I' },
  { key: 'raider2',        name: 'Raider II' },
  { key: 'raider3',        name: 'Raider III' },
  { key: 'survivor1',      name: 'Survivor I' },
  { key: 'survivor2',      name: 'Survivor II' },
  { key: 'survivor3',      name: 'Survivor III' },
  { key: 'veteran1',       name: 'Veteran I' },
  { key: 'veteran2',       name: 'Veteran II' },
  { key: 'veteran3',       name: 'Veteran III' },
  { key: 'hotshot',        name: 'Hotshot' },
  { key: 'cantinalegend',  name: 'Cantina Legend' }
];

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

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API läuft auf Port ${PORT}`));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });