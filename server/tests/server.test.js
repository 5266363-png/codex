process.env.DB_FILE = ':memory:';
process.env.CLEANUP_INTERVAL_MS = '0';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  db,
  cleanupExpiredEntries,
  httpServer,
  initDb,
  io,
  setCleanupInterval
} from '../server.js';

const runSql = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function callback(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });

const getAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });

describe('Sober Meet server', () => {
  beforeAll(async () => {
    await initDb();
    setCleanupInterval(0);
  });

  afterAll(async () => {
    setCleanupInterval(0);
    await cleanupExpiredEntries();
    io.close();
    httpServer.close();
    await new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it('returns health check', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  let tableId;

  it('creates a table and returns id', async () => {
    const response = await request(app).post('/api/tables').send({
      title: 'Утренний чай',
      size: 3,
      radius: 1,
      lat: 7.89,
      lng: 98.29,
      duration: 60,
      owner: 'Аня'
    });
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    tableId = response.body.id;

    const memberships = await getAll(
      'SELECT * FROM memberships WHERE table_id = ? AND user = ?',
      [tableId, 'Аня']
    );
    expect(memberships.length).toBe(1);
  });

  it('lists tables sorted by distance when coords provided and by time otherwise', async () => {
    const nearby = await request(app)
      .get('/api/tables')
      .query({ lat: 7.8905, lng: 98.296, radius: 5 });
    expect(nearby.status).toBe(200);
    expect(Array.isArray(nearby.body)).toBe(true);
    expect(nearby.body[0]).toHaveProperty('distance');
    expect(nearby.body[0]).toHaveProperty('free');

    const general = await request(app).get('/api/tables');
    expect(general.status).toBe(200);
    expect(Array.isArray(general.body)).toBe(true);
    expect(general.body[0]).toHaveProperty('free');
  });

  it('allows joining idempotently and blocks when full', async () => {
    const create = await request(app).post('/api/tables').send({
      title: 'Совместный завтрак',
      size: 2,
      lat: 7.89,
      lng: 98.29,
      duration: 60,
      owner: 'Катя'
    });
    const joinTableId = create.body.id;

    const first = await request(app)
      .post(`/api/tables/${joinTableId}/join`)
      .send({ user: 'Игорь' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/tables/${joinTableId}/join`)
      .send({ user: 'Игорь' });
    expect(second.status).toBe(200);

    const third = await request(app)
      .post(`/api/tables/${joinTableId}/join`)
      .send({ user: 'Мария' });
    expect(third.status).toBe(400);
    expect(third.body).toEqual({ error: 'table full' });
  });

  it('stores and retrieves chat messages', async () => {
    const post = await request(app)
      .post(`/api/tables/${tableId}/messages`)
      .send({ user: 'Аня', text: 'Привет всем!' });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({ user: 'Аня', text: 'Привет всем!' });

    const history = await request(app).get(`/api/tables/${tableId}/messages`);
    expect(history.status).toBe(200);
    expect(history.body.length).toBeGreaterThan(0);
    expect(history.body[0]).toHaveProperty('text');
  });

  it('cleans up expired tables and dangling data', async () => {
    const expiredId = 'expired-table';
    const now = Math.floor(Date.now() / 1000) - 10;
    await runSql(
      `INSERT INTO tables (id, title, size, radius, lat, lng, owner, created_at, expires_at, tags)
       VALUES (?, 'Старый стол', 2, 1, 0, 0, 'Гость', ?, ?, NULL)`,
      [expiredId, now, now]
    );
    await runSql(
      `INSERT INTO memberships (table_id, user, joined_at) VALUES (?, 'Гость', ?)`,
      [expiredId, now]
    );
    await runSql(
      `INSERT INTO messages (table_id, user, text, ts) VALUES (?, 'Гость', 'Сообщение', ?)`,
      [expiredId, now]
    );

    await cleanupExpiredEntries();
    const remaining = await getAll('SELECT * FROM tables WHERE id = ?', [expiredId]);
    expect(remaining.length).toBe(0);
    const orphanMemberships = await getAll(
      'SELECT * FROM memberships WHERE table_id = ?',
      [expiredId]
    );
    expect(orphanMemberships.length).toBe(0);
  });
});
