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
   ```
   
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
