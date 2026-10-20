import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Modal, { ConfirmModal } from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';

// AUTH-02/03/08/09: Admin tạo, xem, khóa/mở khóa, đặt lại mật khẩu kế toán. Không xóa tài khoản.
export default function Users() {
  const { request, user: me, showToast } = useApp();
  const [users, setUsers] = useState([]);
  const [creating, setCreating] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [toggling, setToggling] = useState(null);

  const refresh = async () => { setUsers(await request('/users')); };
  useEffect(() => { refresh().catch(error => showToast(error.message, 'warning')); }, []);

  const create = async () => {
    if (creating.password !== creating.confirm) { showToast('Mật khẩu nhập lại không khớp.', 'warning'); return; }
    try {
      await request('/users/accountants', { method: 'POST', body: creating });
      await refresh(); setCreating(null); showToast('Đã tạo tài khoản kế toán.');
    } catch (error) { showToast(error.message, 'warning'); }
  };

  const reset = async () => {
    try {
      await request(`/users/${resetting.user.id}/reset-password`, { method: 'POST', body: { newPassword: resetting.password } });
      showToast(`Đã đặt lại mật khẩu cho ${resetting.user.userName}.`); setResetting(null);
    } catch (error) { showToast(error.message, 'warning'); }
  };

  const toggle = async () => {
    const u = toggling;
    try {
      await request(`/users/${u.id}/active`, { method: 'PATCH', body: { active: !u.active } });
      await refresh(); setToggling(null); showToast(u.active ? `Đã khóa ${u.userName}.` : `Đã mở khóa ${u.userName}.`);
    } catch (error) { showToast(error.message, 'warning'); }
  };

  const columns = [
    { key: 'userName', label: 'Tên đăng nhập', sortable: true, render: r => <strong>{r.userName}</strong> },
    { key: 'fullName', label: 'Họ tên', sortable: true },
    { key: 'email', label: 'Email', render: r => r.email || '—' },
    { key: 'role', label: 'Vai trò', sortable: true, render: r => <StatusBadge status={r.role} /> },
    { key: 'active', label: 'Trạng thái', sortable: true, render: r => <StatusBadge status={r.active ? 'active' : 'locked'} /> },
    {
      key: 'actions', label: '', className: 'text-right o-nowrap',
      render: r => (r.role === 'accountant' && r.id !== me.id ? (
        <div className="o-row-actions">
          <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setResetting({ user: r, password: '' })}>Đặt lại mật khẩu</button>
          <button type="button" className={`o-btn o-btn-sm ${r.active ? 'o-btn-danger' : 'o-btn-secondary'}`} onClick={() => setToggling(r)}>
            {r.active ? 'Khóa' : 'Mở khóa'}
          </button>
        </div>
      ) : <span className="text-muted o-meta">{r.id === me.id ? 'Tài khoản của bạn' : ''}</span>)
    }
  ];

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb="Quản trị"
        title="Tài khoản người dùng"
        actions={<button type="button" className="o-btn o-btn-primary" onClick={() => setCreating({ userName: '', fullName: '', email: '', password: '', confirm: '' })}>Tạo tài khoản kế toán</button>}
      />
      <DataTable columns={columns} data={users} />
      <p className="text-muted o-report-note">Không có đăng ký công khai và không xóa tài khoản; tài khoản không dùng nữa thì khóa lại. Khóa tài khoản hoặc đặt lại mật khẩu sẽ làm phiên đăng nhập cũ hết hiệu lực.</p>

      <Modal
        isOpen={!!creating}
        onClose={() => setCreating(null)}
        title="Tạo tài khoản kế toán"
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => setCreating(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" onClick={create}>Tạo tài khoản</button>
          </>
        )}
      >
        {creating && (
          <div className="o-stack">
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="uName">Tên đăng nhập *</label>
                <input id="uName" className="w-100 p-1" autoComplete="off" value={creating.userName} onChange={e => setCreating({ ...creating, userName: e.target.value })} />
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="uFull">Họ tên *</label>
                <input id="uFull" className="w-100 p-1" value={creating.fullName} onChange={e => setCreating({ ...creating, fullName: e.target.value })} />
              </div>
            </div>
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="uEmail">Email</label>
              <input id="uEmail" type="email" className="w-100 p-1" value={creating.email} onChange={e => setCreating({ ...creating, email: e.target.value })} />
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="uPw">Mật khẩu (ít nhất 6 ký tự) *</label>
                <input id="uPw" type="password" autoComplete="new-password" className="w-100 p-1" value={creating.password} onChange={e => setCreating({ ...creating, password: e.target.value })} />
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="uPw2">Nhập lại mật khẩu *</label>
                <input id="uPw2" type="password" autoComplete="new-password" className="w-100 p-1" value={creating.confirm} onChange={e => setCreating({ ...creating, confirm: e.target.value })} />
              </div>
            </div>
            <p className="text-muted o-meta" style={{ margin: 0 }}>Tài khoản mới có vai trò Kế toán.</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!resetting}
        onClose={() => setResetting(null)}
        title={`Đặt lại mật khẩu: ${resetting?.user.userName || ''}`}
        size="sm"
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => setResetting(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" onClick={reset}>Đặt lại</button>
          </>
        )}
      >
        {resetting && (
          <div className="o-form-group">
            <label className="d-block text-muted" htmlFor="rPw">Mật khẩu mới (ít nhất 6 ký tự)</label>
            <input id="rPw" type="password" autoComplete="new-password" className="w-100 p-1" value={resetting.password} onChange={e => setResetting({ ...resetting, password: e.target.value })} />
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!toggling}
        title={toggling?.active ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
        message={toggling?.active
          ? `${toggling?.fullName} sẽ không đăng nhập được và phiên đăng nhập hiện tại bị hủy.`
          : `${toggling?.fullName} sẽ đăng nhập lại được bằng mật khẩu hiện tại.`}
        confirmLabel={toggling?.active ? 'Khóa' : 'Mở khóa'}
        danger={toggling?.active}
        onClose={() => setToggling(null)}
        onConfirm={toggle}
      />
    </div>
  );
}
