# Changelog

All notable changes to this project will be documented in this file.

## [5.0.1] - 2026-03-24
### ✨ The Privacy and Dynamic Era
- **Temptations Migration**: Officially renamed "Smoking Temptations" to "Temptations" to reflect the new dynamic multi-category system.
- **Dynamic Counters**: Create, iconize, and color-code unlimited temptation categories (Smoking, Snacking, etc.) directly from the UI.
- **What's New Notification System**: Integrated a premium notification system that detects updates via MD5 hashing and suggests reloads.
- **Full Privacy Migration**: All user preferences and temptation metadata are now stored solely in your Google Spreadsheet's header row. Zero configuration on our servers.
- **Auto-Provisioning**: Automated spreadsheet column creation for new counter types.
- **Enhanced Graphs**: Automated mapping of all discovered counters into the "Graphs" visualization tab.

## [4.x] - 2026-03-23
### 🔧 Infrastructure & Tooling
- **Docker Support**: Added Dockerfile and Github workflows for containerized deployment.
- **Gradle Wrapper**: Integrated Gradle wrapper for Android build consistency.
- **GitHub Integration**: Social links and contribution buttons on the landing page.
- **General Fixes**: Refactored core layers to be metadata-ready.

## [3.x] - 2026-03-20
### 📱 Mobile and PWA Foundation
- **PWA Ready**: Added Progressive Web App support for a native-like experience on all devices.
- **Multi-Tab Layout**: Introduced "Weekdays" and "Weekend" spreadsheet tab support.
- **Security**: Switched to Google OAuth 2.0 (Three-legged) for secure, privacy-compliant data access.
- **Mobile First**: Complete overhaul of the UI with Framer Motion for a fluid, responsive mobile experience.
- **Android Integration**: Initial CI/CD pipelines and widget configuration support.
