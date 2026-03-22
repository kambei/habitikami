# Habitikami

A habit tracking platform with a web app and an Android companion app with home screen widgets.

## Projects

### [habitikami-web](./habitikami-web)

A **React + Vite + TypeScript** progressive web app for daily habit tracking, powered by Google Sheets as a backend.

**Features:**
- Track daily habits with a checkbox grid and compact views
- Counters, mood tracking, and smoke temptation logging
- Graphs and analytics to visualize completion rates over time
- Google Sheets integration — authenticates via Google Identity Services and reads/writes directly to your spreadsheet
- Responsive design with Tailwind CSS
- Dockerized with Nginx for self-hosting
- Multi-user support via Express backend

**Tech stack:** React 19, TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion, Express, Google Sheets API

### [habitikami-android-and-widgets](./habitikami-android-and-widgets)

A native **Android** app that wraps the Habitikami PWA (`habitikami.kambei.dev`) in a WebView, providing a native app experience with home screen widgets for quick habit tracking.

**Features:**
- Native Android wrapper for the Habitikami web app
- Home screen widgets for at-a-glance habit status
- Seamless Google authentication flow

**Tech stack:** Kotlin, Android SDK, Gradle

## Getting Started

See each project's own README for setup instructions:
- [Web app setup](./habitikami-web/README.md)

## License

This project is licensed under the [MIT License](./LICENSE).
