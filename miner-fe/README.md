# Miner FE

Frontend for the Miner game.

## Stack

- React + TypeScript
- Vite
- Bun

## Run Locally

```bash
bun install
bun run dev --host 0.0.0.0 --port 3000
```

Open `http://localhost:3000`.

## Build

```bash
bun run build
bun run preview --host 0.0.0.0 --port 3000
```

## Lint and Format

```bash
bun run lint
bun run lint:fix
bun run format
bun run format:check
```

## Backend Connection

- WebSocket endpoint: `ws://localhost:8080/ws`
