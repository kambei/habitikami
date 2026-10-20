# Habitikami Web

A React + Vite + TypeScript web application for habit tracking, using Google Sheets as a backend.

## Features
- **Habit Tracking**: Track daily habits.
- **Google Sheets Integration**: Authenticates with Google and reads/writes directly to your spreadsheet.
- **Graphs**: Visualize habit completion rates.
- **Responsive**: Fully responsive design.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file in the root directory (based on `.env.example`).
   ```env
   VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=your_optional_api_key
   VITE_SPREADSHEET_ID=your_spreadsheet_id
   GOOGLE_CLIENT_SECRET=your_oauth_client_secret
   ```

   `GOOGLE_CLIENT_SECRET` is server-only: it is used by `server.js` for the OAuth code exchange / token refresh and to derive the key that encrypts widget refresh tokens at rest. It must **not** carry the `VITE_` prefix (Vite would expose it to the browser). The legacy `VITE_GOOGLE_CLIENT_SECRET` name is still read as a fallback with a deprecation warning; when renaming, keep the same value so existing encrypted data stays readable.

   **Private mode (optional):** set `ALLOWED_EMAILS=you@gmail.com,friend@gmail.com` to restrict sign-in, session refresh and widget API keys to those Google accounts only. Everyone else gets a 403 with a maintenance message. Leave it empty (or unset) for open access. Restart the server after changing it.
   
   *To get these credentials:*
   - Go to [Google Cloud Console](https://console.cloud.google.com).
   - Create a project.
   - Enable the **Google Sheets API**.
   - Create OAuth 2.0 Credentials (Web Application). Add `http://localhost:3000` to "Authorized JavaScript origins".
   - Create an API Key (optional, but good for initial loading).
   - Share your habit spreadsheet with the Google account you will sign in with (or make it writable if you want).

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Project Structure
- `src/services/HabitService.ts`: **Google Sheets Implementation**. Uses direct REST calls + Google Identity Services for Auth.
- `src/components`: UI Components.
- `src/types.ts`: Shared types.
