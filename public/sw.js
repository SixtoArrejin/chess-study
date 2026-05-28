const DB_NAME = 'ChessStudyDB';
const STORE_NAME = 'pdfStore';
const DB_VERSION = 1;

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

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/pdf-viewer/')) {
    e.respondWith(
      getPdfBlob().then((blob) => {
        if (blob) {
          // Generate a stable ETag and Cache headers based on size and name
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
  }
});
