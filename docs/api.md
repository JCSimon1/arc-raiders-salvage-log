# API Reference

Base URL (behind the nginx proxy): `/api`
All requests/responses use `application/json`. There is no authentication — the API is expected to sit behind the bundled nginx container on a trusted network.

## Table of contents
- [API Reference](#api-reference)
  - [Table of contents](#table-of-contents)
  - [Health](#health)
    - [`GET /api/health`](#get-apihealth)
  - [Rounds](#rounds)
    - [`GET /api/rounds`](#get-apirounds)
    - [`POST /api/rounds`](#post-apirounds)
    - [`PUT /api/rounds/:id`](#put-apiroundsid)
    - [`DELETE /api/rounds/:id`](#delete-apiroundsid)
  - [Loot Stash](#loot-stash)
    - [`GET /api/loot`](#get-apiloot)
    - [`PUT /api/loot/:key`](#put-apilootkey)
  - [Settings](#settings)
    - [`GET /api/settings`](#get-apisettings)
    - [`PUT /api/settings/rank`](#put-apisettingsrank)
  - [Steam Profile](#steam-profile)
    - [`GET /api/steam/profile`](#get-apisteamprofile)
  - [Error format](#error-format)

---

## Health

### `GET /api/health`

Used by the container healthcheck (`wget --spider`).

**Response `200`**
```json
{ "ok": true }
```

---

## Rounds

A round represents one logged Arc Raiders run.

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | integer | Auto-generated |
| `number` | integer | User-defined run number, auto-incremented as a suggestion in the UI |
| `date` | string (`YYYY-MM-DD`) | Required |
| `time` | string (`HH:MM`) | Required |
| `map` | string | Required |
| `condition` | string | Required |
| `money` | integer | `$` earned. `0` is treated as a death (⚠ shown with a skull icon, counted in the "Deaths" stat) |
| `xp` | integer | XP gained |

### `GET /api/rounds`

Returns all rounds, sorted by date, time, then round number (all descending).

**Response `200`**
```json
[
  {
    "id": 42,
    "number": 17,
    "date": "2026-09-20",
    "time": "21:15",
    "map": "Stella Montis",
    "condition": "Hurricane",
    "money": 8200,
    "xp": 1450
  }
]
```

### `POST /api/rounds`

Creates a new round.

**Request body**
```json
{
  "round_number": 17,
  "round_date": "2026-09-20",
  "round_time": "21:15",
  "map": "Stella Montis",
  "map_condition": "Hurricane",
  "money": 8200,
  "xp": 1450
}
```
`round_date`, `round_time`, `map` and `map_condition` are required; missing any of them returns `400`.

**Response `201`** — the created round (see shape under [GET /api/rounds](#get-apirounds)).

**Errors**
- `400` — required field missing
- `500` — database error

### `PUT /api/rounds/:id`

Replaces all fields of an existing round. Same body shape and required fields as `POST`.

**Response `200`** — the updated round.

**Errors**
- `400` — required field missing
- `404` — no round with this id
- `500` — database error

### `DELETE /api/rounds/:id`

Deletes a round. Idempotent — does not error if the id does not exist.

**Response `204`** — no body.

**Errors**
- `500` — database error

---

## Loot Stash

Loot items come from a fixed, server-side catalog (`LOOT_CATALOG` in `server.js`) — you cannot create or delete items via the API, only update the owned `amount`. Catalog `name`/`price` are re-synced from that list on every API start without touching stored `amount` values; update the catalog in code and redeploy to change prices.

| Field | Type | Notes |
| ----- | ---- | ----- |
| `key` | string | Stable identifier, also used for the image at `/images/loot/<key>.webp` |
| `name` | string | Display name |
| `price` | integer | Sell price per unit |
| `amount` | integer | Quantity currently owned, user-editable |

### `GET /api/loot`

Returns all loot items, sorted by price (descending), then name.

**Response `200`**
```json
[
  { "key": "matriarchreactor", "name": "Matriarch Reactor", "price": 11000, "amount": 2 },
  { "key": "assessormatrix",   "name": "Assessor Matrix",   "price": 5000,  "amount": 0 }
]
```

### `PUT /api/loot/:key`

Updates the owned amount of one loot item. `:key` is the item's `item_key` (e.g. `matriarchreactor`).

**Request body**
```json
{ "amount": 3 }
```
`amount` must be a finite number `>= 0`.

**Response `200`** — the updated item.

**Errors**
- `400` — invalid/negative amount
- `404` — unknown item key
- `500` — database error

---

## Settings

Currently only stores the selected Trials rank, in a generic `key`/`value` settings table.

### `GET /api/settings`

**Response `200`**
```json
{
  "rank": "hotshot",
  "ranks": [
    { "key": "none", "name": "None" },
    { "key": "rookie1", "name": "Rookie I" },
    { "key": "hotshot", "name": "Hotshot" },
    { "key": "cantinalegend", "name": "Cantina Legend" }
  ]
}
```
`rank` is `null` if none has been selected yet. `ranks` is the full, fixed rank catalog (`RANK_CATALOG` in `server.js`) used to populate the dropdown on the Settings page; rank images are expected at `/images/ranks/<key>.webp`.

### `PUT /api/settings/rank`

**Request body**
```json
{ "rank": "hotshot" }
```
`rank` must be `null`, an empty string, or one of the keys from the `ranks` catalog above.

**Response `200`**
```json
{ "rank": "hotshot" }
```

**Errors**
- `400` — `rank` is not a string/null, or not a known rank key
- `500` — database error

---

## Steam Profile

Optional integration; only active when both `STEAM_API_KEY` and `STEAM_ID` are set on the `api` container (see the main [README](../README.md#environment-variables)). The Steam key never leaves the server — the frontend only ever calls this endpoint.

### `GET /api/steam/profile`

Server-side response is cached for 5 minutes to stay within Steam Web API rate limits.

**Response `200` — not configured**
```json
{ "configured": false }
```

**Response `200` — configured**
```json
{
  "configured": true,
  "name": "Steam Name",
  "avatar": "https://avatars.steamstatic.com/....jpg",
  "profileUrl": "https://steamcommunity.com/id/...",
  "status": "online",
  "inGame": false
}
```
`status` is one of: `offline`, `online`, `busy`, `away`, `snooze`, `looking_to_trade`, `looking_to_play`.

**Response `502` — configured but upstream call failed**
```json
{ "configured": true, "error": "Steam-Profil konnte nicht geladen werden." }
```
The frontend treats any non-`200` or `error`/`configured: false` response as **hide the Steam card** — it never surfaces this as a hard failure to the user.

---

## Error format

Error responses use a single `error` field with a message (currently German-language, matching the rest of the API):

```json
{ "error": "Pflichtfelder fehlen." }
```

| Status | Meaning |
| ------ | ------- |
| `400` | Validation error (missing/invalid fields) |
| `404` | Resource not found |
| `500` | Unexpected server/database error |
| `502` | Upstream (Steam) API call failed |