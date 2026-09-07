#!/usr/bin/env bash
set -e
git pull
export APP_VERSION=$(git describe --tags --always)
docker compose up -d --build
echo "Deployed: $APP_VERSION"