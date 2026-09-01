# ARC LOG — Rundentracker für Arc Raiders

Self-hosted Web-App zum Tracken von Arc-Raiders-Runden (Map, Condition, $ und XP)
mit Auswertungen pro Map, pro Map Condition und monatlich.

**Stack:** nginx (Frontend) → Express-API → PostgreSQL, alles via Docker Compose.

## Schnellstart

```bash
cp .env.example .env
# .env anpassen (POSTGRES_PASSWORD, WEB_PORT)

docker compose up -d --build
```

Danach ist die App unter `http://localhost:8080` (bzw. dem in `WEB_PORT` gesetzten Port) erreichbar.

## Architektur

```
web/   → nginx, liefert das Frontend aus und proxyt /api/ an die API
api/   → Node/Express-API, spricht mit Postgres
db     → postgres:16-alpine, Daten liegen im Volume "db_data"
```

## Daten sichern

```bash
docker compose exec db pg_dump -U arclog arclog > backup.sql
```

## Update

```bash
git pull
docker compose up -d --build
```

## Lizenz

MIT, siehe [LICENSE](LICENSE).
