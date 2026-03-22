# Habitikami Export Server - Setup Guide

This project now includes a simple Node.js backend to serve the frontend application and provide a JSON export API for automation tools like n8n.

## 1. Create a Google Service Account

To allow the server to read your Google Sheet without user interaction (server-side), you need a Service Account.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project.
3.  Go to **IAM & Admin** > **Service Accounts**.
4.  Click **Create Service Account**.
5.  Name it (e.g., `habitikami-export`).
6.  Grant it the **Viewer** role (optional, but good practice).
7.  Click **Done**.
8.  Click on the newly created service account email.
9.  Go to the **Keys** tab.
10. Click **Add Key** > **Create new key** > **JSON**.
11. A JSON file will download. **Keep this safe!**

## 2. Share Your Sheet

1.  Open your Habitikami Google Sheet.
2.  Click **Share**.
3.  Copy the **client_email** from the JSON key file you just downloaded.
4.  Paste it into the Share dialog and give it **Viewer** or **Editor** access.
    *   *Viewer* is enough for export.
5.  Uncheck "Notify people" to avoid emails.
6.  Click **Share**.

## 3. Configure Environment Variables

You need to update your `.env` file (or deployment environment variables) with the following:

```env
# Existing
VITE_GOOGLE_CLIENT_ID=...
VITE_SPREADSHEET_ID=...

# NEW: Service Account Credentials (from the JSON key file)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# NEW: API Security
EXPORT_API_TOKEN=your-secret-token-for-n8n
```

> **Note on Private Key:** If putting this in a `.env` file, ensure the newlines are correctly formatted. You might need to wrap it in quotes. If pasting into a cloud provider (like Portainer/Render/Railway), they usually handle the newlines automatically.

## 4. Run the Server

### Local Development
To run the server locally:
```bash
npm install
npm run build
npm start
```

### Docker
The `Dockerfile` has been updated to run the Node.js server.
```bash
docker build -t habitikami .
docker run -p 80:80 --env-file .env habitikami
```

## 5. Using the Export API

**Endpoint:** `GET /api/export`

**Authentication:** You must provide the `EXPORT_API_TOKEN` either as a header or a query parameter.

**Curl Example:**
```bash
curl -H "x-api-token: your-secret-token-for-n8n" http://localhost/api/export
```

**Query Param Example:**
```bash
# Basic Auth
http://localhost/api/export?token=your-secret-token-for-n8n

# Date Filtering (YYYY-MM-DD)
http://localhost/api/export?token=...&oldest=2024-01-01&newest=2024-01-31
```

**Response Format:**
```json
{
  "timestamp": "2023-10-27T10:00:00.000Z",
  "weekdays": [...],
  "weekend": [...],
  "counters": [...],
  "notes": [...]
}
```
