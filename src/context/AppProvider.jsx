import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../backend/api';
import { AuthError, BusinessError } from '../backend/rules';
import { loadDb, saveDb, readStoredDb, resetDb, loadToken, saveToken, STORAGE_KEYS } from '../backend/storage';
import { AppContext } from './AppContext';

export function AppProvider({ children }) {
  const [db, setDb] = useState(loadDb);
  const [token, setToken] = useState(loadToken);
  const [toast, setToast] = useState(null);
  const dbRef = useRef(db);
  const tokenRef = useRef(token);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToast({ message, type, id });
    setTimeout(() => setToast(t => (t && t.id === id ? null : t)), 4000);
  }, []);

  const commitDb = (next) => { dbRef.current = next; setDb(next); saveDb(next); };
  const commitToken = (next) => { tokenRef.current = next; setToken(next); saveToken(next); };

  // Đồng bộ khi dữ liệu hoặc phiên đăng nhập thay đổi ở tab khác
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEYS.DB_KEY) {
        const fresh = readStoredDb();
        if (fresh) { dbRef.current = fresh; setDb(fresh); }
      }
      if (e.key === STORAGE_KEYS.TOKEN_KEY) { tokenRef.current = e.newValue; setToken(e.newValue); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Người dùng hiện tại: token phải còn hợp lệ (AUTH-08)
  const session = useMemo(() => {
    if (!token) return { user: null, error: null };
    try { return { user: api.verifyToken(db, token), error: null }; } catch (e) { return { user: null, error: e.message }; }
  }, [db, token]);

  useEffect(() => {
    if (token && !session.user) {
      commitToken(null);
      if (session.error) showToast(session.error, 'warning');
    }
  }, [token, session.user, session.error]);

  /**
   * Gọi một thao tác nghiệp vụ. Đọc bản dữ liệu mới nhất (kể cả từ tab khác), chạy thao tác,
   * chỉ ghi khi thành công. Lỗi thì không đổi gì và báo cho người dùng.
   */
  const call = useCallback((fn, args = [], successMsg) => {
    const cur = readStoredDb() || dbRef.current;
    try {
      const { db: next, result } = fn(cur, tokenRef.current, ...args);
      commitDb(next);
      if (result && result.token) commitToken(result.token);
      if (successMsg) showToast(typeof successMsg === 'function' ? successMsg(result) : successMsg);
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof AuthError) {
        commitToken(null);
        showToast(e.message, 'warning');
        return { ok: false, error: e.message };
      }
      if (e instanceof BusinessError) {
        showToast(e.message, 'warning');
        return { ok: false, error: e.message };
      }
      throw e;
    }
  }, [showToast]);

  const login = (identifier, password) => {
    try {
      const { result } = api.login(readStoredDb() || dbRef.current, identifier, password);
      commitToken(result.token);
      return { ok: true, user: result.user };
    } catch (e) {
      if (e instanceof BusinessError) return { ok: false, error: e.message };
      throw e;
    }
  };

  const logout = () => { commitToken(null); showToast('Đã đăng xuất.'); };

  const resetDemo = () => {
    const fresh = resetDb();
    dbRef.current = fresh;
    setDb(fresh);
    commitToken(null);
    showToast('Đã khôi phục dữ liệu mẫu.');
  };

  const user = session.user;
  const value = {
    db,
    user,
    isAdmin: user?.role === 'admin',
    isAccountant: user?.role === 'accountant',
    call,
    login,
    logout,
    resetDemo,
    showToast,
    partnerById: (id) => db.partners.find(p => p.id === Number(id)),
    productById: (id) => db.products.find(p => p.id === Number(id)),
    taxById: (id) => db.taxes.find(t => t.id === Number(id)),
    userById: (id) => db.users.find(u => u.id === Number(id)),
    accountName: (code) => db.accounts.find(a => a.code === code)?.name || ''
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && (
        <div role="status" className={`o-toast ${toast.type === 'warning' ? 'warning' : 'success'}`}>
          {toast.message}
        </div>
      )}
    </AppContext.Provider>
  );
}
