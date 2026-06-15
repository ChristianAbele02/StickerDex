# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Real national flags & smarter pack estimate
- **SVG national flags** (`lib/flagSvg.tsx`): every team now renders its *actual* flag —
  correct layout plus the defining motifs (USA's stars & stripes, Türkiye/Tunisia/Algeria
  crescents, Argentina/Uruguay suns of May, Brazil's globe, Japan's disc, Nordic & St George
  crosses, Scotland's saltire, the Australian/New Zealand Union Jack + Southern Cross, South
  Africa's Y-pall, Croatia's chequy, maple leaf, etc.) — replacing the old equal-band colour
  gradients on album headers, owned sticker tiles, the Teams hub cards/banner and player cards.
- **Coupon-collector pack estimate**: the stats page now shows best-case, **expected** and
  90%-confidence pack counts to finish the album, using the classic coupon-collector model
  (mean `N·H_m`, variance `N²·Σ1/j² − N·H_m`) instead of only the naive best case — so it
  reflects how many duplicates you really pull chasing the last few stickers.

### Fixed
- **"Back up now" now reports failures**: the Settings backup/restore/delete actions surface
  errors (and confirm success) instead of silently doing nothing when the API call fails —
  e.g. against a backend that predates the backups route.

### Added — Settings & backups
- **Automatic backups**: on every startup the backend snapshots your collection (a full
  `VACUUM INTO` SQLite copy) into `data/backups/` **before** any reseed/migration, so reference-data
  changes can never wipe your collection. Snapshots are **never** auto-deleted.
- **Settings tab** with a backups manager (back up now · restore · download · delete), appearance,
  stickers-per-pack (feeds the packs-needed estimate), default simulation count, favorite team, and
  **export / import** of your whole collection.
- Backup API: `GET/POST /api/backups`, `POST /api/backups/:name/restore`,
  `DELETE /api/backups/:name`, `GET /api/backups/:name/download`.

### Fixed
- Portugal's album flag gradient is now green/red-dominant (with a thin gold seam) instead of an
  even green-yellow-red tricolour, so it actually resembles the flag.

### Added — Tournament simulator
- **Monte Carlo forecaster** (`GET /api/simulate`, `services/simulator.ts`): Elo strength → Poisson
  goal model → thousands of full simulated tournaments (group tiebreakers, eight best third-placed
  teams assigned to their official R32 slots, knockout incl. penalties). Returns each team's
  probability to win its group, advance, reach each round, and win the cup; conditions on
  already-entered results. ~10k runs in <1s.
- `GET /api/simulate/once` plays a single random tournament and returns the fully filled bracket
  and champion.
- New **🔮 Predict** tab: predicted-champion board with per-round odds, a group-stage advance
  forecast, and a "play one tournament" button that rolls a complete bracket to a winner.

### Added — Tournament companion
- **Full match schedule**: all 104 fixtures with real venues, dates and kick-off times
  (venue-local + your local time), filterable by stage / upcoming / favorite team. Generated
  from the openfootball dataset (CC0) and fully editable in-app.
- **Result entry** (`PUT`/`DELETE /api/matches/:num/result`) stored in a mutable `match_results`
  table, seeded with already-played scores.
- **Live group standings** (`/api/standings`) auto-computed from results (P/W/D/L/GF/GA/GD/Pts).
- **Knockout bracket** with slots (`1A`, `W74`, …) that resolve from standings + results.
- **Elo win/draw/win predictions** (`/api/predictions`) — fully self-hosted, no API key.
- **Next-match countdown** banner and a **favorite team** picker that highlights the team across
  the album, fixtures, standings and bracket.
- `npm run generate-matches` to (re)build the schedule dataset.

### Added — Teams hub
- New **Teams** tab: a grid of all 48 nations (flag-gradient cards with group + collection
  progress), each opening a squad dashboard with fun-fact stats (total caps, most-capped player,
  top scorer, clubs represented), the team's live group standing + next fixture, and player cards
  (shirt number, position, club, caps & goals) that are collectable inline.
- Navigation: search teams by name, filter by group, and sort by group / name / completion; inside
  a team, filter the squad by position (GK / DEF / MID / FWD).
- Player stickers now carry **shirt number, caps and goals** (matched from squad data); added via
  an idempotent DB migration.

### Added — Album
- **Correct player↔sticker-number alignment**: names are now mapped to the exact Panini sticker
  number via the real album checklist (`generate-checklist`), instead of shirt-number order which
  put names on the wrong stickers. Per team: slot 1 is the emblem, slot 13 the team photo, and the
  other **18 slots are players** (slot 2 is the goalkeeper, e.g. `ARG2` = Emiliano Martínez). The
  checklist merges two independent references (they agree on slots 1 and 3–20; the primary supplies
  the correct slot-2 player and the secondary fills a few gaps). Verified against known facts
  (Messi `ARG17`, Ronaldo `POR15`, Mbappé `FRA20`).
- **Real player data**: `generate-players` fetches the live WC2026 squads from Wikipedia
  (MediaWiki API, no key); positions and clubs are matched onto the checklisted players by name
  (~78% enriched). The album ships with actual players instead of placeholders (960/991 verified).
- **National-flag gradients**: each team page — and each owned sticker — is painted as a
  gradient of its flag colors, and foil stickers now shimmer in those same colors. Navy
  field-flags (Australia, New Zealand) are weighted navy-dominant so they no longer look like
  the French tricolor.
- New `club` field on stickers (shown on owned tiles); idempotent DB migration adds the column.
- Dedicated **Duplicates** tab (swap list) with per-sticker spare counts and CSV / JSON export.
- `spare` column (extra copies = count − 1) added to every export.
- Empty slots now name who belongs there (dimmed), like a real album.

### Changed
- **Album now uses the real WC2026 draw**: the 48 actual qualifiers in their true groups (so
  South Africa, Bosnia, Haiti, Scotland, Curaçao, Türkiye, Iraq, Jordan, DR Congo, Uzbekistan
  and Cape Verde get pages), replacing the earlier sequential placeholder draw. Team codes and
  groups now match the companion dataset exactly.
- The seeder prunes stickers no longer in the catalog, so corrections drop stale teams cleanly
  from existing databases.
- `npm run dev` now runs the API and web servers in parallel via `concurrently` (works on
  Windows too); added `dev:api` / `dev:web`.

### Initial release
- Initial release of StickerDex.
- Booklet-style album UI with team pages, numbered slots, and foil shine.
- One-click collecting with duplicate / swap tracking.
- Live completion stats (overall + per team) and "packs needed" estimate.
- Search by code or player name; filter by missing / owned / duplicates / foils.
- CSV / JSON export of missing list and full collection.
- Fastify + SQLite backend with optional single-password protection.
- Sticker catalog generator (48 teams × 20 + FWC intro/museum + Coca-Cola specials).
- Dark mode, responsive layout.
- Docker Compose self-hosting with a persistent SQLite volume.
