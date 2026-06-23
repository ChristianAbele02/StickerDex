/**
 * StickerDex desktop (Electron) main process.
 *
 * Wraps the existing Fastify backend — embedded *in this process*, bound to
 * loopback on an ephemeral port — and points a hardened Chromium window at it.
 * The same backend code that powers the localhost/Docker deployment runs here;
 * we only wire up paths and environment so user data lands in %APPDATA% and the
 * bundled datasets / built SPA are served from the packaged resources.
 *
 * Nothing here duplicates backend logic: it reuses buildApp(), getDb(), the
 * seeders, the auto-backup and the live-results feed from ../../backend/src.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

import { buildApp } from '../../backend/src/app.ts';
import { getDb, type DB } from '../../backend/src/db/index.ts';
import { seed } from '../../backend/src/db/seed.ts';
import { seedTournament } from '../../backend/src/db/seed-matches.ts';
import { createBackup } from '../../backend/src/services/backups.ts';
import { liveResultsEnabled, refreshResults } from '../../backend/src/services/resultsFeed.ts';

let mainWindow: BrowserWindow | null = null;
let dbRef: DB | null = null;

/** Directory holding the bundled SPA + datasets (and the window icon). */
function resourcesDir(): string {
  // Packaged: copied via electron-builder `extraResources` into resources/.
  // Dev (running build/main.js directly): desktop/resources next to build/.
  return app.isPackaged ? process.resourcesPath : join(__dirname, '..', 'resources');
}

/** Per-user data root: %APPDATA%\StickerDex\data (DB + backups live here). */
function dataRoot(): string {
  const dir = join(app.getPath('userData'), 'data');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function iconPath(): string {
  return join(resourcesDir(), 'icon.ico');
}

/**
 * Load (or create once) a random secret used to sign the auth cookie, persisted
 * under userData. Avoids shipping a static/default secret in the binary.
 */
function loadOrCreateSecret(): string {
  const file = join(app.getPath('userData'), 'secret.key');
  try {
    if (existsSync(file)) {
      const existing = readFileSync(file, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
  } catch {
    /* fall through to regenerate */
  }
  const secret = randomBytes(32).toString('hex');
  try {
    writeFileSync(file, secret, { mode: 0o600 });
  } catch {
    /* best effort — an in-memory secret still works for this run */
  }
  return secret;
}

/**
 * Boot the embedded backend: wire env, open/seed the DB (after a safety backup),
 * and start Fastify on 127.0.0.1 with an OS-assigned port. Returns the port.
 */
async function startServer(): Promise<number> {
  const res = resourcesDir();

  // The backend reads all of these lazily (inside functions), so setting them
  // here — before getDb()/buildApp() — is sufficient. `??=` lets an external
  // env override win (handy for debugging).
  process.env.DATABASE_PATH ??= join(dataRoot(), 'stickerdex.db');
  process.env.STICKERDEX_DATA_DIR ??= join(res, 'data');
  process.env.STICKERDEX_PUBLIC_DIR ??= join(res, 'web');
  process.env.STICKERDEX_SECRET ??= loadOrCreateSecret();
  process.env.LIVE_RESULTS ??= 'on';

  const db = getDb();
  dbRef = db;

  // Safety net: snapshot the collection before any reseed (reuse backend logic).
  try {
    const backup = createBackup(db, 'auto');
    if (backup) console.log(`Auto-backup: ${backup.name} (${backup.ownedStickers} owned).`);
  } catch (err) {
    console.warn('Auto-backup skipped:', (err as Error).message);
  }

  const stickers = seed(db);
  const matches = seedTournament(db);
  console.log(`Catalog ready: ${stickers} stickers, ${matches} matches.`);

  const server = await buildApp({ db, logger: false });
  await server.listen({ host: '127.0.0.1', port: 0 });
  const port = (server.server.address() as AddressInfo).port;
  console.log(`StickerDex API on http://127.0.0.1:${port}`);

  // Pull the latest played scores in the background (non-blocking, best effort).
  if (liveResultsEnabled()) {
    void refreshResults(db)
      .then((s) => console.log(`Live results: +${s.added} new, ${s.updated} updated.`))
      .catch((err) => console.warn('Live results skipped:', (err as Error).message));
  }

  return port;
}

/** Apply a strict Content-Security-Policy to every response in our session. */
function applyCsp(): void {
  const csp =
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " + // React inline style attrs (team colors) + bundled CSS
    "img-src 'self' data:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'none'";
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });
}

function createWindow(port: number): void {
  const origin = `http://127.0.0.1:${port}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 640,
    backgroundColor: '#0a3161',
    title: 'StickerDex',
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Security: keep navigation on our loopback origin; send anything else to the
  // user's real browser instead of loading it inside the app.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  void mainWindow.loadURL(`${origin}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open data folder',
          click: () => void shell.openPath(dataRoot()),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'StickerDex on GitHub',
          click: () => void shell.openExternal('https://github.com/ChristianAbele02/StickerDex'),
        },
        {
          label: 'About StickerDex',
          click: () =>
            dialog.showMessageBox({
              type: 'info',
              title: 'About StickerDex',
              message: `StickerDex ${app.getVersion()}`,
              detail:
                'A self-hosted digital sticker album & World Cup 2026 companion.\n' +
                'Your collection is stored locally — File ▸ Open data folder.',
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- App lifecycle ---------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  // Another instance owns the data/port — focus it and exit this one.
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.handle('app:version', () => app.getVersion());

  app.whenReady().then(async () => {
    applyCsp();
    try {
      const port = await startServer();
      createWindow(port);
      buildMenu();
    } catch (err) {
      dialog.showErrorBox(
        'StickerDex failed to start',
        String((err as Error)?.stack ?? err),
      );
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    try {
      dbRef?.close();
    } catch {
      /* ignore close errors on shutdown */
    }
  });
}
