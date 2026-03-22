import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from './i18n'

const PrivacyPolicy = React.lazy(() => import('./components/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })))
const TermsOfService = React.lazy(() => import('./components/TermsOfService').then(module => ({ default: module.TermsOfService })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

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
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div className="h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
          {path === '/privacy' ? (
            <PrivacyPolicy />
          ) : path === '/terms' ? (
            <TermsOfService />
          ) : (
            <App />
          )}
        </Suspense>
      </QueryClientProvider>
    </LanguageProvider>
  </React.StrictMode>,
)
