import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';

// INV-11, PAY-06: tài khoản hạch toán lấy từ cấu hình, chỉ Admin được sửa tên và tài khoản mặc định.
export default function AccountingConfig() {
  const { request, showToast, isAdmin } = useApp();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [editingJournal, setEditingJournal] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const typeLabel = { sale: 'Bán hàng', purchase: 'Mua hàng', cash: 'Tiền mặt', general: 'Tổng hợp' };

  useEffect(() => {
    let cancelled = false;
    setError('');
    setConfig(null);
    request('/accounting-config').then(data => {
      if (!cancelled) setConfig(data);
    }).catch(err => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const compatibleAccounts = (config?.accounts || []).filter(account => {
    if (!editingJournal) return false;
    if (editingJournal.code === 'CSH') return account.code === '111' && account.accountType === 'cash';
    const expected = { sale: 'income', purchase: 'asset', cash: 'cash' }[editingJournal.type];
    return !expected || account.accountType === expected;
  });
  const save = async (path, body, close, message) => {
    if (pending.current) return;
    pending.current = true; setSaving(true);
    try {
      await request(path, { method: 'PUT', body });
      close(); showToast(message); setReloadKey(key => key + 1);
    } catch (err) { showToast(err.message, 'warning'); }
    finally { pending.current = false; setSaving(false); }
  };

  return (
    <div className="o-page">
      <PageHeader breadcrumb="Kế toán" title="Tài khoản và sổ nhật ký" />
      <p className="text-muted o-report-note">Mã và loại tài khoản/sổ được giữ cố định để bảo vệ quy tắc hạch toán. Hóa đơn lấy tài khoản hàng từ nhóm sản phẩm, thuế từ danh mục thuế; phiếu thu/chi dùng tài khoản mặc định của sổ CSH.</p>
      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReloadKey(key => key + 1)}>Thử lại</button></div>}
      {!config && !error && <p>Đang tải cấu hình từ SQL Server…</p>}
      {config && <>
      <div className="o-grid-2">
        <div className="o-card">
          <h3 className="o-card-title">Sổ nhật ký</h3>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Mã</th><th>Tên sổ</th><th>Loại</th><th>TK mặc định</th><th>TK công nợ</th>{isAdmin && <th aria-label="Thao tác" />}</tr></thead>
              <tbody>
                {config.journals.map(j => (
                  <tr key={j.id}>
                    <td><strong>{j.code}</strong></td>
                    <td>{j.name}</td>
                    <td>{typeLabel[j.type] || j.type}</td>
                    <td title={j.defaultAccount?.name || ''}>{j.defaultAccount?.code || '—'}</td>
                    <td title={j.counterpartAccount?.name || ''}>{j.counterpartAccount?.code || '—'}</td>
                    {isAdmin && <td><button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditingJournal({ ...j, defaultAccountId: j.defaultAccount?.id ?? '' })}>Sửa</button></td>}
                  </tr>
                ))}
                {config.journals.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5}>Chưa có sổ nhật ký.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="o-card">
          <h3 className="o-card-title">Hệ thống tài khoản</h3>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Số hiệu</th><th>Tên tài khoản</th><th>Nhóm</th>{isAdmin && <th aria-label="Thao tác" />}</tr></thead>
              <tbody>
                {config.accounts.map(a => <tr key={a.id}><td><strong>{a.code}</strong></td><td>{a.name}</td><td>{a.accountType}</td>
                  {isAdmin && <td><button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditingAccount({ ...a })}>Sửa</button></td>}
                </tr>)}
                {config.accounts.length === 0 && <tr><td colSpan={isAdmin ? 4 : 3}>Chưa có tài khoản.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-muted o-report-note">TK công nợ được suy ra để hiển thị: 131 cho sổ bán, 331 cho sổ mua; không phải cột trong sổ nhật ký.</p>
      <div className="o-card">
        <h3 className="o-card-title">Cách hạch toán</h3>
        <p className="text-muted o-report-note">Ví dụ theo cấu hình ban đầu; tài khoản hàng hóa thực tế có thể theo cấu hình nhóm sản phẩm.</p>
        <div className="o-table-wrapper">
          <table className="o-table w-100">
            <thead><tr><th>Chứng từ</th><th>Hàng hóa</th><th>Thuế</th><th>Công nợ / Tiền</th></tr></thead>
            <tbody>
              <tr><td>Hóa đơn bán (INV)</td><td>Có 511</td><td>Có 3331</td><td>Nợ 131</td></tr>
              <tr><td>Hóa đơn mua (BILL)</td><td>Nợ 156</td><td>Nợ 1331</td><td>Có 331</td></tr>
              <tr><td>Phiếu thu (CSH)</td><td colSpan={2}>—</td><td>Nợ 111 / Có 131</td></tr>
              <tr><td>Phiếu chi (CSH)</td><td colSpan={2}>—</td><td>Nợ 331 / Có 111</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      </>}

      <Modal isOpen={!!editingJournal} onClose={() => { if (!saving) setEditingJournal(null); }} title="Sửa sổ nhật ký"
        footer={<><button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setEditingJournal(null)}>Đóng</button>
          <button type="button" className="o-btn o-btn-primary" disabled={saving || !editingJournal?.name.trim() || (editingJournal.type !== 'general' && !editingJournal.defaultAccountId)}
            onClick={() => save(`/journals/${editingJournal.id}`, { name: editingJournal.name, defaultAccountId: editingJournal.defaultAccountId === '' ? null : Number(editingJournal.defaultAccountId) }, () => setEditingJournal(null), 'Đã lưu sổ nhật ký.')}>Lưu</button></>}>
        {editingJournal && <div className="o-stack">
          <p className="text-muted o-report-note">Sổ {editingJournal.code} · {typeLabel[editingJournal.type] || editingJournal.type}</p>
          <div className="o-form-group"><label className="d-block text-muted" htmlFor="journalName">Tên sổ *</label>
            <input id="journalName" className="w-100 p-1" maxLength="128" value={editingJournal.name} onChange={e => setEditingJournal({ ...editingJournal, name: e.target.value })} /></div>
          <div className="o-form-group"><label className="d-block text-muted" htmlFor="journalDefault">Tài khoản mặc định *</label>
            <select id="journalDefault" className="w-100 p-1" value={editingJournal.defaultAccountId} onChange={e => setEditingJournal({ ...editingJournal, defaultAccountId: e.target.value })}>
              <option value="">{editingJournal.type === 'general' ? 'Không chọn' : 'Chọn tài khoản'}</option>
              {compatibleAccounts.map(account => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
            </select></div>
        </div>}
      </Modal>

      <Modal isOpen={!!editingAccount} onClose={() => { if (!saving) setEditingAccount(null); }} title="Sửa tên tài khoản"
        footer={<><button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setEditingAccount(null)}>Đóng</button>
          <button type="button" className="o-btn o-btn-primary" disabled={saving || !editingAccount?.name.trim()}
            onClick={() => save(`/accounts/${editingAccount.id}`, { name: editingAccount.name }, () => setEditingAccount(null), 'Đã lưu tên tài khoản.')}>Lưu</button></>}>
        {editingAccount && <div className="o-stack">
          <p className="text-muted o-report-note">Tài khoản {editingAccount.code} · {editingAccount.accountType}</p>
          <div className="o-form-group"><label className="d-block text-muted" htmlFor="accountName">Tên tài khoản *</label>
            <input id="accountName" className="w-100 p-1" maxLength="255" value={editingAccount.name} onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })} /></div>
        </div>}
      </Modal>
    </div>
  );
}
