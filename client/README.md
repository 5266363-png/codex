# Sober Meet Client

## Overview
React + Vite single-page application for coordinating sober meetups.

## Environment
Create a `.env` file (or `.env.local`) with optional overrides:

```
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_MAPS_API_KEY=your_optional_key
```

## Commands
- `npm install` – install dependencies
- `npm run dev` – start the dev server (default http://localhost:5173)
- `npm run build` – production build
- `npm run preview` – preview the production build
- `npm run test` – run Vitest + Testing Library suite

The UI prefers a dark palette with lime accents and uses Socket.IO for live updates.
