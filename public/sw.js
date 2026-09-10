const CACHE_NAME = 'chess-study-shell-v1';
const BOOKS_CACHE = 'chess-study-books-v1';

const DB_NAME = 'ChessStudyDB';
const STORE_NAME = 'pdfStore';
const DB_VERSION = 1;

// Recursos esenciales a precachear en install para disponibilidad offline inmediata
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
  '/icons.svg',
  '/sounds/move.mp3',
  '/sounds/capture.mp3',
  '/pdfjs/web/viewer.html',
  '/pdfjs/web/viewer.css',
  '/pdfjs/web/viewer.mjs',
  '/pdfjs/build/pdf.mjs',
  '/pdfjs/build/pdf.worker.mjs',
  '/pdfjs/web/locale/locale.json'
];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getPdfBlob() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('currentBook');
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Helper resiliente de precaché (no falla todo el lote si un archivo individual falta)
async function precacheSafe(cache, urls) {
  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (err) {
        console.warn(`[SW] Fallo al precachear ${url}:`, err);
      }
    })
  );
}

// Extrae y precachea dinámicamente los bundles con hash generados por Vite en index.html
async function precacheDynamicBundles(cache) {
  try {
    const response = await fetch('/index.html');
    if (!response.ok) return;
    const html = await response.text();
    const assetUrls = [];
    const regex = /(?:src|href)=["']([^"']+\.(?:js|css|png|svg|ico))["']/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const assetUrl = match[1];
      if (assetUrl.startsWith('/') || assetUrl.startsWith('./')) {
        assetUrls.push(assetUrl);
      }
    }
    if (assetUrls.length > 0) {
      await precacheSafe(cache, [...new Set(assetUrls)]);
    }
  } catch (err) {
    console.warn('[SW] No se pudieron extraer bundles dinámicos de index.html:', err);
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await precacheSafe(cache, PRECACHE_ASSETS);
      await precacheDynamicBundles(cache);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== BOOKS_CACHE) {
            console.log('[SW] Eliminando caché antiguo:', key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar peticiones GET y protocolos http/https
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. Compatibilidad con ruta virtual de IndexedDB
  if (url.pathname.startsWith('/pdf-viewer/')) {
    event.respondWith(
      getPdfBlob().then((blob) => {
        if (blob) {
          const etag = `W/"${blob.size}-${blob.name || 'pdf'}"`;
          return new Response(blob, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Length': blob.size,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'ETag': etag,
              'Last-Modified': 'Wed, 28 May 2026 12:00:00 GMT',
            },
          });
        }
        return new Response('PDF no encontrado en IndexedDB', { status: 404 });
      }).catch((err) => {
        return new Response('Error leyendo IndexedDB: ' + err.message, { status: 500 });
      })
    );
    return;
  }

  // 2. Libros clásicos (/books/*.pdf) - almacenamiento en caché bajo demanda
  if (url.pathname.startsWith('/books/')) {
    event.respondWith(
      (async () => {
        const booksCache = await caches.open(BOOKS_CACHE);
        const cached = await booksCache.match(request);
        if (cached) {
          return cached;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            booksCache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response('Libro clásico no disponible sin conexión a internet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      })()
    );
    return;
  }

  // 3. Peticiones de navegación (documentos HTML e iframe)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const isPdfViewerIframe = url.pathname.includes('/pdfjs/');

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            if (!isPdfViewerIframe) {
              cache.put('/index.html', networkResponse.clone());
            }
            return networkResponse;
          }
        } catch (err) {
          // Fallo de red: usar copia en caché
        }

        const cache = await caches.open(CACHE_NAME);
        if (isPdfViewerIframe) {
          const cachedViewer = await cache.match(request) || await cache.match('/pdfjs/web/viewer.html');
          if (cachedViewer) return cachedViewer;
          return new Response('Visor PDF no disponible sin conexión', { status: 503 });
        }

        const cachedApp = await cache.match(request) || await cache.match('/index.html') || await cache.match('/');
        if (cachedApp) return cachedApp;

        return new Response('Chess Study está desconectado y no se encontró copia en caché.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })()
    );
    return;
  }

  // 4. Recursos estáticos (Mismo origen o Google Fonts)
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isSameOrigin || isGoogleFont) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        // A) Bundles con hash de Vite (/assets/*): Cache-First inmutable
        if (url.pathname.startsWith('/assets/')) {
          if (cachedResponse) return cachedResponse;
          try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (err) {
            return new Response('Asset no encontrado en caché', { status: 404 });
          }
        }

        // B) Otros recursos (sonidos, pdfjs, iconos, fuentes): Stale-While-Revalidate
        if (cachedResponse) {
          // Revalidar en segundo plano si hay conexión
          fetch(request).then((freshResponse) => {
            if (freshResponse && (freshResponse.status === 200 || freshResponse.type === 'opaque')) {
              cache.put(request, freshResponse);
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Si no está en caché, traer de la red y guardar en caché
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response('Recurso no disponible sin conexión', { status: 503 });
        }
      })()
    );
  }
});
