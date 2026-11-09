import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loadToken, saveToken, STORAGE_KEYS } from '../backend/storage';
import { requestApi, requestPdfApi } from '../backend/http';
import { AppContext } from './AppContext';

export function AppProvider({ children }) {
  const [token, setToken] = useState(loadToken);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [toast, setToast] = useState(null);
  const tokenRef = useRef(token);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToast({ message, type, id });
    setTimeout(() => setToast(t => (t && t.id === id ? null : t)), 4000);
  }, []);
  const commitToken = next => { tokenRef.current = next; setToken(next); saveToken(next); };

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
  const downloadInvoicePdf = async (id, entryType = 'out_invoice') => {
    let pdf;
    try {
      pdf = await requestPdfApi(`/invoices/${id}/pdf`, {
        token: tokenRef.current,
        fallbackFilename: `${entryType === 'in_invoice' ? 'hoa-don-mua' : 'hoa-don-ban'}-${id}.pdf`
      });
    } catch (error) {
      if (error.status === 401) { commitToken(null); setUser(null); }
      throw error;
    }
    const url = URL.createObjectURL(pdf.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = pdf.filename;
    document.body.appendChild(link);
    try { link.click(); } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
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

  const value = {
    user, authLoading, isAdmin: user?.role === 'admin', isAccountant: user?.role === 'accountant',
    login, logout, request, downloadInvoicePdf, changePassword, showToast
  };
  return <AppContext.Provider value={value}>
    {children}
    {toast && <div role="status" className={`o-toast ${toast.type === 'warning' ? 'warning' : 'success'}`}>{toast.message}</div>}
  </AppContext.Provider>;
}
