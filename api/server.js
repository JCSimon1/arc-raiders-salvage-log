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
`;

async function initDb(retries = 20, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(SCHEMA);
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

app.delete('/api/rounds/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rounds WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Konnte Runde nicht löschen.' });
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
