import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp, api } from '../context/AppContext';
import { usage } from '../backend/api';
import { formatCurrency } from '../utils/format';
import PageHeader, { ReadOnlyNotice } from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import Modal, { ConfirmModal } from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';

const EMPTY = { name: '', categoryId: '', listPrice: 0, standardPrice: 0, saleTaxId: '', purchaseTaxId: '' };

// CAT-01/02/03/06/07: sản phẩm có active; nhóm sản phẩm không có active; đã dùng thì không xóa.
export default function Products() {
  const { db, call, isAccountant, isAdmin, taxById } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'categories' ? 'categories' : 'products';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [deleting, setDeleting] = useState(null); // { kind, item }

  const catName = (id) => db.categories.find(c => c.id === id)?.name || '—';
  const saleTaxes = db.taxes.filter(t => t.typeTaxUse === 'sale');
  const purchaseTaxes = db.taxes.filter(t => t.typeTaxUse === 'purchase');

  const products = useMemo(() => db.products
    .filter(p => (!category || p.categoryId === Number(category)))
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .map(p => ({ ...p, used: usage.product(db, p.id) })), [db, search, category]);

  const categories = db.categories.map(c => ({ ...c, count: db.products.filter(p => p.categoryId === c.id).length }));

  const saveProduct = () => {
    const res = call(api.saveProduct, [editing], editing.id ? 'Đã lưu sản phẩm.' : 'Đã thêm sản phẩm.');
    if (res.ok) setEditing(null);
  };
  const saveCategory = () => {
    const res = call(api.saveCategory, [editingCat], editingCat.id ? 'Đã đổi tên nhóm.' : 'Đã thêm nhóm sản phẩm.');
    if (res.ok) setEditingCat(null);
  };
  const doDelete = () => {
    if (deleting.kind === 'product') call(api.deleteProduct, [deleting.item.id], 'Đã xóa sản phẩm.');
    else call(api.deleteCategory, [deleting.item.id], 'Đã xóa nhóm sản phẩm.');
    setDeleting(null);
  };

  const productColumns = [
    { key: 'name', label: 'Tên sản phẩm', sortable: true, render: r => <strong>{r.name}</strong> },
    { key: 'categoryId', label: 'Nhóm', sortable: true, sortValue: r => catName(r.categoryId), render: r => catName(r.categoryId) },
    { key: 'listPrice', label: 'Giá bán', sortable: true, className: 'text-right num', render: r => formatCurrency(r.listPrice) },
    { key: 'standardPrice', label: 'Giá mua', sortable: true, className: 'text-right num', render: r => formatCurrency(r.standardPrice) },
    { key: 'saleTaxId', label: 'Thuế bán', render: r => taxById(r.saleTaxId)?.name || '—' },
    { key: 'purchaseTaxId', label: 'Thuế mua', render: r => taxById(r.purchaseTaxId)?.name || '—' },
    { key: 'active', label: 'Trạng thái', sortable: true, render: r => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    ...(isAccountant ? [{
      key: 'actions', label: '', className: 'text-right o-nowrap',
      render: r => (
        <div className="o-row-actions">
          <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditing({ ...r, categoryId: r.categoryId || '', saleTaxId: r.saleTaxId || '', purchaseTaxId: r.purchaseTaxId || '' })}>Sửa</button>
          <button type="button" className="o-btn o-btn-sm o-btn-secondary"
            onClick={() => call(api.setProductActive, [r.id, !r.active], r.active ? 'Đã ngừng hoạt động sản phẩm.' : 'Đã kích hoạt lại sản phẩm.')}>
            {r.active ? 'Ngừng hoạt động' : 'Kích hoạt'}
          </button>
          {!r.used && <button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setDeleting({ kind: 'product', item: r })}>Xóa</button>}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb="Danh mục"
        title="Sản phẩm và nhóm sản phẩm"
        actions={isAccountant && (tab === 'products'
          ? <button type="button" className="o-btn o-btn-primary" onClick={() => setEditing({ ...EMPTY, saleTaxId: saleTaxes[0]?.id || '', purchaseTaxId: purchaseTaxes[0]?.id || '' })}>Thêm sản phẩm</button>
          : <button type="button" className="o-btn o-btn-primary" onClick={() => setEditingCat({ name: '' })}>Thêm nhóm</button>)}
      />
      {isAdmin && <ReadOnlyNotice>Admin chỉ được xem danh mục.</ReadOnlyNotice>}

      <div className="o-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'products'} className={`o-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setParams({})}>Sản phẩm ({db.products.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'categories'} className={`o-tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setParams({ tab: 'categories' })}>Nhóm sản phẩm ({db.categories.length})</button>
      </div>

      {tab === 'products' ? (
        <>
          <div className="o-toolbar">
            <input type="search" className="o-search" aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="o-filter-row">
              <label className="text-muted" htmlFor="fCat">Nhóm</label>
              <select id="fCat" className="p-1" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Tất cả</option>
                {db.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <DataTable columns={productColumns} data={products} emptyMessage="Không có sản phẩm nào." />
          <p className="text-muted o-report-note">Sản phẩm ngừng hoạt động không chọn được cho hóa đơn mới; hóa đơn cũ vẫn giữ nguyên. Sản phẩm đã dùng trong giao dịch không xóa được.</p>
        </>
      ) : (
        <>
          <DataTable
            data={categories}
            emptyMessage="Chưa có nhóm sản phẩm."
            columns={[
              { key: 'name', label: 'Tên nhóm', sortable: true, render: r => <strong>{r.name}</strong> },
              { key: 'count', label: 'Số sản phẩm', sortable: true, className: 'text-right num' },
              ...(isAccountant ? [{
                key: 'actions', label: '', className: 'text-right o-nowrap',
                render: r => (
                  <div className="o-row-actions">
                    <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditingCat({ ...r })}>Đổi tên</button>
                    {r.count === 0 && <button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setDeleting({ kind: 'category', item: r })}>Xóa</button>}
                  </div>
                )
              }] : [])
            ]}
          />
          <p className="text-muted o-report-note">Nhóm đang có sản phẩm không xóa được.</p>
        </>
      )}

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => setEditing(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" onClick={saveProduct}>Lưu</button>
          </>
        )}
      >
        {editing && (
          <div className="o-stack">
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="pdName">Tên sản phẩm *</label>
              <input id="pdName" className="w-100 p-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="pdCat">Nhóm sản phẩm</label>
              <select id="pdCat" className="w-100 p-1" value={editing.categoryId} onChange={e => setEditing({ ...editing, categoryId: e.target.value })}>
                <option value="">Không chọn</option>
                {db.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="pdList">Giá bán (chưa thuế)</label>
                <input id="pdList" type="number" min="0" className="w-100 p-1" value={editing.listPrice} onChange={e => setEditing({ ...editing, listPrice: e.target.value })} />
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="pdStd">Giá mua (chưa thuế)</label>
                <input id="pdStd" type="number" min="0" className="w-100 p-1" value={editing.standardPrice} onChange={e => setEditing({ ...editing, standardPrice: e.target.value })} />
              </div>
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="pdSaleTax">Thuế bán mặc định</label>
                <select id="pdSaleTax" className="w-100 p-1" value={editing.saleTaxId} onChange={e => setEditing({ ...editing, saleTaxId: e.target.value })}>
                  <option value="">Không chọn</option>
                  {saleTaxes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="pdPurTax">Thuế mua mặc định</label>
                <select id="pdPurTax" className="w-100 p-1" value={editing.purchaseTaxId} onChange={e => setEditing({ ...editing, purchaseTaxId: e.target.value })}>
                  <option value="">Không chọn</option>
                  {purchaseTaxes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!editingCat}
        onClose={() => setEditingCat(null)}
        title={editingCat?.id ? 'Đổi tên nhóm' : 'Thêm nhóm sản phẩm'}
        size="sm"
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" onClick={() => setEditingCat(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" onClick={saveCategory}>Lưu</button>
          </>
        )}
      >
        {editingCat && (
          <div className="o-form-group">
            <label className="d-block text-muted" htmlFor="catName">Tên nhóm *</label>
            <input id="catName" className="w-100 p-1" value={editingCat.name} onChange={e => setEditingCat({ ...editingCat, name: e.target.value })} />
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleting}
        title={deleting?.kind === 'product' ? 'Xóa sản phẩm?' : 'Xóa nhóm sản phẩm?'}
        message={`Xóa "${deleting?.item.name}"? Thao tác này không hoàn tác được.`}
        confirmLabel="Xóa"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}
