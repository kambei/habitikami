import { lazyImport } from './utils/lazyImport'
import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { LanguageProvider } from './i18n'
import { redirectPairingLink } from './utils/widgetPairing'
import { applyTheme, watchSystemTheme } from './utils/theme'

const PrivacyPolicy = React.lazy(lazyImport(() => import('./components/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy }))))
const TermsOfService = React.lazy(lazyImport(() => import('./components/TermsOfService').then(module => ({ default: module.TermsOfService }))))

const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // a week of offline reads

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: CACHE_MAX_AGE,    // keep for the persisted cache
      refetchOnWindowFocus: false,
    },
    // Mutations run even offline: the hooks queue them (utils/offlineQueue.ts)
    mutations: { networkMode: 'always' },
  },
})

// Successful reads survive a reload and are shown while offline (issue #16)
const PERSISTED_QUERIES = new Set(['sheetData', 'habitMeta', 'habitColors', 'habitNotes', 'mood', 'counters', 'widgetCounters', 'trainingLog'])
const persister = createSyncStoragePersister({ storage: typeof window !== 'undefined' ? window.localStorage : null, key: 'habitikami_query_cache', throttleTime: 1000 })
const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: __APP_VERSION_WEB__,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) => q.state.status === 'success' && PERSISTED_QUERIES.has(String(q.queryKey[0])),
  },
}

// A pairing QR opens /widget-config#…: hand it over to the Android app before rendering
redirectPairingLink();
applyTheme();
watchSystemTheme();

const path = window.location.pathname;

// Dynamic SEO: set title & meta description per page
if (path === '/privacy') {
  document.title = 'Privacy Policy – Habitikami';
  document.querySelector('meta[name="description"]')?.setAttribute('content',
    'Habitikami Privacy Policy. Learn how we handle your data. | Informativa sulla privacy di Habitikami. Scopri come gestiamo i tuoi dati.'
  );
} else if (path === '/terms') {
  document.title = 'Terms of Service – Habitikami';
  document.querySelector('meta[name="description"]')?.setAttribute('content',
    'Habitikami Terms of Service. Read the terms and conditions for using the app. | Termini di servizio di Habitikami. Leggi le condizioni d\'utilizzo dell\'app.'
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <Suspense fallback={<div className="h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
          {path === '/privacy' ? (
            <PrivacyPolicy />
          ) : path === '/terms' ? (
            <TermsOfService />
          ) : (
            <App />
          )}
        </Suspense>
      </PersistQueryClientProvider>
    </LanguageProvider>
  </React.StrictMode>,
)
