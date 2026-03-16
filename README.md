# Miner Game

A small full-stack miner game project with a Go backend and a React frontend.

## Stack

- Backend: Go
- Frontend: React + TypeScript + Vite
- Runtime/Package manager: Bun
- Database: PostgreSQL
- Orchestration: Docker Compose

## Services

- Frontend: `http://localhost:3000`
- Backend WebSocket: `ws://localhost:8080/ws`
- PostgreSQL: `localhost:5433`

## Run

```bash
docker compose up --build
```

To stop:

```bash
docker compose down
```

## Project Structure

- `backend/` - Go game server and game logic
- `miner-fe/` - React frontend (Vite + Bun)
- `docker-compose.yml` - local multi-service setup

## Notes

- Frontend connects to backend via WebSocket.
- Use Docker Compose as the default local development path.

