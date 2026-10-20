import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import PageHeader, { ReadOnlyNotice } from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import Modal, { ConfirmModal } from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';

const EMPTY = { name: '', partnerType: 'customer', email: '', phone: '', address: '', city: '', taxCode: '' };

// CAT-01, CAT-03, CAT-06: kế toán quản lý đối tác; Admin chỉ xem; đã dùng thì không xóa, chỉ ngừng hoạt động.
export default function Partners() {
  const { request, showToast, isAccountant, isAdmin } = useApp();
  const [partners, setPartners] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || '';
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPartners(null); setError('');
    request('/partners').then(data => {
      if (!cancelled) setPartners(data.map(p => ({ ...p, partnerType: p.partnerType === 'supplier' ? 'vendor' : p.partnerType,
        taxCode: p.vat || '', email: p.email || '', phone: p.phone || '', address: p.address || '', city: p.city || '' })));
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const rows = useMemo(() => (partners || [])
    .filter(p => (!type || p.partnerType === type) && (showInactive || p.active))
    .filter(p => {
      const s = search.trim().toLowerCase();
      return !s || p.name.toLowerCase().includes(s) || (p.taxCode || '').includes(s) || (p.email || '').toLowerCase().includes(s);
    }), [partners, type, search, showInactive]);

  const perform = async (path, options, message, onSuccess) => {
    if (pending.current) return;
    pending.current = true; setSaving(true);
    try {
      await request(path, options);
      showToast(message); onSuccess?.(); setReloadKey(key => key + 1);
    } catch (err) { showToast(err.message, 'warning'); }
    finally { pending.current = false; setSaving(false); }
  };
  const save = () => {
    perform(editing.id ? `/partners/${editing.id}` : '/partners', {
      method: editing.id ? 'PUT' : 'POST',
      body: { name: editing.name, partnerType: editing.partnerType === 'vendor' ? 'supplier' : editing.partnerType,
        vat: editing.taxCode, email: editing.email, phone: editing.phone, address: editing.address, city: editing.city }
    }, editing.id ? 'Đã lưu đối tác.' : 'Đã thêm đối tác.', () => setEditing(null));
  };

  const title = type === 'customer' ? 'Khách hàng' : type === 'vendor' ? 'Nhà cung cấp' : 'Đối tác';

  const columns = [
    { key: 'name', label: 'Tên', sortable: true, render: r => <strong>{r.name}</strong> },
    { key: 'partnerType', label: 'Loại', sortable: true, render: r => <StatusBadge status={r.partnerType} /> },
    { key: 'taxCode', label: 'Mã số thuế', render: r => r.taxCode || '—' },
    { key: 'email', label: 'Email', render: r => r.email || '—' },
    { key: 'phone', label: 'Điện thoại', render: r => r.phone || '—' },
    { key: 'city', label: 'Tỉnh/Thành', sortable: true },
    { key: 'active', label: 'Trạng thái', sortable: true, render: r => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    ...(isAccountant ? [{
      key: 'actions', label: '', className: 'text-right o-nowrap',
      render: r => (
        <div className="o-row-actions">
          <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditing({ ...r })}>Sửa</button>
          <button type="button" className="o-btn o-btn-sm o-btn-secondary"
            disabled={saving} onClick={() => perform(`/partners/${r.id}/active`, { method: 'PATCH', body: { active: !r.active } }, r.active ? 'Đã ngừng hoạt động đối tác.' : 'Đã kích hoạt lại đối tác.')}>
            {r.active ? 'Ngừng hoạt động' : 'Kích hoạt'}
          </button>
          {!r.usedInTransactions && <button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setDeleting(r)}>Xóa</button>}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb="Danh mục"
        title={title}
        actions={isAccountant && (
          <button type="button" className="o-btn o-btn-primary" disabled={!partners || saving} onClick={() => setEditing({ ...EMPTY, partnerType: type || 'customer' })}>Thêm đối tác</button>
        )}
      />
      {isAdmin && <ReadOnlyNotice>Admin chỉ được xem danh mục. Kế toán quản lý đối tác, sản phẩm, nhóm sản phẩm và thuế.</ReadOnlyNotice>}

      <div className="o-toolbar">
        <input type="search" className="o-search" aria-label="Tìm đối tác" placeholder="Tìm theo tên, mã số thuế, email..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="o-chip-group" role="group" aria-label="Lọc loại đối tác">
          {[['', 'Tất cả'], ['customer', 'Khách hàng'], ['vendor', 'Nhà cung cấp']].map(([k, label]) => (
            <button key={k} type="button" className={`o-chip ${type === k ? 'active' : ''}`} onClick={() => setParams(k ? { type: k } : {})}>{label}</button>
          ))}
        </div>
        <label className="o-check"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Hiện cả đối tác ngừng hoạt động</label>
      </div>

      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReloadKey(key => key + 1)}>Thử lại</button></div>}
      {!partners && !error && <p>Đang tải đối tác từ SQL Server…</p>}
      {partners && <DataTable columns={columns} data={rows} emptyMessage="Không có đối tác nào." />}
      <p className="text-muted o-report-note">Đối tác đã có giao dịch không xóa được, chỉ chuyển sang ngừng hoạt động.</p>

      <Modal
        isOpen={!!editing}
        onClose={() => { if (!saving) setEditing(null); }}
        title={editing?.id ? 'Sửa đối tác' : 'Thêm đối tác'}
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setEditing(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" disabled={saving} onClick={save}>Lưu</button>
          </>
        )}
      >
        {editing && (
          <div className="o-stack">
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="ptName">Tên đối tác *</label>
              <input id="ptName" className="w-100 p-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="ptType">Loại *</label>
                <select id="ptType" className="w-100 p-1" value={editing.partnerType} disabled={editing.usedInTransactions}
                  onChange={e => setEditing({ ...editing, partnerType: e.target.value })}>
                  <option value="customer">Khách hàng</option>
                  <option value="vendor">Nhà cung cấp</option>
                </select>
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="ptTax">Mã số thuế</label>
                <input id="ptTax" className="w-100 p-1" inputMode="numeric" value={editing.taxCode} onChange={e => setEditing({ ...editing, taxCode: e.target.value })} />
              </div>
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="ptEmail">Email</label>
                <input id="ptEmail" type="email" className="w-100 p-1" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="ptPhone">Điện thoại</label>
                <input id="ptPhone" className="w-100 p-1" value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
              </div>
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="ptAddr">Địa chỉ</label>
                <input id="ptAddr" className="w-100 p-1" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="ptCity">Tỉnh/Thành</label>
                <input id="ptCity" className="w-100 p-1" value={editing.city} onChange={e => setEditing({ ...editing, city: e.target.value })} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleting}
        title="Xóa đối tác?"
        message={`Xóa "${deleting?.name}"? Đối tác này chưa có giao dịch nên được xóa hẳn.`}
        confirmLabel="Xóa"
        danger
        onClose={() => { if (!saving) setDeleting(null); }}
        onConfirm={() => perform(`/partners/${deleting.id}`, { method: 'DELETE' }, 'Đã xóa đối tác.', () => setDeleting(null))}
      />
    </div>
  );
}
