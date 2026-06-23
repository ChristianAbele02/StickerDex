# 🖥️ StickerDex Desktop (Windows)

StickerDex ships as a **standalone Windows desktop app** — a single window, no
Docker, no terminal. Under the hood it's the *same* StickerDex: the real Fastify
backend and React frontend, wrapped in an [Electron](https://www.electronjs.org/)
shell. Your collection lives in a local SQLite database under your user profile.

> The desktop app is **additive**. The localhost/Docker setup is fully intact as
> a **Plan-B fallback** — see [Fallbacks](#fallbacks). Nothing about `npm run dev`
> or `docker compose up` changed.

---

## How it works

```
┌─ StickerDex.exe (Electron) ─────────────────────────────────────────┐
│  main process (Node)                                                 │
│    • sets DATABASE_PATH / STICKERDEX_DATA_DIR / STICKERDEX_PUBLIC_DIR │
│    • auto-backup → seed() → seedTournament()                         │
│    • Fastify.listen(127.0.0.1, <random free port>)                   │
│        ├─ /api/*            the existing REST API                    │
│        └─ @fastify/static   serves the bundled React SPA             │
│                                                                      │
│  BrowserWindow (Chromium, hardened) ── loads http://127.0.0.1:<port> │
└──────────────────────────────────────────────────────────────────────┘
         │
         ▼  user data (writable, survives uninstall):
   %APPDATA%\StickerDex\
     ├─ data\stickerdex.db (+ -wal/-shm)   your collection & results
     ├─ data\backups\*.db                   automatic + manual snapshots
     └─ secret.key                          random cookie-signing secret
```

The backend is embedded **in the Electron main process** (not a child process),
bound to **loopback only** on an OS-assigned ephemeral port. The window loads
that local URL over HTTP, so the SPA's relative `/api` calls and the signed auth
cookie behave exactly as in the server deployments — single origin, no CORS.

The bundled datasets (`stickers.json`, `matches.json`, …) and the built SPA are
copied into the app's `resources/` folder at build time and pointed at via
`STICKERDEX_DATA_DIR` / `STICKERDEX_PUBLIC_DIR`.

---

## Install

Grab the latest from the [Releases page](https://github.com/ChristianAbele02/StickerDex/releases):

| Artifact | What it is |
| -------- | ---------- |
| **`StickerDex-Setup-<version>.exe`** | Per-user installer (no admin needed). Adds Start-menu + desktop shortcuts and an uninstaller. |
| **`StickerDex-<version>-portable.exe`** | Portable — run it from anywhere (USB stick included), nothing installed. |

> **First-run SmartScreen warning.** Until the binaries are code-signed, Windows
> SmartScreen shows *"Windows protected your PC / unknown publisher."* Click
> **More info ▸ Run anyway**. This is expected for unsigned open-source apps —
> see [Code signing](#code-signing-optional) to remove it.

Your data is **never** stored next to the program; it lives in
`%APPDATA%\StickerDex` and survives upgrades and uninstalls. Open it from the app
menu: **File ▸ Open data folder**.

---

## Build from source

### Prerequisites
- **Node 20+** and npm
- Windows build tools for the native `better-sqlite3` module: **Python 3** and
  **Visual Studio Build Tools** (the "Desktop development with C++" workload).
  `npm install` uses prebuilt binaries when available and only compiles as a
  fallback.

### Steps (from the repo root)

```bash
npm install                       # backend + frontend deps
npm run desktop:install           # desktop (Electron) deps — one-time

# Run the desktop app from source (builds SPA + bundles + rebuilds native + launches):
npm run desktop:start

# Produce the installer + portable exe in desktop/dist:
npm run dist:win
```

What the scripts do:

| Script | Action |
| ------ | ------ |
| `desktop:install` | `npm install` inside `desktop/` (kept out of the workspace so its Electron-ABI `better-sqlite3` never clobbers the dev/test copy). |
| `desktop:build` | Build the SPA, then `make-icon` (`desktop/icon.svg` → multi-resolution `icon.ico`) and esbuild-bundle the Electron main/preload + copy resources. |
| `desktop:start` | `desktop:build` → `electron-rebuild` (native module for Electron) → launch `electron .`. |
| `dist:win` | `desktop:build` → `electron-builder --win` → `StickerDex-Setup-*.exe` + `StickerDex-*-portable.exe`. |

The build is split into small steps on purpose (`desktop/scripts/build.mjs`,
`make-icon.mjs`) so each is independently debuggable — see
[`DESKTOP_BUILD_LOG.md`](DESKTOP_BUILD_LOG.md).

---

## Security model

The desktop shell is hardened along Electron's recommended lines:

- **Renderer is locked down:** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`. The preload exposes only a tiny read-only
  bridge (`window.stickerdex.version()`); privileged actions stay in the main
  process behind the native menu.
- **Strict Content-Security-Policy** injected on every response
  (`default-src 'self'`; no remote scripts or network connections).
- **Navigation is pinned to the loopback origin** — `will-navigate` to anything
  else is cancelled and opened in your real browser; `window.open` is denied and
  routed to the OS browser (`shell.openExternal`).
- **Loopback-only server.** Fastify binds `127.0.0.1` on an ephemeral port — it's
  never exposed on the network.
- **Per-user, no elevation.** The NSIS installer installs per-user (no admin),
  and data lives in the writable `%APPDATA%`, never under `Program Files`.
- **Signed auth cookie** uses a random secret generated once and stored in
  `%APPDATA%\StickerDex\secret.key`, not a shipped default.
- **Single-instance lock** so two windows can't fight over the same database.

The optional write password still works: set `STICKERDEX_PASSWORD` in the
environment before launching to gate all writes behind a login.

---

## Fallbacks

The desktop app does not replace anything. All original run modes still work:

1. **Docker (Plan B, recommended for servers/NAS):**
   ```bash
   docker compose up -d --build      # → http://localhost:8080
   ```
2. **Local dev:**
   ```bash
   npm run dev                       # API :3001 + Vite :5173
   ```
3. **Single-process localhost (new, bonus):** run the backend so it *also* serves
   the built SPA on one port — handy on a headless box without nginx:
   ```bash
   npm run build --workspace=frontend
   STICKERDEX_PUBLIC_DIR=./frontend/dist npm run start --workspace=backend
   # → whole app on http://localhost:3001
   ```
   This is the same `@fastify/static` path the desktop app uses; when
   `STICKERDEX_PUBLIC_DIR` is unset it's a no-op, so dev and Docker are unaffected.

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| **SmartScreen "unknown publisher"** | Expected for unsigned builds — **More info ▸ Run anyway**, or [sign the build](#code-signing-optional). |
| **`electron .` exits instantly running as Node** (`app` is undefined) | An inherited `ELECTRON_RUN_AS_NODE=1` env var forces Node mode. Unset it: `set ELECTRON_RUN_AS_NODE=` (cmd) / `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell). |
| **`NODE_MODULE_VERSION` mismatch / better-sqlite3 won't load** | The native module is built for the wrong runtime. Re-run `npm --prefix desktop run rebuild`. |
| **"frontend build not found" during bundle** | Build the SPA first: `npm run build --workspace=frontend` (or just use `npm run desktop:build`). |
| **Where is my collection?** | `%APPDATA%\StickerDex\data` — or **File ▸ Open data folder** in the app. |
| **Want a fresh start** | Close the app and delete `%APPDATA%\StickerDex` (back up `data\` first if you care about it). |

---

## Code signing (optional)

The release workflow ([`.github/workflows/release.yml`](../.github/workflows/release.yml))
signs automatically **only if** two repo secrets are present — otherwise it ships
unsigned, no failure:

1. `WINDOWS_CERT_BASE64` — your code-signing certificate (`.pfx`), base64-encoded.
2. `WINDOWS_CERT_PASSWORD` — the certificate's password.

electron-builder picks these up via `CSC_LINK` / `CSC_KEY_PASSWORD`. Add them in
**Settings ▸ Secrets and variables ▸ Actions** and the next tagged release is
signed — no code change needed.
