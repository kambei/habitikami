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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('lucide-react')) return 'lucide';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
          }
        }
      }
    }
  }
})
