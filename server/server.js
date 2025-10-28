import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const CLEANUP_INTERVAL_DEFAULT = 5 * 60 * 1000;
export const CLEANUP_INTERVAL_MS = process.env.CLEANUP_INTERVAL_MS
  ? Number(process.env.CLEANUP_INTERVAL_MS)
  : CLEANUP_INTERVAL_DEFAULT;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const DB_PATH = process.env.DB_FILE || path.join(dataDir, 'sober-meet.sqlite');

const sqlite = sqlite3.verbose();
export const db = new sqlite.Database(DB_PATH);

db.serialize();

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function callback(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });

export async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      size INTEGER NOT NULL,
      radius REAL NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      owner TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      tags TEXT NULL
    )`);
  await run(`CREATE TABLE IF NOT EXISTS memberships (
      table_id TEXT NOT NULL,
      user TEXT NOT NULL,
      joined_at INTEGER NOT NULL
    )`);
  await run(
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id TEXT NOT NULL,
      user TEXT NOT NULL,
      text TEXT NOT NULL,
      ts INTEGER NOT NULL
    )`
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_memberships_table_id ON memberships(table_id)`
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_messages_table_id ON messages(table_id)`
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const app = express();
app.use(cors());
app.use(express.json());

export const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {
  socket.on('subscribe_table', (tableId) => {
    if (tableId) {
      socket.join(`table:${tableId}`);
    }
  });
  socket.on('unsubscribe_table', (tableId) => {
    if (tableId) {
      socket.leave(`table:${tableId}`);
    }
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/tables', async (req, res) => {
  try {
    const {
      title,
      size: rawSize = 3,
      radius: rawRadius = 1,
      lat: rawLat,
      lng: rawLng,
      duration: rawDuration = 180,
      owner: rawOwner = 'Гость',
      tags = null
    } = req.body ?? {};

    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (!trimmedTitle) {
      return res.status(400).json({ error: 'title required' });
    }

    const lat = Number.parseFloat(rawLat);
    const lng = Number.parseFloat(rawLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'coordinates required' });
    }

    let size = Number.parseInt(rawSize, 10);
    if (!Number.isFinite(size)) {
      size = 3;
    }
    size = clamp(size, 2, 12);

    let radius = Number.parseFloat(rawRadius);
    if (!Number.isFinite(radius) || radius <= 0) {
      radius = 1;
    }

    let durationMinutes = Number.parseFloat(rawDuration);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      durationMinutes = 180;
    }
    const durationSeconds = clamp(Math.round(durationMinutes * 60), 30 * 60, 6 * 60 * 60);

    const owner = typeof rawOwner === 'string' && rawOwner.trim() ? rawOwner.trim() : 'Гость';

    const createdAt = Math.floor(Date.now() / 1000);
    const expiresAt = createdAt + durationSeconds;
    const id = uuidv4();

    await run(
      `INSERT INTO tables (id, title, size, radius, lat, lng, owner, created_at, expires_at, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, trimmedTitle, size, radius, lat, lng, owner, createdAt, expiresAt, tags]
    );
    await run(
      `INSERT INTO memberships (table_id, user, joined_at) VALUES (?, ?, ?)`,
      [id, owner, createdAt]
    );

    io.emit('tables_updated', { id, event: 'created' });
    return res.status(201).json({ id });
  } catch (error) {
    console.error('Error creating table', error);
    return res.status(500).json({ error: 'internal error' });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const tables = await all(
      `SELECT t.*, (
          SELECT COUNT(*) FROM memberships m WHERE m.table_id = t.id
        ) as member_count
       FROM tables t
       WHERE t.expires_at > ?`,
      [now]
    );

    const queryLat = req.query.lat !== undefined ? Number.parseFloat(req.query.lat) : null;
    const queryLng = req.query.lng !== undefined ? Number.parseFloat(req.query.lng) : null;
    const queryRadius = req.query.radius !== undefined ? Number.parseFloat(req.query.radius) : null;
    const hasCoords = Number.isFinite(queryLat) && Number.isFinite(queryLng);

    const enriched = tables
      .map((row) => {
        const free = Math.max(0, row.size - (row.member_count ?? 0));
        const distance = hasCoords
          ? haversineDistance(queryLat, queryLng, row.lat, row.lng)
          : null;
        return {
          id: row.id,
          title: row.title,
          size: row.size,
          radius: row.radius,
          lat: row.lat,
          lng: row.lng,
          owner: row.owner,
          created_at: row.created_at,
          expires_at: row.expires_at,
          tags: row.tags,
          free,
          distance
        };
      })
      .filter((row) => {
        if (!hasCoords) {
          return true;
        }
        if (!Number.isFinite(queryRadius) || queryRadius <= 0) {
          return true;
        }
        return (row.distance ?? Infinity) <= queryRadius;
      });

    const sorted = enriched.sort((a, b) => {
      if (hasCoords) {
        return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      }
      return a.created_at - b.created_at;
    });

    return res.json(sorted);
  } catch (error) {
    console.error('Error listing tables', error);
    return res.status(500).json({ error: 'internal error' });
  }
});

app.post('/api/tables/:id/join', async (req, res) => {
  try {
    const tableId = req.params.id;
    const { user: rawUser } = req.body ?? {};
    const user = typeof rawUser === 'string' && rawUser.trim() ? rawUser.trim() : 'Гость';
    const now = Math.floor(Date.now() / 1000);

    const table = await get(
      `SELECT t.*, (
          SELECT COUNT(*) FROM memberships m WHERE m.table_id = t.id
        ) as member_count
       FROM tables t
       WHERE t.id = ?`,
      [tableId]
    );
    if (!table || table.expires_at <= now) {
      return res.status(404).json({ error: 'not found' });
    }

    const existing = await get(
      `SELECT 1 FROM memberships WHERE table_id = ? AND user = ?`,
      [tableId, user]
    );
    if (existing) {
      return res.json({ ok: true });
    }

    if ((table.member_count ?? 0) >= table.size) {
      return res.status(400).json({ error: 'table full' });
    }

    await run(
      `INSERT INTO memberships (table_id, user, joined_at) VALUES (?, ?, ?)`,
      [tableId, user, now]
    );

    io.to(`table:${tableId}`).emit('system', { type: 'join', user });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error joining table', error);
    return res.status(500).json({ error: 'internal error' });
  }
});

app.get('/api/tables/:id/messages', async (req, res) => {
  try {
    const tableId = req.params.id;
    const messages = await all(
      `SELECT id, table_id, user, text, ts FROM messages WHERE table_id = ? ORDER BY id ASC`,
      [tableId]
    );
    return res.json(messages);
  } catch (error) {
    console.error('Error fetching messages', error);
    return res.status(500).json({ error: 'internal error' });
  }
});

app.post('/api/tables/:id/messages', async (req, res) => {
  try {
    const tableId = req.params.id;
    const { user: rawUser = 'Гость', text: rawText } = req.body ?? {};
    const table = await get(`SELECT expires_at FROM tables WHERE id = ?`, [tableId]);
    const now = Math.floor(Date.now() / 1000);
    if (!table || table.expires_at <= now) {
      return res.status(404).json({ error: 'not found' });
    }

    const user = typeof rawUser === 'string' && rawUser.trim() ? rawUser.trim() : 'Гость';
    const trimmed = typeof rawText === 'string' ? rawText.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ error: 'text required' });
    }
    if (trimmed.length > 500) {
      return res.status(400).json({ error: 'text too long' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const result = await run(
      `INSERT INTO messages (table_id, user, text, ts) VALUES (?, ?, ?, ?)`,
      [tableId, user, trimmed, timestamp]
    );

    const message = {
      id: result.lastID,
      table_id: tableId,
      user,
      text: trimmed,
      ts: timestamp
    };

    io.to(`table:${tableId}`).emit('chat_message', message);
    return res.status(201).json(message);
  } catch (error) {
    console.error('Error posting message', error);
    return res.status(500).json({ error: 'internal error' });
  }
});

export async function cleanupExpiredEntries() {
  const now = Math.floor(Date.now() / 1000);
  await run(`DELETE FROM tables WHERE expires_at <= ?`, [now]);
  await run(
    `DELETE FROM memberships WHERE table_id NOT IN (SELECT id FROM tables)`
  );
  await run(
    `DELETE FROM messages WHERE table_id NOT IN (SELECT id FROM tables)`
  );
}

let cleanupTimer = null;
export function setCleanupInterval(ms = CLEANUP_INTERVAL_MS) {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  if (ms > 0) {
    cleanupTimer = setInterval(() => {
      cleanupExpiredEntries().catch((error) => {
        console.error('Cleanup error', error);
      });
    }, ms);
    if (typeof cleanupTimer.unref === 'function') {
      cleanupTimer.unref();
    }
  }
  return cleanupTimer;
}

await initDb();
await cleanupExpiredEntries();
setCleanupInterval(CLEANUP_INTERVAL_MS);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Sober Meet server running on port ${PORT}`);
  });
}
