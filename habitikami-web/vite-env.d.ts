/// <reference types="vite/client" />
/// <reference types="gapi.client.sheets-v4" />

interface ImportMetaEnv {
    readonly VITE_GOOGLE_CLIENT_ID: string
    readonly VITE_GOOGLE_API_KEY: string
    readonly VITE_SPREADSHEET_ID: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
