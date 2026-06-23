# Desktop packaging — build & debug log

A step-by-step record of turning StickerDex into a standalone Windows app, every
issue hit, and how it was fixed. Companion to [DESKTOP.md](DESKTOP.md) (the how-to).

Environment: Windows 11 (10.0.26200), Node v22.16.0, npm 11.10.0, Python 3.13,
VS2022 present. Electron 42.4.1, electron-builder 26.15.3, better-sqlite3 12.x
(desktop) / 11.10.0 (backend).

---

## Approach

PageVault (the reference project) is Python → it used PyInstaller + WebView2 +
Inno Setup. StickerDex is **Node with a native module** (`better-sqlite3`), so the
faithful equivalent is **Electron + electron-builder**: a Chromium window over the
Fastify server embedded in the Electron main process, packaged to an NSIS
installer + portable exe, signing-ready in CI.

Guiding constraint: the dev/Docker localhost flows must keep working as **Plan B**,
so every backend change is additive and gated behind an env var.

---

## Backend changes (Plan-B safe)

1. **`backend/src/lib/dataPath.ts`** (new): `dataDir()` returns
   `STICKERDEX_DATA_DIR` if set, else the in-repo `src/data`. `seed.ts`,
   `seed-matches.ts` and `services/catalog.ts` now read datasets through it.
   Env unset → unchanged behavior.
2. **`backend/src/app.ts`**: when `STICKERDEX_PUBLIC_DIR` is set, register
   `@fastify/static` to serve the built SPA + an SPA fallback (non-API GET →
   `index.html`). Unset → not registered (dev uses Vite, Docker uses nginx).
3. Added `@fastify/static@^7` to backend deps.

Regression gate after these: `npm run lint` ✓, `npm test` ✓ (31 backend + 8
frontend), confirming Plan B intact.

---

## Build pipeline (all green)

| Step | Command | Result |
| ---- | ------- | ------ |
| Frontend SPA | `npm run build --workspace=frontend` | `frontend/dist` (index + 226 kB JS / 28 kB CSS) |
| Desktop deps | `npm --prefix desktop install` | 419 pkgs; Electron 42.4.1 binary |
| Typecheck | `desktop: tsc --noEmit` | clean (backend `.ts` imports + Electron types resolve) |
| Icon | `scripts/make-icon.mjs` | `resources/icon.ico` (16–256 px) from `favicon.svg` |
| Bundle | `scripts/build.mjs` (esbuild) | `build/main.js` (57 kB) + `preload.js`; copied `resources/{data,web}` |
| Native ABI | `electron-rebuild -f -w better-sqlite3` | desktop's better-sqlite3 rebuilt for Electron |

esbuild uses `packages: 'external'` — it bundles only first-party TS (the Electron
glue + the backend source it imports) and leaves npm deps as runtime requires
(robust for Fastify/pino; only `better-sqlite3` needs the native unpack).

---

## Issues hit & fixes

### 1. `import.meta` empty in the CJS bundle (esbuild warning)
esbuild warned that `import.meta.url` is empty in CJS output, used in two
dev-only/dead spots: `seed.ts`'s `npm run seed` CLI guard (never matches in-app)
and `dataPath.ts`'s fallback (never reached — desktop always sets
`STICKERDEX_DATA_DIR`).
**Fix:** made the `dataPath` fallback CJS-safe (`import.meta.url ? … : process.cwd()`)
so it can never throw, and added `logOverride: { 'empty-import-meta': 'silent' }`
to the esbuild config with a comment explaining why. Re-bundle: clean.

### 2. Electron launched as plain Node (`app` undefined)
First `electron .` crashed at `app.requestSingleInstanceLock()` —
`require('electron').app` was `undefined`, running under Electron's Node.
**Root cause:** the sandbox shell had **`ELECTRON_RUN_AS_NODE=1`** exported, which
forces Electron into Node mode. This is a sandbox quirk; real machines/CI don't
set it.
**Fix:** launch with the var unset (`env -u ELECTRON_RUN_AS_NODE …`). Documented in
DESKTOP.md troubleshooting. After this the app booted: *"Catalog ready: 991
stickers, 104 matches / StickerDex API on http://127.0.0.1:53024"*.

### 3. electron-builder rebuilt the **wrong** better-sqlite3 (and broke Plan B)
electron-builder's default `npmRebuild` detected the **repo as a workspace**
(`resolved=…\Stickerdex`) and tried to rebuild the **backend's** root
`better-sqlite3@11` for Electron — from source — which failed twice:
*"Attempting to build a module with a space in the path"* + *"Could not find any
Visual Studio installation"* (the space in `C:\Users\Bene User\…` trips node-gyp).
Worse, the failed rebuild **deleted the root copy's native binary**, breaking
`npm test`/dev/Docker.
**Fix (two parts):**
- Restored the root module: `npm rebuild better-sqlite3` (prebuild-install, system
  Node) → backend tests green again (31 pass).
- Set **`npmRebuild: false`** in `electron-builder.yml` so the packager never
  touches native deps, and added an explicit, *desktop-scoped*
  `electron-rebuild` step (which only rebuilds desktop's own copy — verified it
  leaves the root copy intact) to the `dist`/`pack` scripts and `release.yml`.

This is also why `desktop/` is intentionally **kept out of the npm workspaces**:
its Electron-ABI `better-sqlite3` must never become the one dev/tests/Docker load.

### 4. `EBUSY: resource busy or locked` on `StickerDex.exe`
Packaging reached the *"updating asar integrity executable resource"* step then
failed with `EBUSY` on the freshly-extracted `StickerDex.exe` — consistently,
twice. Diagnosis: Desktop is **not** OneDrive-synced, but **Windows Defender
real-time monitoring is ON** and locks the new unsigned 232 MB exe exactly while
electron-builder edits its resources. (CI runners don't hit this.)
**Constraint:** adding a Defender exclusion was (correctly) denied as a
security-weakening action, so it was *not* done.
**Fix/workaround:** the `win-unpacked` app dir is fully built *before* the resedit,
so the installer was produced with
`electron-builder --prepackaged dist/win-unpacked --win nsis` (and `… portable`),
which reuses the existing app dir and skips the blocked pack/resedit step. Both
artifacts built successfully this way.

> Note: when the resedit is skipped, the exe keeps Electron's default icon embedded;
> the installer, shortcuts and portable wrapper still carry StickerDex's icon. On CI
> (clean Defender) the normal `npm run dist:win` path resedits and brands the exe too.
> The EBUSY is intermittent — on a later run with Defender momentarily idle the resedit
> *did* succeed locally and `StickerDex.exe` was branded (verified by extracting the
> embedded icon). When it recurs, the `--prepackaged` two-step is the reliable fallback.

---

## 5. App icon

The first cut reused the 16px web favicon (`frontend/public/favicon.svg`) upscaled —
correct but plain for a 256px desktop icon. Replaced with a dedicated, app-icon-grade
mark at **`desktop/icon.svg`** (tracked; `resources/` is gitignored): a navy brand tile
holding a white collectible **sticker card with a peeled, gold-foil corner** and the
brand **star** (same star geometry as the favicon, for continuity), plus a diagonal
holographic sheen that nods to the app's "foil sticker" finish.

`scripts/make-icon.mjs` now rasterizes `desktop/icon.svg` (falling back to the favicon
if absent) at 256/128/64/48/32/16 px and packs a multi-resolution `resources/icon.ico`.
Verified: previewed the SVG at 256/48/32 px (legible down to 32 px), regenerated the
`.ico`, repackaged, and **extracted the embedded icon** from `StickerDex.exe`, the
installer and the portable exe — all three now show the StickerDex mark, not Electron's
default atom. Regression gate after the change: lint clean, **39 tests pass** (31 backend
+ 8 frontend), desktop typecheck clean.

---

## Verification (end-to-end)

1. **Plan B unaffected:** `npm run lint` ✓, `npm test` ✓ (39 tests), backend tests
   re-run green after the native-module scare.
2. **Headless server smoke** (`@fastify/static` + data-dir override + seeding):
   `/api/health`, `/api/stickers`, `/api/collection` → JSON; `/` and `/teams` →
   `index.html` (SPA + fallback). **PASS.**
3. **Dev Electron launch** (`electron .`): window boots, native module loads under
   Electron ABI, `/api/health` = `{"status":"ok"}`, `/` serves the SPA, DB created
   under the (overridden) data path — **not** in `backend/data/`.
4. **Fully-packaged exe** (`dist/win-unpacked/StickerDex.exe`): seeded 991 stickers
   + 104 matches from the **asar-bundled** datasets, server on `127.0.0.1:65241`,
   `/api/health` + `/api/stickers` OK, DB in the isolated dir. Confirms the asar
   main bundle, **unpacked** `better_sqlite3.node`, and bundled SPA/data all work.
5. **Installer + portable:** `StickerDex-Setup-0.1.0.exe` (~106 MB) + blockmap, and
   `StickerDex-0.1.0-portable.exe`, in `desktop/dist`.

---

## How CI differs (release.yml)

On `windows-latest`: `npm install` → `generate-dataset` → build frontend →
`npm --prefix desktop install` → `npm run rebuild` (native for Electron) →
`npm run build` (bundle) → `electron-builder --win --publish never`. The clean
Defender config there lets the standard pack path run, so the exe is branded and
the same NSIS + portable artifacts are produced and attached to the draft Release.
Signing is automatic only when the `WINDOWS_CERT_*` secrets exist.
