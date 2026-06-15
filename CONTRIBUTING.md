# Contributing to StickerDex

Thanks for helping out! Whether it's code, design, or correcting sticker data, contributions are
very welcome.

## Ways to contribute

- 🐛 **Bug reports** — open an issue with steps to reproduce.
- ✨ **Features** — open an issue to discuss before large changes.
- 🏷️ **Data corrections** — a wrong player name/number, club, or colour. See
  [Working with the data](#working-with-the-data).
- 🎨 **Design & docs** — UI polish, screenshots, clearer docs.

## Development setup

Requires **Node 20+**. The generated data is committed, so no generate step is needed to start.

```bash
npm install
npm run dev      # backend :3001 + frontend :5173 (parallel; one Ctrl+C stops both)
npm test         # backend (vitest) + frontend (vitest + RTL) — run before pushing
npm run lint     # type-checks both apps
```

## Working with the data

The catalog (`backend/src/data/*.json`) is **generated** from open sources and committed. Each
generator is independent:

| Command | Builds | From |
| ------- | ------ | ---- |
| `npm run generate-checklist -w backend` | `checklist.json` (code → player) | Panini checklist references |
| `npm run generate-players -w backend` | `players.json` (squads: position, club, caps, goals) | Wikipedia squads (MediaWiki API) |
| `npm run generate-matches -w backend` | `matches.json`, `venues.json`, `match-teams.json` | vendored openfootball files (CC0) |
| `npm run generate-dataset -w backend` | `stickers.json`, `teams.json` | folds checklist + squads + flag colours |

**Fixing a single wrong sticker or score** is easiest **in the app** — everything (sticker
ownership, player slots via re-seed, match results) is editable at runtime; no PR required.

**Contributing a correction to the shared dataset:**

1. Fix it at the source — a mapping in `generate-checklist.ts`, a colour/group in the `TEAMS`
   array of `generate-dataset.ts`, etc.
2. Re-run the relevant `generate-*` script, then `npm run generate-dataset`.
3. Commit **both** the script change and the regenerated JSON, and **cite a source** in the PR.

## Pull request checklist

- [ ] `npm test` and `npm run lint` pass
- [ ] Data changes include the regenerated JSON and a cited source
- [ ] Commits are focused and clearly described

## Code style

- TypeScript everywhere, `strict` mode.
- Keep modules small and pure where possible (the `services/` and `lib/` folders are dependency-light
  on purpose so they're easy to test).
- Match the surrounding style; no need for a heavy formatter config.

## Commit & branch

Branch off `main`, open a PR against `main`. We use clear, imperative commit messages
(e.g. `Add Brazil squad names`).
