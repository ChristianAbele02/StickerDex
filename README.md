<div align="center">

# ⚽ StickerDex

**A self-hosted, open-source digital sticker album _and_ companion for the Panini™-style FIFA World Cup 2026 collection.**

Track every sticker you own — by both its code (`ARG17`) and who it really is (Lionel Messi) —
in a booklet-style web app, then follow the whole tournament alongside it: the full 104-match
schedule, live group standings, a knockout bracket, win-probability predictions, and a countdown
to the next kick-off. All on your own machine.

[![CI](https://github.com/ChristianAbele02/StickerDex/actions/workflows/ci.yml/badge.svg)](https://github.com/ChristianAbele02/StickerDex/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Self-hosted](https://img.shields.io/badge/self--hosted-Docker-blue)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white)

</div>

> **Disclaimer** — StickerDex is an independent, unofficial fan project. It is **not affiliated
> with, endorsed by, or sponsored by Panini, FIFA, or Coca-Cola**. It ships **no copyrighted
> artwork**: stickers are represented by designed code + name tiles. "World Cup" and team names
> are used descriptively. See [Data & accuracy](#-data--accuracy).

---

## ✨ Features

### Album
- 📖 **Booklet-style album** — every team gets its own page in team colors, with numbered slots
  laid out like the physical album (badge foil at #1, team photo at #13).
- ✅ **One-click collecting** — tap a slot to mark a sticker owned; empty slots stay "unstuck"
  but still name who belongs there.
- 🔁 **Duplicate & swap tracking** — count copies you own with the −/＋ controls and get an
  auto-generated swap list.
- 🇺🇳 **Real national flags** — team pages and your stuck-in stickers are painted with each
  nation's *actual* flag (stars, crescents, suns, crosses and emblems — not just colours),
  rendered as crisp inline SVG.
- 📊 **Live stats** — overall completion %, per-team progress bars, and a **coupon-collector**
  estimate of how many packs you still need (best case · expected · 90% worst case), so the last
  few stickers' duplicate-pull cost is accounted for.
- 🔍 **Search & filter** — find any sticker by code or player name; filter by missing / owned /
  duplicates / foils; jump to a group.
- 📤 **Export lists** — download your **missing** list or your **duplicates** list (with the
  number of spare copies per sticker) — or the full collection — as CSV or JSON.

### Teams
- 👥 **Teams hub** — a grid of all 48 nations as national-flag cards (group, collection progress,
  star player); search, filter by group and sort by completion. Tap one for a **squad dashboard**:
  fun-fact tiles (total caps, most-capped player, top scorer, clubs represented), the team's
  current group standing and next fixture, and a grid of **player cards** (shirt number, position,
  club, caps & goals) — filterable by position — that you can collect right from there. Owned
  players light up, missing ones are dimmed.

### Tournament companion
- 🗓️ **Full schedule** — all 104 fixtures with real venues, dates and kick-off times (shown in
  both venue-local and your local time), filterable by stage / upcoming / your team.
- ✍️ **Enter results** — record any score; everything downstream updates instantly.
- 🏆 **Live group standings** — auto-computed P/W/D/L/GF/GA/GD/Pts tables, top-two highlighted.
- 🧮 **Knockout bracket** — Round of 32 → Final, with slots (`1A`, `W74`, …) resolving
  automatically from standings and results.
- 🔮 **Win predictions** — a self-hosted **Elo model** (no API key, fully offline) shows
  win / draw / win probabilities that sharpen as you enter real results.
- 🏆 **Tournament simulator** — a **Monte Carlo forecaster** (Elo strength → Poisson goals →
  thousands of simulated tournaments) gives every team's odds to **win the group, advance, and
  lift the trophy**, plus a "play one tournament" button that rolls a full random bracket to a
  champion. Conditions on the results you've entered, so the forecast updates live.
  📄 **Full maths & citations: [docs/PREDICTIONS.md](docs/PREDICTIONS.md).**
- ⏱️ **Next-match countdown** — a live banner to the next kick-off (your team first, if chosen).
- ⭐ **Favorite team** — pick one to highlight its album page, fixtures, standings and bracket.

### Everywhere
- ⚙️ **Settings** — a dedicated panel for appearance, stickers-per-pack, default simulations, your
  favorite team, and full **export / import**.
- 💾 **Backups you can't lose** — a snapshot of your collection is saved **automatically on every
  startup** (before any reseed), plus one-click manual backups you can restore, download, or
  delete. Backups are **never** removed automatically.
- ✨ **Foil shine**, 🌙 **dark mode**, 📱 **responsive**.
- 🔒 **Optional password** for write access — or run fully open on a trusted LAN.
- 🐳 **Self-hosted** — one `docker compose up` and your data stays on **your** SQLite database.

## 🖼️ Screenshots

> Run it locally to see it in motion — the booklet album with real national-flag team pages and foil
> shine, the Teams squad dashboards, and the live knockout bracket. Drop your own captures into
> `docs/` and link them here (e.g. `docs/album.png`, `docs/teams.png`, `docs/bracket.png`).

## 🚀 Quick start (Docker)

```bash
git clone https://github.com/ChristianAbele02/StickerDex.git
cd StickerDex
cp .env.example .env          # optional: set STICKERDEX_PASSWORD / WEB_PORT
docker compose up -d --build
```

Open **http://localhost:8080**. Your collection is persisted in the `stickerdex-data` Docker volume.

## 🧑‍💻 Local development

Requires **Node 20+**.

```bash
npm install                   # installs both workspaces
npm run dev                   # backend on :3001 + frontend on :5173 (proxied), in parallel
```

> The generated data (`stickers.json`, `matches.json`, …) is **committed**, so a fresh clone runs
> immediately — no generate step needed. Re-run the `generate-*` scripts only when refreshing data.

`npm run dev` runs both servers together via `concurrently` (labeled `[api]`/`[web]`; one
`Ctrl+C` stops both). To run just one, use `npm run dev:api` or `npm run dev:web`.

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/health

The match schedule is regenerated from the vendored source files with
`npm run generate-matches --workspace=backend`.

Run the test suites:

```bash
npm test                      # backend (vitest) + frontend (vitest + RTL)
npm run lint                  # type-check both apps
```

## 🏗️ Architecture

```
StickerDex/
├── backend/        Fastify + TypeScript REST API, SQLite (better-sqlite3)
│   ├── scripts/generate-dataset.ts   builds the canonical sticker catalog (flags + players)
│   ├── scripts/generate-checklist.ts fetches the real Panini code→player checklist
│   ├── scripts/generate-players.ts   fetches real squads (positions/clubs) from Wikipedia
│   ├── scripts/generate-matches.ts   parses the schedule into matches/venues/teams
│   ├── scripts/raw/                  vendored openfootball source files (CC0)
│   ├── src/data/   stickers.json · teams.json · checklist.json · players.json · matches.json · venues.json · match-teams.json
│   ├── src/db/     schema, connection, idempotent seeders (stickers + tournament)
│   ├── src/routes/ stickers, collection, stats, export, matches, simulate, backups, auth
│   └── src/services/  catalog · collection · stats · exporter · matches · standings · predictions · simulator · backups
├── frontend/       React + Vite + TypeScript + Tailwind (booklet + companion UI)
│   └── src/        components · pages · hooks · lib · api client
└── docker-compose.yml   api + web, persistent SQLite volume
```

**Data model.** `stickers`, `matches`, `venues` and `match_teams` are read-only reference data
(seeded from the generated datasets). The only mutable tables are `collection` — one row per
sticker code with a `count` (0 = missing, 1 = owned, >1 = duplicates) — and `match_results` —
one row per played match. Standings and predictions are derived from these on read, so they
always reflect the latest scores. Single-user by design; the optional password gates all writes.

### API overview

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `GET`  | `/api/stickers` | Full catalog in booklet order |
| `GET`  | `/api/teams` | Team metadata (names, group, colors) |
| `GET`  | `/api/collection` | Current `{ code: count }` map |
| `PATCH`| `/api/collection/:code` | `increment` / `decrement` / `set` a count |
| `POST` | `/api/collection/bulk` | Bulk set many codes |
| `POST` | `/api/collection/import` | Replace the whole collection |
| `GET`  | `/api/stats` | Completion %, per-team breakdown, packs needed |
| `GET`  | `/api/export?format=csv\|json&filter=missing\|owned\|dupes\|all` | Download (incl. `spare` column) |
| `GET`  | `/api/matches` | All 104 fixtures, joined with entered results |
| `GET`  | `/api/venues` · `/api/match-teams` | 16 host venues · 48 tournament teams |
| `PUT`  | `/api/matches/:num/result` | Enter/overwrite a score `{ homeScore, awayScore }` |
| `DELETE`| `/api/matches/:num/result` | Clear a score (mark not played) |
| `GET`  | `/api/standings` | Live group tables computed from results |
| `GET`  | `/api/predictions` | Elo win/draw/win probabilities for upcoming fixtures |
| `GET`  | `/api/simulate?runs=N` | Monte Carlo odds: each team's P(win group / advance / … / champion) |
| `GET`  | `/api/simulate/once?seed=N` | One simulated tournament: filled bracket + champion |
| `GET`  | `/api/backups` · `POST /api/backups` | List snapshots · make a manual backup |
| `POST` | `/api/backups/:name/restore` · `DELETE /api/backups/:name` | Restore · delete a snapshot |
| `GET`  | `/api/backups/:name/download` | Download a snapshot `.db` file |
| `GET`  | `/api/auth/status` · `POST /api/auth/login` · `/logout` | Optional auth |

## 🗂️ Data & accuracy

The album **structure, teams, group draw and sticker codes are accurate**: the real 48 qualified
nations in their actual groups (A–L), each `×20` (`ARG1…ARG20`), the `FWC1–FWC19` introduction &
FIFA Museum stickers, and `CC1–CC12` Coca-Cola specials. Team codes and groups match the
companion's `match-teams.json` exactly, so the album lines up with the schedule, standings and
bracket (and favorite-team highlighting works across both). Each team page is rendered with its
**actual national flag** (drawn as inline SVG — stars, crescents, suns, crosses and emblems
included).

**Player names are real**, pulled from the live tournament squads (name, position and club) — see
below. The only remaining placeholders are the 31 non-player specials (intro / FIFA Museum /
Coca-Cola art), flagged `"verified": false`.

### Player data (correct sticker numbers)

Names are matched to the **exact Panini sticker number** using the real album checklist — Panini's
slot order is *not* shirt-number order, so the checklist is the only reliable source for "who is
`ARG17`?" (it's Messi). Two sources are combined:

1. **`generate-checklist`** — the authoritative code→player mapping, parsed deterministically from
   a public Panini checklist database (cross-checked against known facts: Messi `ARG17`, Ronaldo
   `POR15`, Mbappé `FRA20`). This drives each sticker's name *and* type (logo / photo / player).
2. **`generate-players`** — the live squads from Wikipedia's *"2026 FIFA World Cup squads"* article
   (raw wikitext via the MediaWiki API, no key), used to enrich each checklisted player with a
   **position and club**, matched by name.

```bash
npm run generate-checklist --workspace=backend   # src/data/checklist.json  (code → player)
npm run generate-players   --workspace=backend   # src/data/players.json    (squads: pos + club)
npm run generate-dataset   --workspace=backend   # folds both into the stickers
```

Both datasets are committed, so a fresh clone already has correct names. Everything is editable
in-app, so if a checklist entry is ever off you can fix that single sticker without regenerating.

### Match schedule & predictions

The fixture list — the real draw, 16 host venues, dates, kick-off times and any already-played
results — is generated from the [openfootball](https://github.com/openfootball/worldcup) dataset
(public domain, **CC0**), vendored under `backend/scripts/raw/`. Every fixture and result is also
**fully editable in-app**, so corrections never require a regenerate.

**Predictions** come from a small, fully self-hosted **Elo model** — no external API, no network.
Teams start from coarse seed ratings (an estimate, _not_ an official ranking) and the model
re-rates them from the results you enter, so probabilities improve over the tournament.

**The tournament simulator** ([`services/simulator.ts`](backend/src/services/simulator.ts)) wraps
that strength rating in a **Monte Carlo** engine, the same family of method academic forecasters
use (Klement, Zeileis, FiveThirtyEight's SPI). Each fixture's scoreline is drawn from a
**Poisson** model whose means come from the Elo gap plus home advantage; a full tournament — group
tiebreakers, the eight best third-placed teams assigned to their official Round-of-32 slots, and
every knockout tie (penalties included) — is played out thousands of times, and the share of runs
each team wins becomes its title odds. Already-played matches are taken as fact, so the forecast is
conditional and live. It runs ~10,000 tournaments in well under a second, entirely on your machine.

👉 **The complete model — every formula, parameter and citation, explained beginner-first — is in
[docs/PREDICTIONS.md](docs/PREDICTIONS.md).**

## 🔧 Configuration

All via environment variables (see [`.env.example`](.env.example)):

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `WEB_PORT` | `8080` | Host port for the web UI |
| `STICKERDEX_PASSWORD` | _(empty)_ | If set, writes require login |
| `STICKERDEX_SECRET` | `change-me…` | Cookie signing secret (set this!) |
| `DATABASE_PATH` | `/app/data/stickerdex.db` | SQLite file location |

## 🤝 Contributing

PRs welcome — especially sticker-data corrections. Read [CONTRIBUTING.md](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md).

## 🧭 Why "StickerDex"?

A few names were considered before settling on **StickerDex** ("sticker" + "-dex"): _Klebebuch_,
_FoilVault_, and _Albumania_. The name deliberately avoids trademarked brands.

## 🙏 Credits & data sources

StickerDex stands on open data. Huge thanks to:

| Source | Used for | License |
| ------ | -------- | ------- |
| [openfootball/worldcup](https://github.com/openfootball/worldcup) | Match schedule, venues, draw, results | CC0 (public domain) |
| [Wikipedia — *2026 FIFA World Cup squads*](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads) | Player squads (position, club, caps, goals) | CC BY-SA 4.0 |
| [Football Cartophilic Info Exchange](https://cartophilic-info-exch.blogspot.com/) & [paniniwm2026sticker.com](https://paniniwm2026sticker.com/) | Sticker checklist (code → player) | Factual checklist data |

All data is **factual reference information** (fixtures, names, numbers) — StickerDex ships **no
Panini artwork or copyrighted imagery**. Trademarks belong to their respective owners; see the
disclaimer at the top.

## 🤖 AI usage

AI assistance was used in building this project — for **debugging** and for
**writing certain code passages** — under human review and direction. Full
details in [AI_USAGE.md](AI_USAGE.md).

## 📜 License

[MIT](LICENSE) © 2026 Christian Abele and contributors.
