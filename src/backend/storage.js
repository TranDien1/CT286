// Lưu dữ liệu trên trình duyệt (localStorage). Nếu trình duyệt chặn thì vẫn chạy được trong bộ nhớ.
import { buildSeedDb } from './seed';

const DB_KEY = 'invoicing_db_v2';
const TOKEN_KEY = 'invoicing_api_token';

const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* bỏ qua */ } };
const safeRemove = (key) => { try { localStorage.removeItem(key); } catch { /* bỏ qua */ } };

export const loadDb = () => {
  const raw = safeGet(DB_KEY);
  if (raw) {
    try {
      const db = JSON.parse(raw);
      if (db && db.version === 2) return db;
    } catch { /* dữ liệu hỏng thì tạo lại */ }
  }
  const db = buildSeedDb();
  saveDb(db);
  return db;
};

export const readStoredDb = () => {
  const raw = safeGet(DB_KEY);
  if (!raw) return null;
  try { const db = JSON.parse(raw); return db && db.version === 2 ? db : null; } catch { return null; }
};

export const saveDb = (db) => safeSet(DB_KEY, JSON.stringify(db));
export const resetDb = () => { const db = buildSeedDb(); saveDb(db); return db; };

export const loadToken = () => safeGet(TOKEN_KEY);
export const saveToken = (token) => (token ? safeSet(TOKEN_KEY, token) : safeRemove(TOKEN_KEY));

export const STORAGE_KEYS = { DB_KEY, TOKEN_KEY };
