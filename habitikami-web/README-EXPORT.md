# Habitikami Export API

`server.js` serves the web app and exposes a small JSON API used by the Android
widgets and by automation tools (n8n, scripts, dashboards).

## 1. Authentication

Every API request is authenticated **per user**. There is no shared server
token: `EXPORT_API_TOKEN` and the `?token=` query parameter no longer exist.
Two methods are accepted, checked in this order:

| Method | Header | Where it comes from |
| --- | --- | --- |
| **API key** (widgets, automation) | `X-API-Token: hk_...` | Generated in the app: *Help → API key*. Shown **once**; regenerating revokes the previous key. |
| **Google access token** (the web app itself) | `Authorization: Bearer <access_token>` | The user's own Google OAuth token. The server verifies that it was issued to this app (audience check) and that it has not expired. |

API keys are stored **hashed** (SHA-256) on the server; only a short prefix is
kept for display. If you lose a key, generate a new one from the app.

The API key records the spreadsheet of the user who generated it and, when
available, an encrypted copy of the user's refresh token, so requests run with
the user's own Google credentials. Only if no refresh token is stored does the
server fall back to the optional service account (see section 3).

When `ALLOWED_EMAILS` is set (private mode), API keys of accounts outside the
allowlist receive `403 access_restricted`, and their records are deleted from
`apikeys.json` at the next server startup.

### Habit metadata in the export

`GET /api/export` also returns `habitMeta`, one entry per habit that has a row
in the `HabitMeta` sheet:

```json
"habitMeta": {
  "Water": { "type": "number", "target": 8, "unit": "glasses", "slot": "morning", "time": "07:30" },
  "Read":  { "type": "check",  "target": null, "unit": null, "slot": "evening", "time": null }
}
```

Cells of a `number` habit hold the raw daily value; it counts as done when it
reaches `target`. `slot` is `morning`, `afternoon`, `evening` or `any`.

## 2. Endpoints

All endpoints accept either authentication method above.

### `GET /api/export`

Returns the whole dataset as JSON. Optional date filters (`YYYY-MM-DD`):
`?oldest=2024-01-01&newest=2024-01-31`.

```bash
curl -H "X-API-Token: hk_..." "https://your-host/api/export?oldest=2024-01-01"
```

```json
{
  "timestamp": "2023-10-27T10:00:00.000Z",
  "weekdays": [...],
  "weekend": [...],
  "counters": [...],
  "notes": [...],
  "colors": { "weekdays": {...}, "weekend": {...}, "counters": {...} }
}
```

Temptation counters are keyed by their readable name (`Category - action`);
other counters keep their internal id.

### `GET /api/colors`

Header background colours of the `Weekdays` / `Weekend` sheets, keyed by habit
name.

### `GET /api/counter`

Today's counters (`{ success, date, counters, metadata }`). With
`?oldest=...&newest=...` it returns `{ success, entries, metadata }` for the
range instead.

### `POST /api/counter/increment`

Body: `{ "counter": "<name>" }`. Increments today's value of that counter,
creating the column if needed. Names must match `^[A-Za-z0-9 _\-]{1,40}$`; the
reserved `_config` prefix is rejected with `400`.

```bash
curl -X POST -H "X-API-Token: hk_..." -H "Content-Type: application/json" \
     -d '{"counter":"water"}' https://your-host/api/counter/increment
```

### `GET /api/user/preferences`

Enabled tabs, default tab and temptation configuration for the authenticated
user (read from the `Counters` sheet header, with the local copy as fallback).

## 3. Optional: service account fallback

Only needed for API keys generated **without** a refresh token (older keys).
Create a service account in the Google Cloud Console, download its JSON key,
share the spreadsheet with its `client_email`, and set:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keys generated from the app after signing in store a refresh token, so new
installations usually do not need this.

## 4. Running the server

```bash
npm install
npm run build
npm start
```

Or with Docker (`compose.yml` runs it behind Traefik with automatic TLS):

```bash
docker build -t habitikami .
docker run -p 80:80 --env-file .env -v ./data:/app/data habitikami
```

Required runtime variables: `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
(legacy name `VITE_GOOGLE_CLIENT_SECRET` still accepted), `OWNER_EMAIL`,
`ALLOWED_ORIGINS`. Optional: `VITE_SPREADSHEET_ID`, `ALLOWED_EMAILS`, and the
service-account pair above.
