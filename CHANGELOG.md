# Changelog

All notable changes to this project will be documented in this file.

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
