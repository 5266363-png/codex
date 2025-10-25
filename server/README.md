# Sober Meet Server

## Prerequisites
- Node.js 18+
- SQLite (the `sqlite3` npm package will download binaries automatically)

## Environment
Create a `.env` file based on `.env.example` to override the default port (4000).

## Commands
- `npm install` – install dependencies
- `npm run dev` – start in watch mode (auto restarts)
- `npm run start` – start once
- `npm run test` – run Vitest + Supertest suite

The server exposes REST endpoints under `/api` and emits realtime updates via Socket.IO.
