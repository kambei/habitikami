# Changelog

All notable changes to this project will be documented in this file.

## 🌐 Web 5.17.0 + 🤖 Android 5.5.0 - 2026-10-23
### 📱 Android "Today" widget (#123)
- **New widget "Today"**: the habits of today's row as a list, pending ones first and ordered by time slot; a tap cycles not done → done → half → not done and writes the sheet right away. Numeric habits open the app. Header with date and done/total, refresh button, the usual "tap to configure", offline and wrong-key states.
- **API**: `GET /api/today?date=` (today's row with meta and colours) and `POST /api/cell` (`{ date, habit, value }`, TRUE/FALSE/HALF/SKIP or a number), both with the widget API key or a Bearer token.

## 🌐 Web 5.16.1 - 2026-10-23
### 🧹 Code quality (#120)
- ESLint at zero errors and now part of the CI: real types replace `any` (sheet rows, counters, temptations, API errors), handlers used by effects are declared first, state updates from effects are deferred, derived table inputs are memoized.
- `SettingsView` lives in its own file; `HelpView` keeps only the CBT/ACT tools and asks the app to open Settings when a key is missing.
- Graphs load month rows and colours through react-query (cached, persisted, shared with the table) instead of a manual effect.
- Temptations no longer reload the page after a tap: counters refresh in place.

## 🌐 Web 5.16.0 - 2026-10-22
### 🤖 AI assistant setup (#25)
- **Guided setup** in Settings: pick Gemini (free) or Claude (paid, with a cost note), open the provider console with one tap, paste the key, "Check and save" tries it with a real call before storing it. The old two-card form is gone.
- **Shared server key** (optional): with `SERVER_AI_PROVIDER` and `SERVER_AI_KEY` in `.env`, the assistant works without a personal key, up to `SERVER_AI_DAILY_QUOTA` calls a day per account (default 20); the settings show the calls left.

### ♿ Accessibility (#70, #71)
- `aria-label` on icon-only buttons (menu, temptation arrows, sort, view toggle, share, online pill), `aria-pressed` on toggles (Now/All, week/month, 1/3/6 months, sort direction, grid/table), `aria-current` on the bottom nav.
- One visible keyboard focus ring everywhere; low-opacity muted text raised to readable contrast.

### 🔧 Fixes
- **Report PDF cut to one page**: printing now opens the report alone in a print window, so many habits paginate correctly and charts print as vectors.

## 🌐 Web 5.15.0 - 2026-10-22
### 🏆 Achievements (#3)
- **Sixteen trophies** judged on the data already loaded: streaks of 7/30/100, perfect day/week/month, 30 days tracked, 5 habits, 100/500/1000 completions, 50/200 temptations resisted, 10 notes, mood on 30 days.
- **Trophies** view from the hamburger menu: unlocked and locked with progress bars, grouped by category.
- The unlock state lives in a new `Achievements` sheet (`Id | UnlockedAt`), so every device shows the same trophies; a celebration card pops up when one is unlocked.

### 📸 Shareable cards (#10)
- **Share as image** from the streak leaderboard (per habit), from the weekly/monthly report (completion ring) and from every unlocked trophy: a 1080×1080 PNG goes to the share sheet on Android (Web Share API) or downloads on desktop. No public page, only the image leaves the device.

## 🌐 Web 5.14.3 - 2026-10-22
### 🔧 Fixes
- **Missing chunk after a deploy**: when a tab's file is gone from the server (an old page served by a browser or CDN cache), the app reloads itself with a cache-busting `?v=` so a fresh page arrives even through caches that ignore headers; after two failed attempts the error is shown with the explanation.

## 🌐 Web 5.14.2 - 2026-10-22
### 🧭 Settings is its own view
- **Settings** (hamburger menu) opens as a separate view with its own `#Settings` address and back arrow; **Help** keeps only the CBT/ACT tools. Before, Settings was a mode inside the Help tab.
- A crashing tab (or the What's New overlay) now shows the error text with a Reload button instead of a black screen.
- The page, the service worker and the manifests are served with `Cache-Control: no-cache`, hashed assets as immutable: a proxy can no longer serve a stale page that asks for chunks gone after a deploy.

## 🌐 Web 5.14.1 - 2026-10-22
### 🔧 Fixes
- **Tabs broken after a deploy** (Help/Settings showed an error): the service worker served the cached page, which asked for chunks whose hashed names no longer existed. Pages are now network-first (cached shell only when offline) and a missing chunk reloads the page once by itself.
- **Docker**: the runtime image copies `push.js`, so the container starts.

## 🌐 Web 5.14.0 - 2026-10-22
### 🔔 Push Reminders (#11)
- **Push notifications** from Help → Settings: enable on this device, send a test, choose the evening and weekly times, silence single habits. Works in the Android app too (Chrome push shows as a native notification).
- **Per-habit reminders** at the habit time or its slot's default (morning 08:00, afternoon 14:00, evening 19:00), sent only if the habit is still pending; **evening nudge** "N habits left"; **weekly report** on Sunday with completion vs the week before, best and weakest habit.
- Server side: `web-push` with VAPID keys (from the environment or generated once into `data/vapid.json`), subscriptions in `data/push.json` with the refresh token encrypted, a `node-cron` tick every minute in the user's time zone. The private-mode purge covers push data too.

### 📴 Offline (#16, #72)
- **Cached reads**: habits, metadata, colours, notes, mood and counters survive a reload and are shown while offline (persisted react-query cache, one week).
- **Queued writes**: ticking cells, counter taps and notes made without network wait on the device and are replayed when back online, in order, with retries. Last write wins per cell; a toast tells when the server value had changed meanwhile.
- **Header pill** with the offline state and the number of changes waiting (tap to retry).
- **No endless spinner**: table, grid and Focus show "You are offline" or "Google Sheets did not answer" with a Retry button when nothing is cached.

## 🌐 Web 5.13.0 - 2026-10-21
### 📊 Analytics (Graphs)
- **Habit correlations (#4)**: phi coefficient per pair over 1, 3 or 6 months, shown as a habit × habit heatmap plus plain sentences ("when you do X you tend to do Y too / to skip Y") for |φ| ≥ 0.3 on at least 20 shared days. Skips and empty cells are excluded.
- **Mood and habits (#5)**: Mood sheet entries joined by day with the habit rows; diverging bars with the average mood on days with vs without each habit and a "habits that do you good" top 3.
- **Projections (#7)**: dashed trend line on the daily completion chart (linear regression on the last 30 days) with the weekly slope, and "at this pace X reaches a N-day streak in K days" under the streak leaderboard.
- **Weekly / monthly report (#6)**: completion vs the previous period, days tracked, active streaks, average mood, per-habit bars, most/least completed, counters. Built on the fly, no email.
- **Export (#18)**: CSV of habits, counters, notes and mood for the report period (one section each, Excel-friendly) and PDF through the browser print dialog, which prints only the report card.

## 🌐 Web 5.12.1 - 2026-10-21
### ✨ UX
- **Scrolling habit titles**: in the table and in the grid, a habit name that does not fit its box glides slowly back and forth (pause at each end, soft fade on the edges) instead of being cut with "…" or stretching the column. Names that fit stay still; with "reduce motion" enabled the ellipsis is kept.

## 🌐 Web 5.12.0 + 🤖 Android 5.4.0 - 2026-10-21
### 🪟 Windows 11 Widgets (#67, #87, #88, #89, #94)
- **Sync from any view**: the widget summary is pushed to the service worker from a single hook, so it stays fresh whatever page is open (not only the table).
- **Real actions**: "Complete next" and "Skip next" open Focus and apply the action to the first pending habit; "Open" goes straight to the app.
- **Translated** labels and dates (manifest in Italian too), **two new widgets**: today's counters and the longest streak.
- Widget data is cached and survives service-worker updates; fallback cards when there is no data yet.

### 🤖 Android Widgets (#74, #75, #76, #77, #78, #79, #93)
- **Error states**: a widget with no server or key says "Tap to configure" and opens its settings; a 401/403 says the key is wrong and opens the settings; offline keeps the last data with a "last updated" line instead of going blank.
- **Loading** indicator while refreshing, "last updated" time stored per widget.
- **Italian** strings for every widget and settings screen.
- **Refresh on launch**: opening the app refreshes every widget right away and again shortly after, so what you tick shows up on the home screen.
- **Update dialog** with the release notes and a direct APK download (falls back to the release page).
- `BaseWidgetProvider` refactor (#101) left out on purpose: the shared helpers in `WidgetErrors` cover the duplicated parts with less risk.

### 🔗 Widget Pairing (#68, #90, #100)
- **One tap on the phone**: after generating an API key in Help → Settings, a "Configure the widgets on this phone" button opens the Habitikami app, which stores server and key in the encrypted widget store and refreshes every widget. Nothing to type.
- **QR from desktop**: the same screen shows a QR code; scanning it with the phone camera opens the app and configures the widgets. The key travels in the URL hash and never reaches the server.

## 🌐 Web 5.11.0 + 🤖 Android 5.3.6 - 2026-10-21
### 🔥 Streaks (#1)
- **Streak Badges**: a flame chip with the current streak in the table header, next to each habit in the grid and under the habit in Focus (hover shows the best streak). Computed over the last year across Weekdays and Weekend with the shared rules (TRUE/HALF continue, SKIP neutral, today pending).
- **Milestones**: reaching 7, 30 or 100 days in a row shows a one-off celebration card, remembered per device.
- **Longest Streaks** section in Graphs: habits ranked by best streak with the current one next to it. The Windows widget summary uses the same numbers.

### 🔢 Quantitative Habits (#14)
- **Type, Goal, Unit** per habit from the habit info popup (table and grid), which now also opens right after adding a habit. The editor replaces the description-only one and keeps every other field.
- **Numeric Cells**: +/- stepper with direct input and a progress bar in the table; compact tap-to-step cell in the grid (right-click steps down); goal and input in Focus, where "Complete" sets the goal.
- **Values Over Time** chart with the goal line in Graphs for every numeric habit.
- **Widgets**: `/api/export` returns `habitMeta`; the Android widgets count a numeric cell as done when it reaches its goal (Android 5.3.6).

### 🌅 Time Slots (#12)
- **Morning / Afternoon / Evening** tag and optional reminder time per habit; shown on the table header, the grid labels and the Focus card.
- **Focus by Slot**: Focus lists the habits of the current slot first (then "any time", then the rest) with a Now/All toggle. The reminder time feeds the push reminders coming with #11.

### 📝 Notes per Habit and Day (#13)
- **HabitNotes Sheet** (`Date | Habit | Note`): a note button on every table cell (and right-click), a dot on grid cells with a note (right-click opens it), note text in the tooltips.
- **Search**: the Notes view gets a search box over all habit notes with inline editing.

### 📦 Habit Templates (#15)
- **Four Packs**: fitness, productivity, mental wellbeing, quit smoking, in Italian and English, with colours, time slots, goals and descriptions.
- **Picker** from the table header (next to "+") and from Help settings: choose the habits, add them to Weekdays, Weekend or both; existing names are skipped.

## 🌐 Web 5.10.1 - 2026-10-21
### ✨ UX Quick Wins
- **Document Language** (#57): `<html lang>` now follows the app language on load and on every switch, instead of staying `en` until the language was toggled.
- **Logout Cleans AI Keys** (#65): signing out asks whether to remove the Gemini/Anthropic keys saved on the device, so they do not outlive the session on a shared computer.
- **Paste the Sheet Link** (#66): onboarding and the settings field accept the whole Google Sheets URL (with `/edit#gid`, `?usp=sharing` or `/u/N/`) as well as the bare ID; the recognised ID replaces the input before saving.
- **API Key Regeneration Warning** (#67): regenerating an existing key asks for confirmation and the new key is shown with a reminder to paste it into the Android widget settings, which otherwise stop working silently.
- **Untranslated Strings** (#69): "What's New", the habit/day/column toasts, the onboarding and tab-selection toasts, the training stats labels and the Windows widget "all done" fallback are now translated (IT/EN). The two missing keys `graphsActiveDays` and `habitTableAllDone` exist, and the 27 `t('…' as any)` casts are gone: template, tour and tab keys are typed as `TranslationKey`. New `translate()` helper for code outside React.

## 🌐 Web 5.10.0 - 2026-10-21
### 🧠 Mood History Moves to Your Google Sheet (groundwork for #5 and #6)
- **New `Mood` Sheet**: `Date | Timestamp | Mood | Anxiety | Label | Source`, created on the first assessment. Mood entries from guided sessions and worksheets are appended there instead of the browser storage, so the history follows you across devices and is no longer capped at 100 entries.
- **Automatic Migration**: entries saved so far in the browser are written to the sheet (tagged `local`) the first time the Mood Tracker opens; nothing is lost. The same local key now works as an outbox: an assessment that cannot reach the sheet (offline) is queued and flushed on the next open.
- **Clear History** asks for confirmation and empties the sheet (header kept).
- **Tests**: 8 cases on row parsing, clamping and the pending queue (46 in total).

## 🌐 Web 5.9.9 - 2026-10-21
### 🧱 Extended Habit Metadata and Numeric Cells (groundwork for #14 and #12)
- **`HabitMeta` Sheet Grows to Seven Columns**: `Habit | Description | Type | Target | Unit | Slot | Time`. `Type` is `check` (default) or `number`; `Target` is the daily goal of a quantitative habit; `Unit` is free text; `Slot` is `morning`, `afternoon`, `evening` or empty for any time; `Time` is an optional `HH:MM` reminder time. Existing two-column sheets keep working: missing cells read as defaults and the header row is upgraded the first time metadata is saved. Rename still migrates the whole row.
- **Partial Updates**: saving a description no longer touches the other columns; `setHabitMeta(name, patch)` merges the given fields into the existing row.
- **Numeric Cells**: the sheet parser maps a numeric cell (`6`, `6.5`, `6,5`) to a number instead of "not done", and the cell type `HabitCellValue` is shared by every consumer. A numeric value counts as done when it reaches the habit's target (or is above zero without one); the streak rules and the grid popup apply it. Toggling a numeric cell is ignored until the value editor arrives with #14.
- **Tests**: 11 new cases on the parser, the metadata row round-trip and quantitative streaks (38 in total).

## 🌐 Web 5.9.8 + 🤖 Android 5.3.5 - 2026-10-21
### 🔥 One Streak Rule Everywhere (groundwork for #1)
- **Shared Streak Rules**: `TRUE` and `HALF` continue a streak, `SKIP` is neutral (it neither breaks nor extends it and is left out of completion rates), `FALSE` breaks it, and a day that is not over yet (today) is pending rather than missed. Dates without a row are neutral, so weekday-only habits are not penalised for weekends. The web app (`utils/streaks.ts`) and the Android widgets (`widget/Streaks.kt`) implement the same rules; before, both treated SKIP and HALF as misses and ignored any number of trailing unchecked days.
- **Grid View Popup**: current and best streak, completed count and percentage of the selected habit now follow these rules; the percentage is computed over non-skipped days.
- **Windows Widget**: the summary pushed to the service worker carries the real longest current streak over the last 90 days (it was always 0).
- **Android Widgets**: the export parser keeps `HALF` and `SKIP` apart from `FALSE`; Habit Stats and Streak Fire use the shared rules, and skipped days are excluded from the 30-day rate.
- **Multi-month Reads**: new `HabitService.getRangeData(sheet, from, to)` and `useSheetRange` hook fetch any date span of a sheet in one request (the monthly reader now shares the same code path). Cell updates invalidate range queries as well.
- **Tests**: 12 unit tests on the streak rules and the Weekdays/Weekend merge.

## 🌐 Web 5.9.7 - 2026-10-21
### 🧪 Server Route Tests in CI
- **vitest + supertest** (#73): `npm test` imports `server.js` (which now only listens when run directly and reads its data files from `DATA_DIR`, defaulting to `./data`) and drives the routes with a stubbed Google backend, so no network or credentials are needed. `build-web.yml` runs the suite before the Docker build.
- **Covered cases** (#91): `/api/auth/exchange` without code, with an invalid `id_token` and from a foreign origin; Bearer tokens issued to another OAuth client (audience mismatch) vs. this client; unknown or missing `X-API-Token` on `/api/export`; malformed, reserved and missing counter names on `/api/counter/increment`.
- **Two status codes fixed along the way**: an invalid `id_token` during the code exchange now answers `400 Invalid id_token` instead of `500`, and a browser origin outside `ALLOWED_ORIGINS` gets `403` instead of the default `500` from the CORS error.

## 🌐 Web 5.9.6 - 2026-10-21
### 🔒 Private Mode Purges Other Accounts' Data
- **Startup Cleanup**: When `ALLOWED_EMAILS` is set, the server now deletes on every startup everything it stores about accounts outside the allowlist: their entries in `users.json` (spreadsheet ID, preferences), `apikeys.json` (widget API keys and encrypted refresh tokens), `risc-revoked.json` and the legacy `preferences.json`. Emails are compared case-insensitively; API key records without an owner are removed too. The accounts' Google Sheets and Drive files are untouched, and open mode (empty `ALLOWED_EMAILS`) changes nothing.
- **Logged Without PII**: Each removed entry is logged with the usual hashed user id, plus a per-file summary.

## 🌐 Web 5.9.5 - 2026-10-21
### 🐛 Fix Android App Showing the Browser Address Bar
- **`/.well-known/assetlinks.json` Was a 404**: `serve-static` 2.x (pulled in by Express 5 in 5.9.4) ignores dotfile paths by default, so the Digital Asset Links file stopped being served. Chrome could no longer verify the TWA and fell back to a Custom Tab with the address bar. The `.well-known` folder is now mounted explicitly with `dotfiles: 'allow'`. Reopen the app once after the deploy: Chrome re-runs the verification on launch.
- **Smoke Test in CI**: New `npm run test:smoke` starts the built server and asserts that `/.well-known/assetlinks.json` and `/manifest.json` answer `200` with JSON; `build-web.yml` runs it before building the Docker image so this cannot regress silently again.

## 🌐 Web 5.9.4 + 🤖 Android 5.3.4 - 2026-10-20
### 📦 Dependency Updates (Dependabot)
- **Express 5** (Web): The SPA fallback route is now `/{*splat}` and serves `index.html` via `res.sendFile('index.html', { root })`, as required by the stricter Express 5 router. API routes are unchanged.
- **Vite 8 + @vitejs/plugin-react 6** (Web): Builds now run on rolldown. The manual chunk map became `advancedChunks` groups with the same five chunks (vendor, charts, motion, lucide, query).
- **lucide-react 1.x** (Web): Brand icons were removed upstream; the GitHub mark is now an inline `GithubIcon` component.
- **recharts 3.10, React 19.3, dotenv 18 and the minor/patch group** (Web): Tooltip formatter typings in `MoodGraph` and `CounterGraph` adjusted for the stricter recharts types.
- **Kotlin 2.4.21** (Android): `kotlinOptions.jvmTarget` migrated to the `compilerOptions` DSL.
- **androidx.core 1.19.1, coroutines 1.11, recyclerview 1.4, foojay 1.0** (Android): `compileSdk` raised to 37 (required by androidx.core); `targetSdk` stays 35.
- **CI**: Pull requests without signing secrets (Dependabot, forks) now build an unsigned release APK instead of failing, so dependency PRs get a meaningful Android build.


## 🤖 Android 5.3.3 - 2026-10-20
### 🔒 Widget Key Security
- **Encrypted Widget Config**: The server URL and API key used by the home screen widgets are now stored in `EncryptedSharedPreferences` (AES-256, master key in the Android Keystore) through a single `WidgetConfigStore` helper instead of a plaintext XML file. Non-sensitive widget data (counter definition cache, chart filter) stays in the regular preferences.
- **Transparent Migration**: On first access after the update, the previously saved URL and key are moved into the encrypted store and wiped from the plaintext file — no need to reconfigure any widget. If the encrypted store cannot be opened (corrupted Keystore, data restored from another device), it is recreated empty and the widgets simply show as "not configured" instead of crashing.
- **No Cloud Backup of the Key**: `android:allowBackup="false"`, plus `dataExtractionRules` (API 31+) and `fullBackupContent` (API < 31) that exclude both the encrypted and the legacy preferences file, so the key stays out of Google backups and device-to-device transfers even if backups are re-enabled in the future.
- **HTTPS Only**: All four widget config screens reject a server URL that does not start with `https://` (translated error, Italian strings added for the config screen) and the app declares `usesCleartextTraffic="false"`. Debug builds keep an exception for `http://10.0.2.2` and `localhost` to test against a local server from the emulator.
- **Release Build Fix**: ProGuard `-dontwarn` rules for the JSR-305 annotations referenced by Tink, so the minified release build keeps passing.

## 🌐 Web 5.9.3 - 2026-10-20
### 🔒 Security Hardening
- **Access Token Audience Check (S1)**: Incoming `Bearer` tokens are now verified against Google's `tokeninfo` endpoint: the audience must be this app's OAuth client, the token must not be expired and the email must be verified. Tokens issued to other apps get a `401`. Results are cached in memory until the token expires.
- **Hashed Widget API Keys (S3)**: `apikeys.json` now stores `sha256(apiKey)` plus a short `prefix` for masking instead of the plaintext key. Existing plaintext keys are migrated automatically at startup and keep working — widgets need no change. The key is still shown once when generated.
- **Counter Name Validation (S4)**: `POST /api/counter/increment` only accepts names matching `^[A-Za-z0-9 _\-]{1,40}$` and rejects the reserved `_config` prefix. Column letters are computed with a proper A..Z, AA..AZ mapping.
- **`GOOGLE_CLIENT_SECRET` (S5)**: The OAuth client secret is read from `GOOGLE_CLIENT_SECRET` (server-only, no `VITE_` prefix). `VITE_GOOGLE_CLIENT_SECRET` still works as a deprecated fallback with a startup warning, so existing deployments and encrypted refresh tokens are unaffected.
- **Docker Build Context (S6, S16)**: New `.dockerignore` keeps `node_modules`, `data`, `.env*`, docs and local tooling out of the image. Removed the unused `nginx.conf`, `docker-entrypoint.sh`, `test_export.js` and `diagnose_weekend.js`. `README-EXPORT.md` now documents per-user auth (`X-API-Token` or Bearer); `EXPORT_API_TOKEN` and `?token=` are gone.
- **Node 22, Dependabot, CI Audit (S7)**: Docker image on `node:22-alpine`, `googleapis` updated to v186, Dependabot for npm/gradle/github-actions, and `npm audit --omit=dev --audit-level=high` runs in CI before the Docker build.
- **No Emails in Logs (S9)**: Server logs print `logId(email)` (first 8 hex chars of `sha256(email)`) instead of the account email. `compose.yml` caps container logs (json-file, 10m × 5).
- **Token Revocation on Logout (S10)**: New `POST /api/auth/logout` revokes the refresh token at Google (best effort, always `204`); the web app calls it with `keepalive` before clearing the local session.
- **Traefik, RISC, Pinned Actions (S11, S12, S14)**: Traefik no longer runs with `--api.insecure=true`; `POST /api/risc/events` is rate limited (60/min); all GitHub Actions are pinned to release commit SHAs.

## 🌐 Web 5.9.2 - 2026-10-18
### 🔒 Private Mode (Account Allowlist)
- **`ALLOWED_EMAILS` Environment Variable**: When set to a comma-separated list of Google accounts, only those accounts can sign in, renew a session or use a widget API key. Everyone else receives a 403 `access_restricted` response. Leave it empty for open access (default).
- **Enforced Everywhere**: The check runs on `/api/auth/exchange`, `/api/auth/refresh`, the shared `authenticate` middleware (export, counters, colors), the preferences and API key routes, and the Gemini/Anthropic proxies, so existing sessions and widgets of non-allowed accounts stop working too.
- **Clear Message for Blocked Users**: The landing page now shows a translated toast ("access temporarily restricted for maintenance") after the OAuth redirect instead of silently returning to the sign-in screen. Sign-in error toasts are now localized.

## 🌐 Web 5.9.1 - 2026-06-30
### 🐛 Fix Worksheet Import Failing on Large Files
- **Larger Body Limit for AI Endpoints**: `/api/anthropic/chat` and `/api/gemini/chat` now accept up to 25 MB so multimodal (base64 image/PDF) payloads from the handwriting import get through. The default 100 kb limit caused the server to return an HTML 413 page, which surfaced as `Unexpected token '<' ... is not valid JSON`. Other endpoints keep the standard limit.
- **Graceful AI Error Handling**: `callAI` no longer crashes when an error response isn't JSON — it falls back to reporting the HTTP status (e.g. `... (HTTP 413)`) instead of throwing a cryptic JSON parse error.

## 🌐 Web 5.9.0 - 2026-06-30
### ✍️ Import Handwritten Worksheets (AI Handwriting Recognition)
- **Read Worksheets Filled on Paper/Tablet**: New "Import handwritten worksheet" flow in the Help area. Upload an emotion worksheet you filled by hand (PDF, PNG, JPG or WEBP, up to 15 MB) and the AI reads your handwriting and transcribes it into the standard worksheet format.
- **Multimodal AI Calls**: `callAI` now supports image/PDF attachments for both providers — Claude (`document`/`image` content blocks) and Gemini (`inline_data` parts). No server changes were needed: the existing chat proxies forward the multimodal payloads as-is.
- **Review Before Saving**: The transcription opens in an editable screen with the detected date and title, a list of parts the AI read with low confidence, and a formatted preview — so you can correct any recognition errors before committing.
- **Saved & Consolidated**: The reviewed worksheet is saved to the `habitikami-worksheets` folder on Google Drive (with its date in the body) so it is consolidated alongside the worksheets compiled in the app for the same date.
- **Privacy**: The file stays on your device until you import it and is sent to your own AI provider only for transcription. Output is written via the existing `drive.file` permission — no other Drive files are read.

## 🌐 Web 5.8.2 - 2026-06-28
### 🚬 Readable Temptation Names in Export
- **Real Names in `/api/export`**: Temptation columns in the export endpoint are now keyed by their real name (`Category - action`, e.g. `Smoking - Resisted`) instead of their internal id. Other counter columns keep their existing id keys, so non-temptation data is unaffected.

## 🌐 Web 5.8.1 - 2026-05-21
### 📱 Habit Editing in the Grid View
- **Rename in the Stats Popup**: Clicking a habit in the grid view now shows a pencil next to its name — tap to rename inline, Enter or check-icon to save, Escape or X to cancel.
- **Description in the Same Window**: The streaks popup now includes the habit's description with a read/edit toggle, persisted to the `HabitMeta` sheet. No need to open a separate dialog.
- **Description Tooltips Everywhere**: Both the habit-name label and each day-square in the grid view surface the description as a native hover tooltip.

### 🖱️ Mobile-Friendly Table Header
- **Always-Visible Affordances**: The pencil + info icons on each habit column in the table view are now visible by default on mobile (still hover-revealed on desktop) so touch users can actually reach them.

## 🌐 Web 5.8.0 - 2026-05-21
### 🚬 Today Badges on Temptation Buttons
- **At-a-Glance Today's Counts**: Each action button on the Temptation view now shows a small numeric badge in its top-right corner with today's total for that counter — no need to switch to the Counters view to see how the day is going.
- **Optimistic Updates**: The badge bumps the instant you tap, and reverts automatically if the save fails.

### ✏️ Editable Habit Names & Info Popup
- **Inline Rename**: A pencil icon next to each habit column header in the table view enables inline renaming. Press Enter (or click away) to save, Escape to cancel.
- **Habit Info Popup**: A new info icon opens a popup showing the habit's description in a read/edit toggle. Descriptions are persisted to a new `HabitMeta` sheet, created automatically on first save.
- **Description Tooltips**: Every checkbox cell now exposes the habit's description as a hover tooltip, so context is always one mouse-over away.
- **Rename-Safe Metadata**: Renaming a habit migrates its description in `HabitMeta` so notes stay linked to the new name.

## 🌐 Web 5.7.0 - 2026-05-19
### 🛡️ Anti-Panic Protocol (AI-Guided)
- **Three-Phase Worksheets**: Added 3 new AI-guided worksheets based on the CBT/ACT Anti-Panic Protocol, each covering a distinct phase of a panic episode:
  - **BEFORE** — Identify triggers, early warning signs, and build a fear hierarchy with an anticipatory response strategy.
  - **DURING** — Cognitive defusion, 5-4-3-2-1 sensory grounding, and radical acceptance with body sensation mapping. The AI uses a particularly calm, reassuring tone.
  - **AFTER** — Reality analysis (predicted catastrophe vs. actual outcome), symptom restructuring with medical explanations, resources & successes log, letter to future self, and ACT values compass.
- **Same Save-to-Drive Flow**: All three worksheets produce a compiled Markdown document and save to Google Drive, just like the existing Emotion Diary and Cognitive Restructuring sheets.

## 🌐 Web 5.6.3 - 2026-04-06
### 📱 Deep Link to Installed Apps
- **Android Intent Launch**: Tapping MadMuscles or Yoga Go plan entries on Android now opens the installed app directly via `intent://` (packages `com.amomedia.madmuscles` and `net.beginners.weight.loss.workout.women.yoga.go`), falling back to the website if the app isn't installed.
- **iOS / Desktop Fallback**: iOS opens an App Store search; desktop opens the website in a new tab.

## 🌐 Web 5.6.2 - 2026-04-06
### 🧘 Wake-up Stretch Sub-Exercises
- **Breakdown Panel**: Expanding "Stretching risveglio" in the daily plan now reveals 6 individually completable movements (collo, spalle, schiena, fianchi, gambe, caviglie).
- **Auto-Complete Parent**: When all sub-exercises are ticked, the parent "Stretching risveglio" entry is auto-completed.

## 🌐 Web 5.6.1 - 2026-04-06
### 🔗 Training Plan Links
- **External App Launch**: Tapping a MadMuscles or Yoga Go entry in the daily plan now opens the app's website in a new tab, marked with an external-link icon.
- **Full Plan Navigation**: Every remaining plan exercise now routes somewhere — cardio/equipment entries that previously had no target now fall back to the Isometria section.

## 🌐 Web 5.6.0 - 2026-04-06
### 🏋️ Training Section
- **Owner-Only Access**: The InForma!/Training tab is now visible and selectable only for the owner account; hidden for all other users.
- **Daily Tai Chi**: Added a 10-15 min MadMuscles Tai Chi session every morning and a 10-15 min Yoga Go Tai Chi session every evening (including weekends).
- **Click-to-Navigate**: In the daily Piano view, tapping an exercise now jumps to its matching section (e.g. Stretching → Stretch tab). A dedicated chevron keeps access to the detail panel.

## 🌐 Web 5.5.2 - 2026-04-06
### 🎨 Grid View Scrolling
- **Week-Fit Columns**: The grid view now sizes day columns so exactly the current week fills the visible area on both desktop and mobile.
- **Horizontal Scroll**: Swipe or scroll left/right to reveal previous or upcoming days; today is centered automatically on open.

## 🌐 Web 5.5.1 - 2026-04-06
### 🎨 Grid View Layout
- **Full-Width Grid**: In Daily and Weekend tabs, the grid view now dynamically fills all available horizontal space on both desktop and mobile, instead of scrolling horizontally.
- **Better Spacing**: Added breathing room between the habit titles column and the day squares grid.

## 🌐 Web 5.5.0 - 2026-04-06
### 📈 Counter Trend Chart
- **No Future Days**: The Trend view for counters now stops at today when viewing the current month, instead of rendering empty future days.

## 🌐 Web 5.4.0 - 2026-03-29
### 🌓 Half-Done Habits
- **Partial Completion Support**: You can now mark a habit as "half-done" by placing `HALF` in your Google Sheet.
- **Diagonal Split Visuals**: Half-done habits are rendered as a square cut diagonally in both the Table and Grid views, using your habit's custom color.
- **Weighted Analytics**: Individual habit heatmaps show the diagonal cut, and aggregate charts (trends, radar) now count "half" habits as **0.5** completion for more accurate tracking.
- **Focus Tab Integration**: The daily Focus view correctly tracks your progress by including partially completed tasks in the handled count.

## 🌐 Web 5.3.1 - 2026-03-29
### 🌍 Internationalization (i18n)
- **Training Module Translation**: Fully translated the InForma! training section into English (including 80+ unique exercise names, targets, steps, progressions).
- **Database Language Consistency**: Fixed a critical synchronization bug where logging exercises in different UI languages caused Google Sheets tracking to fragment across multiple session headers (e.g. "Catalogo" vs "Catalog"). Tracking headers are now standardized regardless of the display language.

## 🌐 Web 5.3.0 - 2026-03-29
### 🏋️ InForma! Training Section
- **New Training Tab**: Full InForma! workout plan integrated as an opt-in tab — enable it from tab customization.
- **7 Exercise Sections**: Piano (daily plan), Stretching, Sedia (chair), Aikido Solo, Shaolin Isometrics, Isometria, Anti-Craving — 70+ exercises with descriptions, progressions, muscle targets, and YouTube links.
- **Daily Plan View**: Day picker with morning/afternoon sessions (weekdays) and single long sessions (weekends), matching the original InForma! schedule.
- **Exercise Logging**: Tap ✓ on any exercise to log it to a new "Training" Google Sheet — tracks date, section, exercise name, session, and duration.
- **Undo Support**: Tap again to remove a logged exercise.
- **Training Stats in Graphs**: New section in Stats tab showing total exercises, active days, daily trend chart, and section breakdown — same style as daily/weekend stats.
- **Auto Sheet Creation**: The Training sheet is created automatically on first use — no manual setup needed.

## 🌐 Web 5.2.7 + 🤖 Android 5.3.2 - 2026-03-29
### 🐛 Quick Fixes
- **Color Picker Popup Fix** (Web): The color assignment and habit deletion popover no longer gets cut off at screen edges — it now repositions to stay fully visible within the viewport.
- **Larger Checklist Widget Text** (Android): The daily checklist widget now scales text dynamically based on habit count — much bigger and more readable when you have few habits.

## 🤖 Android 5.3.1 - 2026-03-29
### 🎨 Material 3 Widget Redesign
- **Material 3 Styling**: All 10 home screen widgets redesigned with Google-style Material 3 look — rounded 28dp corners, tonal surfaces, pill-shaped buttons, and consistent M3 color tokens.
- **Stat Cards**: Habit Stats widget now shows each metric in its own rounded card for better visual hierarchy.
- **Tonal Icon Buttons**: Refresh buttons use circular tonal backgrounds instead of flat rectangles.
- **Updated Chart Renderer**: Heatmap and bar chart bitmaps now use M3 surface/text colors for a cohesive look.
- **Version Display Fix**: Android app version is now correctly shown in the web app's version dropdown when running inside the TWA.

## 🤖 Android 5.3.0 - 2026-03-25
### 📲 Dynamic Temptation Widgets
- **Dynamic Counter Widget**: Labels, colors, and actions fetched from server — no longer hardcoded. Up to 5 counter slots, auto show/hide.
- **Category-Aware Labels**: When multiple temptation categories exist (e.g., Smoking + Snacking), widget labels show the category name above the action to avoid ambiguity.
- **Chart Filter by Category**: The bar chart widget has a tappable filter — cycle through "All" or individual temptation categories.
- **Dynamic Chart Colors**: 14-day bar chart adapts colors and legend to your configured temptations.
- **Offline Cache**: Counter definitions cached locally so widgets display correctly even without network.
- **Fallback Defaults**: Graceful fallback to original 3 defaults if server isn't configured yet.
- **Server Auth Fix**: Preferences endpoint now supports API key auth for widget access.

### 🖼️ Widget Previews
- **All 10 widgets** now show fancy preview layouts in the Android widget picker with sample data — no more blank placeholders.

## 🌐 Web 5.2.6 - 2026-03-27
### 🧪 Test Update
- This is a test entry to verify the new update notification system.
- If you see this, the reload and cache-busting logic is working!

## 🌐 Web 5.2.5 - 2026-03-27
### 📊 Precise Analytics & Document Polish
- **Intuitive Mood Charts**: Negative trends (Stress, Anxiety) now correctly point to the left in the analytics bar chart.
- **Improved Consolidation**: Added support for `####`/`#####` markdown headers. JSON metadata is now tucked on a hidden separate page at the end of the document.
- **Real-time Update Banner**: Added periodic background checks (every 30m) and a "Reload Now" banner for seamless updates.
- **Supportive & Localized**: All temptation phrases are now fully translated and refined to be more encouraging.

## 🌐 Web 5.2.4 - 2026-03-26
### 📦 History Consolidation & Persistence
- **Full History Consolidation**: Move all past worksheets to an archive folder with a single tap, keeping your active workspace clean.
- **Persistent Analytics**: Consolidated summaries now embed their graph data directly in the Google Doc, ensuring trend and emotion charts are preserved forever.
- **Smart UI Toggle**: Added a "View Consolidated" vs "View Recent" toggle to the Mood Tracker for instant switching between long-term history and current week trends.
- **Progress Feedback**: New prominent loading states for consolidation and saving tasks to keep you informed during long-running background processes.
- **Enhanced Formatting**: Improved Markdown-to-HTML conversion for Google Drive, ensuring bullet points and paragraphs render perfectly in exported documents.

## 🌐 Web 5.2.3 - 2026-03-25
### 📊 Desktop Support & UI Polish
- **Universal Expansion**: The "Expand" button is now available on desktop as well! Hover over any graph to reveal the button and view it in a distraction-free fullscreen overlay.
- **Glassmorphism Overlay**: Enhanced the fullscreen modal with a consistent background and optimized layout for all screen sizes.

## 🌐 Web 5.2.2 - 2026-03-25
### 📊 Expandable Graphs & Manual Rotation
- **Manual Rotation Toggle**: Added a "Rotate" button in the expanded graph view to force a landscape-oriented display via CSS transforms. This ensures a great experience even when system orientation lock is unavailable (e.g., inside the Android app wrapper).
- **Floating Controls**: Added dedicated floating Rotate/Close buttons in the forced-landscape view for easier access while rotated.

## 🌐 Web 5.2.1 - 2026-03-25
### 📊 Expandable Graphs
- **Mobile Landscape Mode**: Added an "expand" button at the top right of every graph on mobile devices.
- **Fullscreen View**: Graphs now open in a dedicated fullscreen overlay, optimizing the available space and encouraging landscape orientation for better chart readability.
- **Universal Support**: Integrated across all visualizations, including Trends, Performance, Habit Completion, Heatmaps, and Temptation History.

## 🌐 Web 5.2.0 - 2026-03-25
### 🖼️ Windows 11 PWA Widgets
- **Native Widget Support**: Developed the infrastructure for Windows 11 PWA Widgets using Adaptive Cards.
- **Improved Asset Routing**: Fixed server-side redirects in Express and Nginx to ensure PWA manifest and widget assets are served correctly, avoiding SPA home-page hijacking.

## 🌐 Web 5.1.4 - 2026-03-24
### 📅 Weekly View & Trend Navigation
- **Weekly Bar Chart**: Replaced "Daily" with "Weekly" — bar charts now show only the current week (Mon–Sun) with weekday labels, no month selector needed.
- **Trend with Month Navigation**: The month prev/next selector now only appears in "Trend" mode for navigating the monthly line chart history.

## 🌐 Web 5.1.3 - 2026-03-24
### 🔙 Settings Navigation Fix
- **Back from Settings**: Closing the Settings panel now returns to the tab you were on before opening it, or your starred default tab — instead of staying on the Help view.

## 🌐 Web 5.1.2 - 2026-03-24
### 📊 Chart Mode Toggle
- **Daily / Trend Tab Selector**: Counter graphs now have a toggle between "Daily" (bar chart for the selected month) and "Trend" (line chart of monthly totals over time) instead of showing both stacked.
- Daily mode includes month navigation; Trend mode shows all-time monthly history.

## 🌐 Web 5.1.1 - 2026-03-24
### 🔧 Temptation Polish & Counter Graphs
- **Fixed Button Icons**: Temptation buttons now show ShieldCheck (resist) and ThumbsDown (succumb) instead of a confusing "?" fallback icon.
- **Motivational Phrases**: Both resisted and succumbed success states now display random motivational messages ("You are the worst!", "Willpower level: legendary!", etc.).
- **Monthly Trend Line Charts**: Each temptation now has a monthly totals line chart below the daily bar chart, showing long-term resist vs succumb trends.
- **Month Navigation**: Counter graphs are now navigable by month (prev/next) with daily bars scoped to the selected month.
- **Fixed Counters Scroll**: The counter table below graphs is now properly scrollable — using absolute positioning to break out of flex constraints.

## 🌐 Web 5.1.0 - 2026-03-24
### 🎯 Temptations Overhaul & Clarity Update
- **Vertical Button Layout**: Temptation actions now stack vertically — Resisted on top, Succumbed below — with maximized button sizes for easy tapping.
- **Clear Success Feedback**: Tapping Resisted shows a green check icon; tapping Succumbed shows a red X icon — no more ambiguous icons.
- **Empty State Guidance**: When no temptations are configured, a helpful message directs users to Settings.
- **Sheet Cleanup on Delete**: Deleting a temptation in Settings now also removes its columns from the Counters spreadsheet.
- **Per-Temptation Comparison Charts**: The Counters view now shows one bar chart per temptation comparing Resisted vs Succumbed with their configured colors, stacked vertically and scrollable.
- **Removed Daily/Monthly Toggle**: Counter graphs now display a single clean daily view as before.
- **Larger Last Chart**: The last temptation chart card is taller for better visibility.
- **Graph Overflow Fix**: Bar charts in the analytics view now scroll horizontally instead of clipping.

## 🌐 Web 5.0.4 - 2026-03-24
### 🧹 Clean Trends & Sheet Sync
- **Simplified Dashboard**: Removed the top-level Temptation Hero Bar to favor the detailed original view.
- **Focused Counter Graphs**: Filtered out binary "Resisted/Succumbed" metrics from trend lines to focus exclusively on numerical habit data.
- **Bi-Directional Color Sync**: Changing temptation colors in settings now automatically updates the Google Sheet column header colors in real-time.

## 🌐 Web 5.0.3 - 2026-03-24
### ✨ Enhanced Analytics & Layout
- **Time-Based Aggregation**: Introduced a new toggle between **Daily** and **Monthly** views for counter graphs to visualize long-term trends.
- **Color Fidelity Fix**: Fixed a case-sensitivity issue in trend line matching. Your custom temptation colors now apply perfectly regardless of spreadsheet formatting.
- **Natural Scrolling Layout**: Refactored the Counters dashboard for a more fluid experience where the entire view scrolls, allowing graphs to move out of the way for historical logs.

## 🌐 Web 5.0.2 - 2026-03-24
### ✨ Hero Temptations & Detailed Trends
- **Hero Temptation Bar**: A high-impact, dynamic section at the top of the dashboard for instant logging.
- **Massive Action Buttons**: Premium, large buttons with enhanced visual depth and micro-animations.
- **Granular Multi-Category Graphs**: Counter graphs now display separate trend lines for each dynamic category (e.g., Smoke vs Coffee).
- **Auto-Sync Logic**: Enhanced build-time synchronization for zero-config changelog updates in Docker.

## 🌐 Web 5.0.1 - 2026-03-24
### ✨ The Privacy and Dynamic Era
- **Temptations Migration**: Officially renamed "Smoking Temptations" to "Temptations" to reflect the new dynamic multi-category system.
- **Dynamic Counters**: Create, iconize, and color-code unlimited temptation categories (Smoking, Snacking, etc.) directly from the UI.
- **What's New Notification System**: Integrated a premium notification system that detects updates via MD5 hashing and suggests reloads.
- **Full Privacy Migration**: All temptation preferences metadata are now stored solely in your Google Spreadsheet's header row. Almost zero configuration on our servers.
- **Auto-Provisioning**: Automated spreadsheet column creation for new counter types.
- **Enhanced Graphs**: Automated mapping of all discovered counters into the "Graphs" visualization tab.

## 🌐 Web 4.x - 2026-03-23
### 🔧 Infrastructure & Tooling
- **Docker Support**: Added Dockerfile and Github workflows for containerized deployment.
- **Gradle Wrapper**: Integrated Gradle wrapper for Android build consistency.
- **GitHub Integration**: Social links and contribution buttons on the landing page.
- **General Fixes**: Refactored core layers to be metadata-ready.

## 🌐 Web 3.x - 2026-03-20
### 📱 Mobile and PWA Foundation
- **PWA Ready**: Added Progressive Web App support for a native-like experience on all devices.
- **Multi-Tab Layout**: Introduced "Weekdays" and "Weekend" spreadsheet tab support.
- **Security**: Switched to Google OAuth 2.0 (Three-legged) for secure, privacy-compliant data access.
- **Mobile First**: Complete overhaul of the UI with Framer Motion for a fluid, responsive mobile experience.
- **Android Integration**: Initial CI/CD pipelines and widget configuration support.
