# Miner Backend

Go WebSocket server for the Miner game logic.

## Stack

- Go
- Gorilla WebSocket
- PostgreSQL

## Run Locally

Set database URL (optional if using Docker network defaults):

```bash
export DATABASE_URL='postgres://postgres:postgres@localhost:5433/miner?sslmode=disable'
```

Start server:

```bash
go run .
```

Server listens on `:8080`.

## API

- WebSocket endpoint: `ws://localhost:8080/ws`

## Docker

From project root:

```bash
docker compose up --build
```

