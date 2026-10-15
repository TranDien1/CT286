import React, { useState } from 'react';
import { useApp, api } from '../context/AppContext';
import { usage } from '../backend/api';
import PageHeader, { ReadOnlyNotice } from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import Modal, { ConfirmModal } from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';

// CAT-04: thuế đã dùng không sửa thuế suất; CAT-05: thuế bán/mua; CAT-06: kế toán quản lý; CAT-07: không có cột active.
export default function Taxes() {
  const { db, call, isAccountant, isAdmin, accountName } = useApp();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const rows = db.taxes.map(t => ({
    ...t,
    used: usage.tax(db, t.id),
    isDefault: db.products.some(p => p.saleTaxId === t.id || p.purchaseTaxId === t.id)
  }));

  const save = () => {
    const res = call(api.saveTax, [{ ...editing, amount: editing.amount }], editing.id ? 'Đã lưu thuế.' : 'Đã thêm thuế.');
    if (res.ok) setEditing(null);
  };

  const editingUsed = editing?.id ? usage.tax(db, editing.id) : false;

  const columns = [
    { key: 'name', label: 'Tên thuế', sortable: true, render: r => <strong>{r.name}</strong> },
    { key: 'typeTaxUse', label: 'Loại', sortable: true, render: r => <StatusBadge status={r.typeTaxUse} /> },
    { key: 'amount', label: 'Thuế suất', sortable: true, className: 'text-right num', render: r => `${r.amount}%` },
    { key: 'accountCode', label: 'Tài khoản', render: r => `${r.accountCode} ${accountName(r.accountCode)}` },
    { key: 'used', label: 'Đã dùng trong giao dịch', render: r => (r.used ? 'Có' : 'Chưa') },
    ...(isAccountant ? [{
      key: 'actions', label: '', className: 'text-right o-nowrap',
      render: r => (
        <div className="o-row-actions">
          <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditing({ ...r })}>Sửa</button>
          {!r.used && !r.isDefault && <button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setDeleting(r)}>Xóa</button>}
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
          <button type="button" className="o-btn o-btn-primary" onClick={() => setEditing({ name: '', amount: 10, typeTaxUse: 'sale', accountCode: '3331' })}>Thêm thuế</button>
        )}
      />
      {isAdmin && <ReadOnlyNotice>Admin chỉ được xem danh mục thuế.</ReadOnlyNotice>}
      <DataTable columns={columns} data={rows} />
      <p className="text-muted o-report-note">Thuế đã dùng trong giao dịch không sửa được thuế suất; cần thuế suất mới thì tạo thuế mới. Thuế bán chỉ dùng cho hóa đơn bán, thuế mua chỉ dùng cho hóa đơn mua.</p>

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Sửa thuế' : 'Thêm thuế'}
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => setEditing(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" onClick={save}>Lưu</button>
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
                  onChange={e => setEditing({ ...editing, typeTaxUse: e.target.value, accountCode: e.target.value === 'sale' ? '3331' : '1331' })}>
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
              <select id="txAcc" className="w-100 p-1" value={editing.accountCode} disabled={editingUsed} onChange={e => setEditing({ ...editing, accountCode: e.target.value })}>
                {db.accounts.map(a => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
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
        onClose={() => setDeleting(null)}
        onConfirm={() => { call(api.deleteTax, [deleting.id], 'Đã xóa thuế.'); setDeleting(null); }}
      />
    </div>
  );
}
