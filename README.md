<p align="middle">
  <a href="https://nodejs.org" target="_blank">
    <img src="https://img.shields.io/badge/Node.js-20%2B-brightgreen?style=flat&logo=node.js&logoColor=white" alt="Node.js 24">
  </a>
  <a href="https://nginx.org" target="_blank">
    <img src="https://img.shields.io/badge/nginx-alpine-009639?style=flat&logo=nginx&logoColor=white" alt="nginx alpine">
  </a>
  <a href="LICENSE" target="_blank">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT">
  </a>
</p>


# ARC LOG — Match Tracker for Arc Raiders

![Arc Raiders Salvage Log](docs/screenshots/Banner.png)

Self-hosted simple web app for tracking Arc Raiders rounds (map, condition, currency, and XP)
with analytics broken down by map, map condition, and month.

**Stack:** nginx (frontend) → Express API → PostgreSQL, all via Docker Compose.

## Repository details

Clone the repository to your **docker host**, e.g. into `/opt/docker/arc-raiders-salvage-log`

```bash
cd /opt/docker/

mkdir -p arc-raiders-salvage-log

git clone https://github.com/JCSimon1/arc-raiders-salvage-log.git

cd arc-raiders-salvage-log

cp .env.example .env
# Edit .env (POSTGRES_PASSWORD, WEB_PORT) to your preferences
```

### Folder structure

```bash
arc-raiders-salvage-log/
├── docker-compose.yml
├── .env
├── .env.example
├── update.sh
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── images/
│   ├── conditions/
│   ├── maps/
└── web/
    ├── Dockerfile
    ├── nginx.conf
    ├── style.css
    ├── i18n.js
    └── index.html
```

The structure above does only contain files to actually create and run the containers. Documentation is in the folder `/docs/`.

## Quick Start

### First start

```bash
chmod +x update.sh
./update.sh
```

Or alternatively you can do it manually

```bash
export APP_VERSION=$(git describe --tags --always)
docker compose up -d --build
```

The app will then be accessible at `http://localhost:8080` (or the port specified in environment variable `WEB_PORT`).

## Architecture

Functionality of the docker containers:

| Container | Description |
| -------- | -------- |
| api | Node/Express API, communicates with Postgres |
| db | postgres:16-alpine, data stored in the "db_data" volume |
| web | nginx, serves the frontend and proxies /api/ requests to the API |

## API

See [docs/api.md](docs/api.md) for the complete API reference.

## Images

You can include your own images to be displayed for maps and conditions. Add them as a `webp` file in the two folder `conditions` and `maps`.

### Naming convention

* Condition:
  * Use the actual condition name without spaces.
  * Example: `prospectingprobes.webp`
* Map
  * Use the actual map name without spaces.
  * Example: `stellamontis.webp`

If you do not include any images only the name of the map an map condition will be displayed. 

## Backing Up Data

```bash
docker compose exec db pg_dump -U arclog arclog > backup.sql
```

## Updating

Execute the update script
```bash
./update.sh
```

The script pulls the latest changes, determines the current version number based on the Git tag, and rebuilds the containers.

## Versioning 

The version number displayed in the footer is automatically derived from the current Git tag (`git describe --tags --always`) during the build process. To tag a new release:


```bash
git tag -a x.y.z -m "Description of the commit"
git push origin x.y.z
```

## Features

- Log a run / round
- Overview of last runs
- Show statistics
  - No. of rounds, total/avg. $ earned, total XP
  - Best rounds ($ earned / XP earned)
  - Diagrams
    - By Map
    - By Condition
    - Monthly
- Language support for English and German

## Screenshots

Screenshots include local images.

### Log a run
![Screenshot - Log a run](docs/screenshots/arc_raiders_salvage_log_screenshot_log_run.png)

### Overview
![Screenshot - Overview](docs/screenshots/arc_raiders_salvage_log_screenshot_overview.png)

### Stats
![Screenshot - Stats](docs/screenshots/arc_raiders_salvage_log_screenshot_stats.png)


## License

MIT (see [LICENSE](LICENSE))
