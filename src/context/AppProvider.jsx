import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as mockApi from '../backend/api';
import { AuthError, BusinessError } from '../backend/rules';
import { loadDb, saveDb, readStoredDb, loadToken, saveToken, STORAGE_KEYS } from '../backend/storage';
import { requestApi } from '../backend/http';
import { AppContext } from './AppContext';

export function AppProvider({ children }) {
  const [db, setDb] = useState(loadDb);
  const [token, setToken] = useState(loadToken);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [toast, setToast] = useState(null);
  const dbRef = useRef(db);
  const tokenRef = useRef(token);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToast({ message, type, id });
    setTimeout(() => setToast(t => (t && t.id === id ? null : t)), 4000);
  }, []);
  const commitToken = next => { tokenRef.current = next; setToken(next); saveToken(next); };
  const commitDb = next => { dbRef.current = next; setDb(next); saveDb(next); };

  useEffect(() => {
    let cancelled = false;
    if (!token) { setUser(null); setAuthLoading(false); return undefined; }
    setAuthLoading(true);
    requestApi('/auth/me', { token }).then(current => {
      if (!cancelled) setUser(current);
    }).catch(error => {
      if (!cancelled) { commitToken(null); setUser(null); showToast(error.message, 'warning'); }
    }).finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, [token, showToast]);

  useEffect(() => {
    const onStorage = event => {
      if (event.key === STORAGE_KEYS.DB_KEY) {
        const fresh = readStoredDb();
        if (fresh) { dbRef.current = fresh; setDb(fresh); }
      }
      if (event.key === STORAGE_KEYS.TOKEN_KEY) { tokenRef.current = event.newValue; setToken(event.newValue); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const request = async (path, options = {}) => {
    try { return await requestApi(path, { ...options, token: tokenRef.current }); }
    catch (error) {
      if (error.status === 401) { commitToken(null); setUser(null); }
      throw error;
    }
  };
  const login = async (identifier, password) => {
    try {
      const result = await requestApi('/auth/login', { method: 'POST', body: { identifier, password } });
      setUser(result.user); commitToken(result.token);
      return { ok: true, user: result.user };
    } catch (error) { return { ok: false, error: error.message }; }
  };
  const logout = () => {
    const oldToken = tokenRef.current;
    commitToken(null); setUser(null);
    if (oldToken) requestApi('/auth/logout', { token: oldToken, method: 'POST' }).catch(() => {});
    showToast('Đã đăng xuất.');
  };
  const changePassword = async body => {
    const result = await request('/auth/change-password', { method: 'POST', body });
    setUser(result.user); commitToken(result.token);
  };

  // Các trang chưa chuyển đổi vẫn chạy mock cục bộ, không dùng token SQL Server.
  const call = useCallback((fn, args = [], successMsg) => {
    if (!user) return { ok: false, error: 'Vui lòng đăng nhập.' };
    const cur = readStoredDb() || dbRef.current;
    const mockUser = { ...user, tokenVersion: 1 };
    const mockDb = { ...cur, users: [...cur.users.filter(u => u.id !== user.id), mockUser] };
    try {
      const { db: next, result } = fn(mockDb, mockApi.issueToken(mockUser), ...args);
      commitDb({ ...next, users: cur.users });
      if (successMsg) showToast(typeof successMsg === 'function' ? successMsg(result) : successMsg);
      return { ok: true, ...result };
    } catch (error) {
      if (error instanceof AuthError || error instanceof BusinessError) {
        showToast(error.message, 'warning');
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }, [user, showToast]);

  const value = {
    db, user, authLoading, isAdmin: user?.role === 'admin', isAccountant: user?.role === 'accountant',
    call, login, logout, request, changePassword, showToast,
    partnerById: id => db.partners.find(p => p.id === Number(id)),
    productById: id => db.products.find(p => p.id === Number(id)),
    taxById: id => db.taxes.find(t => t.id === Number(id)),
    userById: id => (user?.id === Number(id) ? user : db.users.find(u => u.id === Number(id))),
    accountName: code => db.accounts.find(a => a.code === code)?.name || ''
  };
  return <AppContext.Provider value={value}>
    {children}
    {toast && <div role="status" className={`o-toast ${toast.type === 'warning' ? 'warning' : 'success'}`}>{toast.message}</div>}
  </AppContext.Provider>;
}
