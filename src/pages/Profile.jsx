import React, { useState } from 'react';
import { useApp, api } from '../context/AppContext';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';

// AUTH-07: Admin và Kế toán đổi mật khẩu của chính mình. AUTH-08: token cũ mất hiệu lực.
export default function Profile() {
  const { user, call } = useApp();
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) { setError('Mật khẩu nhập lại không khớp.'); return; }
    const res = call(api.changeOwnPassword, [{ oldPassword: form.oldPassword, newPassword: form.newPassword }],
      'Đã đổi mật khẩu. Các phiên đăng nhập cũ đã hết hiệu lực.');
    if (res.ok) setForm({ oldPassword: '', newPassword: '', confirm: '' });
    else setError(res.error);
  };

  return (
    <div className="o-page">
      <PageHeader breadcrumb="Tài khoản" title="Đổi mật khẩu" />
      <div className="o-grid-2">
        <div className="o-card">
          <h3 className="o-card-title">Thông tin tài khoản</h3>
          <dl className="o-dl">
            <dt>Họ tên</dt><dd>{user.fullName}</dd>
            <dt>Tên đăng nhập</dt><dd>{user.userName}</dd>
            <dt>Email</dt><dd>{user.email || '—'}</dd>
            <dt>Vai trò</dt><dd><StatusBadge status={user.role} /></dd>
          </dl>
        </div>
        <form className="o-card o-stack" onSubmit={submit}>
          <h3 className="o-card-title">Đổi mật khẩu</h3>
          {error && <div className="o-notice o-notice-error" role="alert">{error}</div>}
          <div className="o-form-group">
            <label htmlFor="oldPassword" className="d-block text-muted">Mật khẩu hiện tại</label>
            <input id="oldPassword" type="password" className="w-100 p-1" autoComplete="current-password" value={form.oldPassword} onChange={e => setForm({ ...form, oldPassword: e.target.value })} />
          </div>
          <div className="o-form-group">
            <label htmlFor="newPassword" className="d-block text-muted">Mật khẩu mới (ít nhất 6 ký tự)</label>
            <input id="newPassword" type="password" className="w-100 p-1" autoComplete="new-password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
          </div>
          <div className="o-form-group">
            <label htmlFor="confirm" className="d-block text-muted">Nhập lại mật khẩu mới</label>
            <input id="confirm" type="password" className="w-100 p-1" autoComplete="new-password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} />
          </div>
          <div><button type="submit" className="o-btn o-btn-primary">Đổi mật khẩu</button></div>
        </form>
      </div>
    </div>
  );
}
