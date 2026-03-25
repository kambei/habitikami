# Changelog

All notable changes to this project will be documented in this file.

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
