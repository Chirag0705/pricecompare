# PriceCompare — Architecture & Development Guide

How the frontend and backend connect, and how a single command runs the whole app.

## TL;DR

```bash
npm run dev
```

That one command starts **everything**. Then open **http://localhost:5173**.

It runs two processes at once (via `concurrently`):

| Process | Command | Port | Role |
|---------|---------|------|------|
| Backend API | `npm run dev -w server` | **5000** | Express + Mongoose REST API |
| Frontend | `npm run dev -w client` | **5173** | Vite + React (HMR) |

The frontend does **not** talk to port 5000 directly. Vite proxies all `/api` traffic for you (see below), so the browser only ever talks to **http://localhost:5173**.

---

## 1. How frontend and backend are connected

```
Browser
   │  only ever talks to http://localhost:5173
   ▼
Vite dev server (client, port 5173)
   │  ├── serves the React app + Hot Module Replacement
   │  └── PROXIES any request starting with /api  ──►  http://localhost:5000/api
   ▼
Express API (server, port 5000)
   │  └── Mongoose ──► MongoDB (mongodb://127.0.0.1:27017/pricecompare)
```

### The proxy is the glue

Configured in `client/vite.config.js`:

```js
server: {
  port: 5173,
  proxy: { "/api": { target: "http://localhost:5000", changeOrigin: true } },
}
```

The React app calls relative URLs like `api/products/search`. Vite sees the `/api` prefix and forwards the request to the Express server on port 5000, then returns the result to the browser.

**Why this matters:**
- No CORS headaches in development — same origin (`5173`) for the page and the API.
- You never hardcode `http://localhost:5000` in frontend code.
- In production you'd put a real reverse proxy (nginx) or the Express static server in front, using the same `/api` convention.

### What the frontend sends

The API client is `client/src/api.ts` (Axios instance). Every call is a plain relative path:

- `api/auth/login`, `api/auth/register`
- `api/products/search`, `api/products/:id`
- `api/wishlist`, `api/alerts`, `api/notifications`
- `api/img/:listingId` (self-hosted product images)

Responses use one envelope shape: `{ success, data?, error? }`. The client's `unwrap()` helper strips it, so components work with plain data.

### Auth flow

1. Login → server returns a JWT.
2. Client stores it (localStorage) and Axios attaches `Authorization: Bearer <token>` to every request.
3. Server validates the token in middleware and loads the user onto `req.user`.
4. Role-based guards (`requireAuth`, `requireRole("admin")`) protect private/admin routes.

### Real-time / live data

- **Cache invalidation:** the server keeps a versioned cache. Any catalog write (sync, admin edit) bumps the version, so the next read is a cache miss and returns fresh data.
- **Polling for notifications:** the notification badge polls `api/notifications` on an interval, so new price-drop alerts appear without a manual refresh.

---

## 2. Why one command runs the entire webpage

The root `package.json` uses **npm workspaces** (`server`, `client`) and `concurrently`:

```json
"dev": "concurrently -n server,client -c blue,green \"npm run dev -w server\" \"npm run dev -w client\""
```

- **Workspaces** mean one `npm install` at the root installs dependencies for both apps, and `-w <name>` runs a script inside a workspace.
- **`concurrently`** launches both dev servers in a single terminal, interleaves their logs with `[server]` / `[client]` prefixes, and forwards shutdown signals to both.

So `npm run dev` = "start the API **and** the React app together, in one place."

### Each side's own dev runner

- **Server (`server`):** `nodemon src/index.js` — watches `src/**/*.js` and **restarts Express automatically** on any backend file save. MongoDB connection, cache, and the sync scheduler all boot on startup.
- **Client (`client`):** `vite` — serves the app with **Hot Module Replacement**. On a save it pushes the changed module to the browser and swaps it in place, preserving React state (no full reload).

---

## 3. Ports

| Service | Dev port | Notes |
|---------|----------|-------|
| Frontend (Vite) | 5173 | Open this in the browser. |
| Backend (Express) | 5000 | Reached *through* the Vite proxy, not directly by the browser. |
| MongoDB | 27017 | Local database. |

If a port is taken, Vite automatically bumps to the next free port (5174, 5175, …) and prints the new URL in the `[client]` log.

---

## 4. Useful commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start frontend + backend together (the one command). |
| `npm run dev -w server` | Start only the API. |
| `npm run dev -w client` | Start only the React app. |
| `npm run seed` | Seed stores, categories, and the admin user. |
| `npm run seed:catalog` | Seed the dev product catalog (`--force` to re-run). |
| `npm run build` | Production build of the client. |
| `npm start` | Run the built server for production. |

---

## 5. Project layout

```
pricecompare/
├── package.json          # workspaces + the "dev" script (concurrently)
├── client/               # Vite + React frontend
│   ├── vite.config.js    # port 5173 + /api proxy to :5000
│   └── src/
│       ├── api.ts        # Axios client (relative /api paths, JWT header)
│       └── ...
└── server/               # Express + Mongoose backend
    ├── .env              # MONGO_URI, JWT_SECRET, store API keys
    └── src/
        ├── index.js      # boot: connect DB, start Express + scheduler
        ├── routes/       # auth, products, wishlist, alerts, admin, img
        └── ...
```

---

## 6. Product images

Product images are **self-hosted** at `GET /api/img/:listingId`. The server renders an accurate SVG from each product's real title, brand, and colour, so the exact item is always depicted — no external photo CDNs and no random placeholder images. This keeps the app fully self-contained and avoids broken or mismatched images.
