# Legion TD Web — Multiplayer Prototype

Real-time multiplayer tower defence game running on a Raspberry Pi with Docker + k3s.

## Architecture

```
frontend/   — nginx serving HTML5 Canvas game + Socket.io client
backend/    — Node.js/Express + Socket.io server + PostgreSQL
k8s/        — Kubernetes manifests (namespace, postgres, backend, frontend)
```

## Stack

- **Frontend:** Vanilla JS, HTML5 Canvas, Socket.io client
- **Backend:** Node.js, Express, Socket.io, pg (PostgreSQL)
- **Database:** PostgreSQL 16
- **Runtime:** k3s (single-node Kubernetes) on Raspberry Pi 4 (arm64)

## Multiplayer Features

- Lobby with 60s countdown — starts immediately when 2 players join
- Synchronized wave start — server-driven countdown, vote to start early
- Real-time opponent view with network interpolation (200ms buffer)
- Persistent leaderboard via PostgreSQL

## Local Development

```bash
# Backend
cd backend && npm install && DB_HOST=localhost node server.js

# Frontend — serve with any static server
cd frontend && npx serve .
```

## Deployment (k3s)

```bash
# Build images
cd backend && docker build -t legion-td-backend:latest .
cd frontend && docker build -t legion-td-frontend:latest .

# Import into k3s containerd
docker save legion-td-backend:latest | sudo k3s ctr images import -
docker save legion-td-frontend:latest | sudo k3s ctr images import -

# Deploy
sudo kubectl apply -f k8s/
```

Game is served on NodePort 30080.
