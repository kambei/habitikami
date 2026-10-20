import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function getAndroidVersion(): string {
  try {
    const gradle = readFileSync(resolve(__dirname, '../habitikami-android-and-widgets/app/build.gradle.kts'), 'utf-8');
    const match = gradle.match(/versionName\s*=\s*"([^"]+)"/);
    return match?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function getWebVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION_WEB__: JSON.stringify(getWebVersion()),
    __APP_VERSION_ANDROID__: JSON.stringify(getAndroidVersion()),
  },
  server: {
    port: 3000,
  },
  build: {
    // Vite 8 bundles with rolldown: manualChunks is replaced by advancedChunks groups.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'charts', test: /[\\/]node_modules[\\/]recharts[\\/]/ },
            { name: 'motion', test: /[\\/]node_modules[\\/]framer-motion[\\/]/ },
            { name: 'lucide', test: /[\\/]node_modules[\\/]lucide-react[\\/]/ },
            { name: 'query', test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/ },
          ],
        },
      },
    },
  },
})
