# AGENTS.md

## Project overview

**Octavia Reading Quest** is a client-only React + Vite PWA for kid-focused reading and math games. There is no backend in this repo; progress is stored in browser `localStorage`. Optional cloud sync uses hosted Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`.

## Common commands

See `package.json` scripts:

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server (default port **5173**) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

There is no configured ESLint, Prettier, Vitest, or Playwright script. In-browser `console.assert` self-tests run on module load in `src/App.jsx` and several `src/lib/*` files.

## Cursor Cloud specific instructions

### Services

| Service | Required? | Notes |
|---------|-----------|-------|
| Vite dev server (`npm run dev`) | **Yes** | Single app; bind with `--host 0.0.0.0` when testing from the Desktop browser pane |
| Supabase (hosted) | **No** | Only for sign-in / cloud progress sync. Without `.env.local`, the app runs fully offline in local-only mode and logs expected Supabase skip assertions in the console |

### Startup

1. From repo root: `npm run dev -- --host 0.0.0.0`
2. Open `http://127.0.0.1:5173/` in the browser

Use a tmux session for long-running dev servers so they survive between agent steps.

### Lint / test / build

- **Lint:** not configured in this repo
- **Tests:** no npm test script; self-tests are `console.assert` checks that run when the app loads in a browser
- **Build:** `npm run build` (also validates TypeScript config and Vite bundling)

### Gotchas

- **Cloud sync warnings are normal in dev** without `.env.local`. Core gameplay, stars, and localStorage persistence work without Supabase.
- **Web Speech API** (TTS in Letter Echo / Sound Pop) depends on the browser; Chrome/Edge work best. The app degrades gracefully if speech is unavailable.
- **PWA service worker** is generated on `npm run build`; use `npm run preview` to test production/PWA behavior, not `npm run dev`.
- **No README** in the repo; `package.json` and this file are the primary setup references.
