# Codex Server

Simple Express server that exposes a health check endpoint.

## Files

- `src/app.js` – Express application configured with CORS and the health endpoint.
- `src/index.js` – Server entry point that reads `PORT` from the environment (defaults to `4000`).
- `tests/health.test.js` – Vitest + Supertest test covering the `/api/health` route.
- `.env.example` – Example environment configuration.

## Acceptance Criteria

- The server enables CORS globally.
- `GET /api/health` responds with a `200` status code and `{ ok: true }` payload.
- The server listens on `process.env.PORT` or falls back to port `4000`.
- The health endpoint is covered by an automated test.

## Getting Started

```bash
pnpm install
```

Copy the example environment file if you need to customize the port:

```bash
cp .env.example .env
```

## Commands

- `pnpm --filter codex-server dev` – Start the server.
- `pnpm --filter codex-server start` – Run the server in production mode.
- `pnpm --filter codex-server test` – Execute the Vitest suite.
