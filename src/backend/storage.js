// Lưu token phiên đăng nhập trên trình duyệt.
const TOKEN_KEY = 'invoicing_api_token';

const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* bỏ qua */ } };
const safeRemove = (key) => { try { localStorage.removeItem(key); } catch { /* bỏ qua */ } };

export const loadToken = () => safeGet(TOKEN_KEY);
export const saveToken = (token) => (token ? safeSet(TOKEN_KEY, token) : safeRemove(TOKEN_KEY));

export const STORAGE_KEYS = { TOKEN_KEY };
