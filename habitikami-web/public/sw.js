// Habitikami Service Worker — Cache-first for static assets, network-first for API calls
const CACHE_NAME = 'habitikami-v3';

// ---------------------------------------------------------------------------
// Windows 11 PWA Widget Support
// ---------------------------------------------------------------------------

async function getWidgetData() {
  try {
    const response = await fetch('/widgets/data/habit-summary-data.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (_) {
    // offline – return fallback data
  }
  return {
    date: 'Today',
    completedCount: 0,
    totalCount: 0,
    currentStreak: 0,
    nextHabitName: 'Open the app to sync your habits.',
  };
}

async function updateWidget(widget) {
  try {
    console.log('[SW] Updating widget:', widget?.tag || 'habit-summary');
    const data = await getWidgetData();
    const templateResponse = await fetch('/widgets/habit-summary.json');
    if (!templateResponse.ok) throw new Error('Template not found');
    const template = await templateResponse.text();
    
    if (self.widgets && self.widgets.updateByTag) {
      await self.widgets.updateByTag('habit-summary', { template, data: JSON.stringify(data) });
      console.log('[SW] Widget updated successfully');
    }
  } catch (error) {
    console.error('[SW] Widget update failed:', error);
  }
}

// Widget installed – push initial data
self.addEventListener('widgetinstall', (event) => {
  console.log('[SW] widgetinstall event received');
  event.waitUntil(updateWidget(event.widget));
});

// Widget resumed (e.g. Widgets Board opened) – refresh data
self.addEventListener('widgetresume', (event) => {
  console.log('[SW] widgetresume event received');
  event.waitUntil(updateWidget(event.widget));
});

// Widget action clicked
self.addEventListener('widgetclick', (event) => {
  console.log('[SW] widgetclick event received:', event.action);
  if (event.action === 'open-app' || event.action === 'complete-next') {
    event.waitUntil(
      clients.openWindow('/').then(() => updateWidget(event.widget))
    );
  }
});

// Widget uninstalled – no cleanup needed
self.addEventListener('widgetuninstall', (_event) => {});

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/habitikami.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls and Google APIs: network only (don't cache)
  if (url.pathname.startsWith('/api/') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('accounts.google.com')) {
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cached but also update in background
        event.waitUntil(
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => { /* offline, ignore */ })
        );
        return cached;
      }

      // Not in cache: fetch from network and cache
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
