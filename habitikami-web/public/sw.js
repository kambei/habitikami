// Habitikami Service Worker — Cache-first for static assets, network-first for API calls
const CACHE_NAME = 'habitikami-v6';
const WIDGET_CACHE = 'widget-data';

// Every Windows widget shares the same data payload (see hooks/useWidgetSync.ts)
const WIDGETS = [
  { tag: 'habit-summary', template: '/widgets/habit-summary.json' },
  { tag: 'counters-today', template: '/widgets/counters-today.json' },
  { tag: 'streak', template: '/widgets/streak.json' },
];

// ---------------------------------------------------------------------------
// Windows 11 PWA Widget Support
// ---------------------------------------------------------------------------

async function getWidgetData() {
  try {
    const cache = await caches.open(WIDGET_CACHE);
    const response = await cache.match('/widget-summary');
    if (response) {
      return await response.json();
    }
  } catch (e) {
    console.warn('[SW] Failed to get cached widget data', e);
  }

  // Nothing synced yet: localised placeholder until the app is opened once
  const it = (self.navigator && self.navigator.language || '').toLowerCase().startsWith('it');
  return {
    date: it ? 'Oggi' : 'Today',
    completedCount: 0,
    totalCount: 0,
    currentStreak: 0,
    streakHabit: '',
    nextHabitName: it ? 'Apri Habitikami per sincronizzare' : 'Open Habitikami to sync',
    counters: [],
    updatedAt: '--:--',
    labels: it
      ? { completed: 'Completate', streak: '🔥 Streak', nextUp: 'Prossima', days: 'giorni', counters: 'Contatori di oggi', updated: 'Aggiornato alle', noCounters: 'Nessun contatore', completeNext: '✅ Completa la prossima', skipNext: '⏭️ Salta', openApp: "🏠 Apri l'app" }
      : { completed: 'Completed', streak: '🔥 Streak', nextUp: 'Next up', days: 'days', counters: "Today's counters", updated: 'Updated at', noCounters: 'No counters yet', completeNext: '✅ Complete next', skipNext: '⏭️ Skip', openApp: '🏠 Open app' },
  };
}

// Refresh one widget (by its definition) or all of them with the cached payload
async function updateWidget(widget) {
  if (!self.widgets || !self.widgets.updateByTag) return;
  const targets = widget && widget.definition && widget.definition.tag
    ? WIDGETS.filter((w) => w.tag === widget.definition.tag)
    : WIDGETS;
  const data = await getWidgetData();
  for (const w of targets) {
    try {
      const templateResponse = await fetch(w.template);
      if (!templateResponse.ok) throw new Error('Template not found: ' + w.template);
      const template = await templateResponse.text();
      await self.widgets.updateByTag(w.tag, { template, data: JSON.stringify(data) });
    } catch (error) {
      console.error('[SW] Widget update failed:', w.tag, error);
    }
  }
}

// PWA background update listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'WIDGET_UPDATE') {
    event.waitUntil((async () => {
      const data = event.data.data;
      console.log('[SW] Received widget update payload:', data);
      
      try {
        const cache = await caches.open(WIDGET_CACHE);
        await cache.put('/widget-summary', new Response(JSON.stringify(data)));
        
        // Update widget immediately
        await updateWidget();
      } catch (e) {
        console.error('[SW] Failed to persist widget data:', e);
      }
    })());
  }
});

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
  // Complete/skip land on the Focus view, which performs the action (App.tsx)
  const urls = {
    'complete-next': '/?action=complete-next#Focus',
    'skip-next': '/?action=skip-next#Focus',
    'open-counters': '/#SmokeTemptation',
    'open-app': '/',
  };
  const url = urls[event.action];
  if (url) {
    event.waitUntil(
      clients.openWindow(url).then(() => updateWidget(event.widget))
    );
  }
});

// Widget uninstalled – no cleanup needed
self.addEventListener('widgetuninstall', (_event) => {});

// ---------------------------------------------------------------------------
// Web push reminders (server push.js): payload { title, body, tag, url }
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Habitikami', body: event.data && event.data.text() }; }
  const title = data.title || 'Habitikami';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/habitikami.png',
    badge: '/habitikami.png',
    tag: data.tag || 'habitikami',
    renotify: true,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if ('focus' in client) {
        client.navigate(url).catch(() => {});
        return client.focus();
      }
    }
    return clients.openWindow(url);
  }));
});

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
          .filter((name) => name !== CACHE_NAME && name !== WIDGET_CACHE)
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

  // Pages: network-first, so a deploy is picked up right away and the page
  // never asks for chunks that no longer exist; cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
        }
        return response;
      }).catch(() => caches.match('/index.html'))
    );
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
