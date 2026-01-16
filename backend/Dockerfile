# Backend Dockerfile
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN go build -o miner-backend .

FROM alpine:3.19
WORKDIR /app
COPY --from=build /app/miner-backend .
EXPOSE 8080
ENV DATABASE_URL=""
CMD ["./miner-backend"]
