# Arc Log API

REST-API for the Arc Raiders Salvage Log. The API is provided by the `api` container and made accessible via nginx at `/api/`

**Base URL:** `http://<host>:<WEB_PORT>/api`
**Format:** JSON (`Content-Type: application/json`)

## Table of contents

- [Arc Log API](#arc-log-api)
  - [Table of contents](#table-of-contents)
  - [Data model](#data-model)
  - [GET /health](#get-health)
  - [GET /rounds](#get-rounds)
  - [POST /rounds](#post-rounds)
  - [PUT /rounds/:id](#put-roundsid)
  - [DELETE /rounds/:id](#delete-roundsid)
  - [Error Format](#error-format)

## Data model

A **Run** (round) contains the following fields:

| FFiels        | Type     | Type | Description                                  |
|-------------|----------|---------|------------------------------------------------|
| `id`        | integer  | –       | Created by the API, only in response           |
| `number`    | integer  | ja      | Number of the round                            |
| `date`      | string   | ja      | Date in format `YYYY-MM-DD`                    |
| `time`      | string   | ja      | Time in format `HH:MM`                         |
| `map`       | string   | ja      | Name of the map                                |
| `condition` | string   | ja      | Map condition (e.g. `Clear`, `Hurricane`)      |
| `money`     | integer  | ja      | Earned in-game currency                        |
| `xp`        | integer  | ja      | Received XP                                    |

Example object as returned by the API:

```json
{
  "id": 42,
  "number": 17,
  "date": "2026-09-01",
  "time": "20:15",
  "map": "Dam Battlegrounds",
  "condition": "Hurricane",
  "money": 3200,
  "xp": 850
}
```

Internally, the database stores the fields as `round_number`, `round_date`, `round_time`, and `map_condition` — externally (in the request body and response), they are named as shown in the table above.

---

## GET /health

Simple health check, e.g., for monitoring or Docker health checks.

**Request**

```
GET /api/health
```

**Response** `200 OK`

```json
{ "ok": true }
```

---

## GET /rounds

Returns all recorded laps, sorted by date/time/number in descending order (newest first).

**Request**

```
GET /api/rounds
```

**Response** `200 OK`

```json
[
  {
    "id": 42,
    "number": 17,
    "date": "2026-09-01",
    "time": "20:15",
    "map": "Dam Battlegrounds",
    "condition": "Hurricane",
    "money": 3200,
    "xp": 850
  },
  {
    "id": 41,
    "number": 16,
    "date": "2026-08-30",
    "time": "19:40",
    "map": "Buried City",
    "condition": "Clear",
    "money": 2100,
    "xp": 600
  }
]
```

**Error:** `500` for database errors.

---

## POST /rounds

Creates a new round

**Request**

```
POST /api/rounds
Content-Type: application/json
```

```json
{
  "round_number": 17,
  "round_date": "2026-09-01",
  "round_time": "20:15",
  "map": "Dam Battlegrounds",
  "map_condition": "Hurricane",
  "money": 3200,
  "xp": 850
}
```

**Mandatory fields:** `round_date`, `round_time`, `map`, `map_condition`
(`round_number`, `money`, and `xp` are accepted but not checked for presence)

**Response** `201 Created`

```json
{
  "id": 42,
  "number": 17,
  "date": "2026-09-01",
  "time": "20:15",
  "map": "Dam Battlegrounds",
  "condition": "Hurricane",
  "money": 3200,
  "xp": 850
}
```

**Error**


| Status | Condition                           |
|--------|-------------------------------------|
| `400`  | A required field is missing         |
| `500`  | Error while saving (e.g., DB down)  |

---

## PUT /rounds/:id

Completely updates an existing round (all fields are overwritten).

**Request**

```
PUT /api/rounds/42
Content-Type: application/json
```

```json
{
  "round_number": 17,
  "round_date": "2026-09-01",
  "round_time": "20:30",
  "map": "Dam Battlegrounds",
  "map_condition": "Clear",
  "money": 3500,
  "xp": 900
}
```

**Mandatory fields:** `round_date`, `round_time`, `map`, `map_condition`

**Response** `200 OK`

```json
{
  "id": 42,
  "number": 17,
  "date": "2026-09-01",
  "time": "20:30",
  "map": "Dam Battlegrounds",
  "condition": "Clear",
  "money": 3500,
  "xp": 900
}
```

**Error**

| Status | Condition                                   |
|--------|---------------------------------------------|
| `400`  | A required field is missing                 |
| `404`  | No round found with this `id`               |
| `500`  | Error during update (e.g., DB unavailable)  |


---

## DELETE /rounds/:id

Deletes a round for good.

**Request**

```
DELETE /api/rounds/42
```

**Response** `204 No Content` (no body, even if the ID did not exist — the operation is idempotent)

**Error:** `500` for database errors.

---

## Error Format

Errors are returned as JSON with an `error` field (plain text in German, as displayed in the frontend).:

```json
{ "error": "Could not save round" }
```
| Endpoint             | Possible error messages                            |
|-----------------------|----------------------------------------------------|
| `GET /rounds`         | `Could not load rounds.`                           |
| `POST /rounds`        | `Required fields missing.` · `Could not save round.` |
| `PUT /rounds/:id`     | `Required fields missing.` · `Round not found.` · `Could not update round.` |
| `DELETE /rounds/:id`  | `Could not delete round.`|