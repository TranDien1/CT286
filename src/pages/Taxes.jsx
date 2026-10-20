import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import PageHeader, { ReadOnlyNotice } from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import Modal, { ConfirmModal } from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';

// CAT-04: thuế đã dùng không sửa thuế suất; CAT-05: thuế bán/mua; CAT-06: kế toán quản lý; CAT-07: không có cột active.
export default function Taxes() {
  const { request, showToast, isAccountant, isAdmin } = useApp();
  const [rows, setRows] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null); setError('');
    Promise.all([request('/taxes'), request('/accounts')]).then(([taxes, availableAccounts]) => {
      if (!cancelled) { setRows(taxes); setAccounts(availableAccounts); }
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const defaultAccountId = type => accounts.find(a => a.code === (type === 'sale' ? '3331' : '1331'))?.id ?? '';
  const save = async () => {
    if (pending.current) return;
    if (editing.amount === '' || (editing.accountId === '' && !(editing.usedInTransactions && !editing.account))) {
      showToast('Vui lòng nhập thuế suất và chọn tài khoản thuế.', 'warning'); return;
    }
    pending.current = true; setSaving(true);
    try {
      await request(editing.id ? `/taxes/${editing.id}` : '/taxes', {
        method: editing.id ? 'PUT' : 'POST',
        body: { name: editing.name, amount: editing.amount, typeTaxUse: editing.typeTaxUse,
          accountId: editing.accountId === '' ? null : Number(editing.accountId) }
      });
      showToast(editing.id ? 'Đã lưu thuế.' : 'Đã thêm thuế.');
      setEditing(null); setReloadKey(key => key + 1);
    } catch (err) { showToast(err.message, 'warning'); }
    finally { pending.current = false; setSaving(false); }
  };
  const remove = async () => {
    if (pending.current || !deleting) return;
    pending.current = true; setSaving(true);
    try {
      await request(`/taxes/${deleting.id}`, { method: 'DELETE' });
      showToast('Đã xóa thuế.'); setDeleting(null); setReloadKey(key => key + 1);
    } catch (err) { showToast(err.message, 'warning'); setDeleting(null); setReloadKey(key => key + 1); }
    finally { pending.current = false; setSaving(false); }
  };

  const editingUsed = !!editing?.usedInTransactions;

  const columns = [
    { key: 'name', label: 'Tên thuế', sortable: true, render: r => <strong>{r.name}</strong> },
    { key: 'typeTaxUse', label: 'Loại', sortable: true, render: r => <StatusBadge status={r.typeTaxUse} /> },
    { key: 'amount', label: 'Thuế suất', sortable: true, className: 'text-right num', render: r => `${r.amount}%` },
    { key: 'account', label: 'Tài khoản', render: r => r.account ? `${r.account.code} ${r.account.name}` : '—' },
    { key: 'usedInTransactions', label: 'Đã dùng trong giao dịch', render: r => (r.usedInTransactions ? 'Có' : 'Chưa') },
    ...(isAccountant ? [{
      key: 'actions', label: '', className: 'text-right o-nowrap',
      render: r => (
        <div className="o-row-actions">
          <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditing({ ...r, accountId: r.account?.id ?? '' })}>Sửa</button>
          {!r.usedInTransactions && !r.defaultForProduct && <button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setDeleting(r)}>Xóa</button>}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb="Danh mục"
        title="Thuế"
        actions={isAccountant && (
          <button type="button" className="o-btn o-btn-primary" disabled={!rows} onClick={() => setEditing({ name: '', amount: 10, typeTaxUse: 'sale', accountId: defaultAccountId('sale') })}>Thêm thuế</button>
        )}
      />
      {isAdmin && <ReadOnlyNotice>Admin chỉ được xem danh mục thuế.</ReadOnlyNotice>}
      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReloadKey(key => key + 1)}>Thử lại</button></div>}
      {!rows && !error && <p>Đang tải thuế từ SQL Server…</p>}
      {rows && <DataTable columns={columns} data={rows} />}
      <p className="text-muted o-report-note">Thuế đã dùng trong giao dịch không sửa được thuế suất; cần thuế suất mới thì tạo thuế mới. Thuế bán chỉ dùng cho hóa đơn bán, thuế mua chỉ dùng cho hóa đơn mua.</p>

      <Modal
        isOpen={!!editing}
        onClose={() => { if (!saving) setEditing(null); }}
        title={editing?.id ? 'Sửa thuế' : 'Thêm thuế'}
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setEditing(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" disabled={saving} onClick={save}>Lưu</button>
          </>
        )}
      >
        {editing && (
          <div className="o-stack">
            {editingUsed && <div className="o-notice o-notice-info">Thuế này đã được dùng trong giao dịch: chỉ đổi được tên.</div>}
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="txName">Tên thuế *</label>
              <input id="txName" className="w-100 p-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="txUse">Loại *</label>
                <select id="txUse" className="w-100 p-1" value={editing.typeTaxUse} disabled={editingUsed}
                  onChange={e => setEditing({ ...editing, typeTaxUse: e.target.value, accountId: defaultAccountId(e.target.value) })}>
                  <option value="sale">Thuế bán</option>
                  <option value="purchase">Thuế mua</option>
                </select>
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="txAmount">Thuế suất (%) *</label>
                <input id="txAmount" type="number" min="0" max="100" step="any" className="w-100 p-1" value={editing.amount} disabled={editingUsed}
                  onChange={e => setEditing({ ...editing, amount: e.target.value })} />
              </div>
            </div>
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="txAcc">Tài khoản thuế *</label>
              <select id="txAcc" className="w-100 p-1" value={editing.accountId} disabled={editingUsed} onChange={e => setEditing({ ...editing, accountId: e.target.value })}>
                <option value="">Chọn tài khoản</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleting}
        title="Xóa thuế?"
        message={`Xóa "${deleting?.name}"? Thuế này chưa được dùng nên được xóa hẳn.`}
        confirmLabel="Xóa"
        danger
        onClose={() => { if (!saving) setDeleting(null); }}
        onConfirm={remove}
      />
    </div>
  );
}
