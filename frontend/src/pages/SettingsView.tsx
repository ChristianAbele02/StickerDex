import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackupInfo, CollectionMap, MatchTeam } from '../types.ts';
import type { Settings } from '../hooks/useSettings.ts';
import { api } from '../api/client.ts';
import { ExportButtons } from '../components/ExportButtons.tsx';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  matchTeams: MatchTeam[];
  favorite: string;
  onFavorite: (code: string) => void;
}

const SIM_OPTIONS = [1000, 10000, 50000];

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function bytes(n: number): string {
  return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}
function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SettingsView({
  theme,
  onToggleTheme,
  settings,
  onSettings,
  matchTeams,
  favorite,
  onFavorite,
}: SettingsViewProps) {
  return (
    <div className="space-y-5">
      <BackupsSection />

      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <span className="text-sm">Theme</span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold dark:border-slate-700"
          >
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </Section>

      <Section title="Collection">
        <div className="space-y-3">
          <label className="flex items-center justify-between text-sm">
            <span>
              Stickers per pack
              <span className="ml-1 text-xs text-slate-400">(used for the “packs needed” estimate)</span>
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.stickersPerPack}
              onChange={(e) => onSettings({ stickersPerPack: Math.max(1, Number(e.target.value) || 1) })}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Favorite team</span>
            <select
              value={favorite}
              onChange={(e) => onFavorite(e.target.value)}
              className="max-w-[12rem] rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">None</option>
              {matchTeams.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Simulator">
        <label className="flex items-center justify-between text-sm">
          <span>Default simulations (Predict tab)</span>
          <select
            value={settings.defaultSimRuns}
            onChange={(e) => onSettings({ defaultSimRuns: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
          >
            {SIM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <ExportImportSection />
    </div>
  );
}

function BackupsSection() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.getBackups().then(setBackups).catch(() => setBackups([]));
  }, []);
  useEffect(refresh, [refresh]);

  const backupNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { backup } = await api.createBackup();
      setMsg(
        backup
          ? `✓ Backed up ${backup.ownedStickers} stickers (+${backup.spareCopies} spares).`
          : 'Nothing to back up yet.',
      );
      refresh();
    } catch (e) {
      setMsg(`⚠ Backup failed: ${(e as Error).message}. Is the backend running and up to date?`);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (b: BackupInfo) => {
    if (!window.confirm(`Restore "${b.name}"?\nThis replaces your current collection with this snapshot (${b.ownedStickers} stickers).`))
      return;
    setBusy(true);
    setMsg(null);
    try {
      await api.restoreBackup(b.name);
      window.location.reload(); // reload so the album reflects the restored data
    } catch (e) {
      setMsg(`⚠ Restore failed: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  const remove = async (b: BackupInfo) => {
    if (!window.confirm(`Delete backup "${b.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.deleteBackup(b.name);
      refresh();
    } catch (e) {
      setMsg(`⚠ Delete failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Backups & data safety"
      hint="A snapshot is saved automatically every time the app starts (whenever you have stickers). Backups are never deleted automatically — only you can remove them."
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={backupNow}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? 'Working…' : '💾 Back up now'}
        </button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>

      {backups.length === 0 ? (
        <p className="text-sm text-slate-400">No backups yet — collect some stickers and one is saved on the next start, or back up now.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-400 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Stickers</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{when(b.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${b.kind === 'auto' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                      {b.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {b.ownedStickers}
                    {b.spareCopies > 0 && <span className="text-slate-400"> (+{b.spareCopies})</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">{bytes(b.sizeBytes)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2 text-xs font-semibold">
                      <button type="button" onClick={() => restore(b)} disabled={busy} className="text-emerald-600 hover:underline disabled:opacity-50">
                        Restore
                      </button>
                      <a href={api.backupDownloadUrl(b.name)} className="text-slate-500 hover:underline">
                        Download
                      </a>
                      <button type="button" onClick={() => remove(b)} disabled={busy} className="text-red-500 hover:underline disabled:opacity-50">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function ExportImportSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onImport = async (file: File) => {
    setMsg('Importing…');
    try {
      const data = JSON.parse(await file.text());
      // Accept an exported file ({rows:[{code,count}]}), {collection:{}}, or a flat map.
      let map: CollectionMap = {};
      if (Array.isArray(data.rows)) {
        for (const r of data.rows) if (r.code) map[r.code] = Number(r.count) || 0;
      } else if (data.collection && typeof data.collection === 'object') {
        map = data.collection;
      } else if (typeof data === 'object') {
        map = data;
      }
      const { applied } = await api.importCollection(map);
      setMsg(`Imported ${applied} stickers — reloading…`);
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <Section
      title="Export / Import"
      hint="Download your whole collection as a file (a portable backup), or import one you exported earlier."
    >
      <div className="flex flex-wrap items-center gap-3">
        <ExportButtons filter="all" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold dark:border-slate-700"
        >
          Import JSON…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
        />
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </Section>
  );
}
