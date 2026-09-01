# ARC LOG — Match Tracker for Arc Raiders

Self-hosted web app for tracking Arc Raiders matches (map, condition, currency, and XP)
with analytics broken down by map, map condition, and month.

**Stack:** nginx (frontend) → Express API → PostgreSQL, all via Docker Compose.

## Quick Start

```bash
cp .env.example .env
# Edit .env (POSTGRES_PASSWORD, WEB_PORT)

docker compose up -d --build
```

The app will then be accessible at `http://localhost:8080` (or the port specified in `WEB_PORT`).

## Architecture

```
web/   → nginx, serves the frontend and proxies /api/ requests to the API
api/   → Node/Express API, communicates with Postgres
db     → postgres:16-alpine, data stored in the "db_data" volume
```

## Backing Up Data

```bash
docker compose exec db pg_dump -U arclog arclog > backup.sql
```

## Updating

```bash
git pull
docker compose up -d --build
```

## License

MIT; see [LICENSE](LICENSE).
