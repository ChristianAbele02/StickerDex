# StickerDex API — Fastify + SQLite (better-sqlite3 needs a native build toolchain).
FROM node:20-bookworm-slim

WORKDIR /app

# Toolchain for compiling better-sqlite3, removed afterwards to keep the image lean.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (tsx is needed to run the TypeScript server directly).
COPY backend/package.json ./
RUN npm install

# App source
COPY backend/ ./

# Generate the sticker catalog into the image so the seeder has data to load.
RUN npm run generate-dataset

ENV API_PORT=3001
ENV DATABASE_PATH=/app/data/stickerdex.db
EXPOSE 3001

# SQLite database lives on a mounted volume (see docker-compose.yml).
VOLUME ["/app/data"]

CMD ["npx", "tsx", "src/index.ts"]
