import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Login() {
  const { user, login, authLoading } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(identifier, password);
    setSubmitting(false);
    if (res.ok) navigate(location.state?.from || '/', { replace: true });
    else setError(res.error);
  };

  return (
    <div className="o-login-page">
      <div className="o-login-card">
        <div className="o-login-head">
          <h1>Hệ thống quản lý hóa đơn</h1>
          <p className="text-muted">Đăng nhập bằng tài khoản Admin hoặc Kế toán</p>
        </div>

        {error && <div className="o-notice o-notice-error" role="alert">{error}</div>}

        <form onSubmit={submit} className="o-stack">
          <div className="o-form-group">
            <label htmlFor="identifier" className="d-block text-muted">Tên đăng nhập hoặc email</label>
            <input id="identifier" className="w-100 p-1" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} />
          </div>
          <div className="o-form-group">
            <label htmlFor="password" className="d-block text-muted">Mật khẩu</label>
            <input id="password" type="password" className="w-100 p-1" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting || authLoading} className="o-btn o-btn-primary w-100">{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>

        <p className="text-muted o-login-note">
          Không có đăng ký tài khoản công khai. Tài khoản kế toán do Admin tạo.
        </p>

      </div>

    </div>
  );
}
