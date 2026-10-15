import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ConfirmModal } from '../components/common/Modal';

// AUTH-01: chỉ Admin và Kế toán đăng nhập. AUTH-02: không có đăng ký công khai.
const DEMO_ACCOUNTS = [
  { label: 'Admin', userName: 'admin', password: 'admin123' },
  { label: 'Kế toán', userName: 'ketoan', password: 'ketoan123' },
  { label: 'Kế toán 2', userName: 'ketoan2', password: 'ketoan123' }
];

export default function Login() {
  const { user, login, resetDemo } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const res = login(identifier, password);
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
          <button type="submit" className="o-btn o-btn-primary w-100">Đăng nhập</button>
        </form>

        <p className="text-muted o-login-note">
          Không có đăng ký tài khoản công khai. Tài khoản kế toán do Admin tạo.
        </p>

        <div className="o-login-demo">
          <div className="o-login-demo-title">Tài khoản dùng thử</div>
          <table className="o-table w-100">
            <tbody>
              {DEMO_ACCOUNTS.map(a => (
                <tr key={a.userName}>
                  <td>{a.label}</td>
                  <td><code>{a.userName}</code></td>
                  <td><code>{a.password}</code></td>
                  <td className="text-right">
                    <button type="button" className="o-btn o-btn-sm o-btn-secondary"
                      onClick={() => { setIdentifier(a.userName); setPassword(a.password); setError(''); }}>
                      Click me!
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="o-link-btn" onClick={() => setConfirmReset(true)}>Khôi phục dữ liệu mẫu</button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmReset}
        title="Khôi phục dữ liệu mẫu?"
        message="Toàn bộ dữ liệu trên trình duyệt này sẽ được thay bằng dữ liệu mẫu ban đầu, kể cả mật khẩu và tài khoản đã tạo."
        confirmLabel="Khôi phục"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { resetDemo(); setConfirmReset(false); }}
      />
    </div>
  );
}
