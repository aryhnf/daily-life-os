const DB_NAME = 'daily-os-db';
const DB_VERSION = 1;
const STORE = 'kv';
const STATE_KEY = 'state';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(STATE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB unavailable, using localStorage fallback', err);
    const raw = localStorage.getItem('daily-os-state');
    return raw ? JSON.parse(raw) : null;
  }
}

export async function saveState(state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, using localStorage fallback', err);
    localStorage.setItem('daily-os-state', JSON.stringify(snapshot));
  }
}

export async function clearState() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    localStorage.removeItem('daily-os-state');
  }
}
