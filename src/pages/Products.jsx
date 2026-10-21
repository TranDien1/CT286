import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/format';
import PageHeader, { ReadOnlyNotice } from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import Modal, { ConfirmModal } from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';

const EMPTY = { code: '', name: '', uom: 'Cái', categoryId: '', salePrice: 0, costPrice: 0, saleTaxId: '', purchaseTaxId: '' };

// CAT-01/02/03/06/07: sản phẩm có active; nhóm sản phẩm không có active; đã dùng thì không xóa.
export default function Products() {
  const { request, showToast, isAccountant, isAdmin } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'categories' ? 'categories' : 'products';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [deleting, setDeleting] = useState(null); // { kind, item }

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    Promise.all([request('/products'), request('/product-categories'), request('/taxes'), request('/accounts')])
      .then(([products, categories, taxes, accounts]) => { if (!cancelled) setData({ products, categories, taxes, accounts }); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const catName = (id) => data?.categories.find(c => c.id === id)?.name || '—';
  const taxName = (id) => data?.taxes.find(t => t.id === id)?.name || '—';
  const saleTaxes = (data?.taxes || []).filter(t => t.typeTaxUse === 'sale');
  const purchaseTaxes = (data?.taxes || []).filter(t => t.typeTaxUse === 'purchase');

  const products = useMemo(() => (data?.products || [])
    .filter(p => (!category || p.categoryId === Number(category)))
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())), [data, search, category]);

  const categories = data?.categories || [];

  const perform = async (path, options, message, onSuccess) => {
    if (pending.current) return;
    pending.current = true; setSaving(true);
    try { await request(path, options); showToast(message); onSuccess?.(); setReloadKey(key => key + 1); }
    catch (err) { showToast(err.message, 'warning'); }
    finally { pending.current = false; setSaving(false); }
  };
  const saveProduct = () => {
    if (editing.salePrice === '' || editing.costPrice === '') { showToast('Vui lòng nhập giá bán và giá mua.', 'warning'); return; }
    perform(editing.id ? `/products/${editing.id}` : '/products', {
      method: editing.id ? 'PUT' : 'POST', body: { code: editing.code, name: editing.name,
        uom: editing.uom, categoryId: editing.categoryId === '' ? null : Number(editing.categoryId),
        salePrice: editing.salePrice, costPrice: editing.costPrice,
        saleTaxId: editing.saleTaxId === '' ? null : Number(editing.saleTaxId),
        purchaseTaxId: editing.purchaseTaxId === '' ? null : Number(editing.purchaseTaxId) }
    }, editing.id ? 'Đã lưu sản phẩm.' : 'Đã thêm sản phẩm.', () => setEditing(null));
  };
  const saveCategory = () => {
    perform(editingCat.id ? `/product-categories/${editingCat.id}` : '/product-categories', {
      method: editingCat.id ? 'PUT' : 'POST', body: { name: editingCat.name,
        salesAccountId: editingCat.salesAccountId ? Number(editingCat.salesAccountId) : null, purchaseAccountId: editingCat.purchaseAccountId ? Number(editingCat.purchaseAccountId) : null }
    }, editingCat.id ? 'Đã cập nhật nhóm.' : 'Đã thêm nhóm sản phẩm.', () => setEditingCat(null));
  };
  const doDelete = () => {
    const isProduct = deleting.kind === 'product';
    perform(`/${isProduct ? 'products' : 'product-categories'}/${deleting.item.id}`, { method: 'DELETE' },
      isProduct ? 'Đã xóa sản phẩm.' : 'Đã xóa nhóm sản phẩm.', () => setDeleting(null));
  };

  const productColumns = [
    { key: 'code', label: 'Mã sản phẩm', sortable: true },
    { key: 'name', label: 'Tên sản phẩm', sortable: true, render: r => <strong>{r.name}</strong> },
    { key: 'uom', label: 'ĐVT' },
    { key: 'categoryId', label: 'Nhóm', sortable: true, sortValue: r => catName(r.categoryId), render: r => catName(r.categoryId) },
    { key: 'salePrice', label: 'Giá bán', sortable: true, className: 'text-right num', render: r => formatCurrency(r.salePrice) },
    { key: 'costPrice', label: 'Giá mua', sortable: true, className: 'text-right num', render: r => formatCurrency(r.costPrice) },
    { key: 'saleTaxId', label: 'Thuế bán', render: r => taxName(r.saleTaxId) },
    { key: 'purchaseTaxId', label: 'Thuế mua', render: r => taxName(r.purchaseTaxId) },
    { key: 'active', label: 'Trạng thái', sortable: true, render: r => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    ...(isAccountant ? [{
      key: 'actions', label: '', className: 'text-right o-nowrap',
      render: r => (
        <div className="o-row-actions">
          <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditing({ ...r, categoryId: r.categoryId || '', saleTaxId: r.saleTaxId || '', purchaseTaxId: r.purchaseTaxId || '' })}>Sửa</button>
          <button type="button" className="o-btn o-btn-sm o-btn-secondary"
            disabled={saving} onClick={() => perform(`/products/${r.id}/active`, { method: 'PATCH', body: { active: !r.active } }, r.active ? 'Đã ngừng hoạt động sản phẩm.' : 'Đã kích hoạt lại sản phẩm.')}>
            {r.active ? 'Ngừng hoạt động' : 'Kích hoạt'}
          </button>
          {!r.usedInTransactions && <button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setDeleting({ kind: 'product', item: r })}>Xóa</button>}
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
          ? <button type="button" className="o-btn o-btn-primary" disabled={!data || saving} onClick={() => setEditing({ ...EMPTY, saleTaxId: saleTaxes[0]?.id || '', purchaseTaxId: purchaseTaxes[0]?.id || '' })}>Thêm sản phẩm</button>
          : <button type="button" className="o-btn o-btn-primary" disabled={!data || saving} onClick={() => setEditingCat({ name: '' })}>Thêm nhóm</button>)}
      />
      {isAdmin && <ReadOnlyNotice>Admin chỉ được xem danh mục.</ReadOnlyNotice>}

      <div className="o-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'products'} className={`o-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setParams({})}>Sản phẩm{data ? ` (${data.products.length})` : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'categories'} className={`o-tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setParams({ tab: 'categories' })}>Nhóm sản phẩm{data ? ` (${data.categories.length})` : ''}</button>
      </div>

      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReloadKey(key => key + 1)}>Thử lại</button></div>}
      {!data && !error && <p>Đang tải danh mục từ SQL Server…</p>}
      {data && (tab === 'products' ? (
        <>
          <div className="o-toolbar">
            <input type="search" className="o-search" aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="o-filter-row">
              <label className="text-muted" htmlFor="fCat">Nhóm</label>
              <select id="fCat" className="p-1" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Tất cả</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              { key: 'salesAccountId', label: 'TK bán', render: r => data.accounts.find(a => a.id === r.salesAccountId)?.code || 'Chưa cấu hình' },
              { key: 'purchaseAccountId', label: 'TK mua', render: r => data.accounts.find(a => a.id === r.purchaseAccountId)?.code || 'Chưa cấu hình' },
              { key: 'productCount', label: 'Số sản phẩm', sortable: true, className: 'text-right num' },
              ...(isAccountant ? [{
                key: 'actions', label: '', className: 'text-right o-nowrap',
                render: r => (
                  <div className="o-row-actions">
                    <button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => setEditingCat({ ...r })}>Sửa</button>
                    {r.productCount === 0 && <button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setDeleting({ kind: 'category', item: r })}>Xóa</button>}
                  </div>
                )
              }] : [])
            ]}
          />
          <p className="text-muted o-report-note">Nhóm đang có sản phẩm không xóa được.</p>
        </>
      ))}

      <Modal
        isOpen={!!editing}
        onClose={() => { if (!saving) setEditing(null); }}
        title={editing?.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setEditing(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" disabled={saving} onClick={saveProduct}>Lưu</button>
          </>
        )}
      >
        {editing && (
          <div className="o-stack">
            <div className="o-form-row">
              <div className="o-form-group"><label className="d-block text-muted" htmlFor="pdCode">Mã sản phẩm *</label><input id="pdCode" maxLength="32" className="w-100 p-1" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} /></div>
              <div className="o-form-group"><label className="d-block text-muted" htmlFor="pdUom">Đơn vị tính *</label><input id="pdUom" maxLength="32" className="w-100 p-1" value={editing.uom} onChange={e => setEditing({ ...editing, uom: e.target.value })} /></div>
            </div>
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="pdName">Tên sản phẩm *</label>
              <input id="pdName" className="w-100 p-1" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="pdCat">Nhóm sản phẩm *</label>
              <select id="pdCat" className="w-100 p-1" value={editing.categoryId} onChange={e => setEditing({ ...editing, categoryId: e.target.value })}>
                <option value="">Chọn nhóm sản phẩm</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="pdList">Giá bán (chưa thuế)</label>
                <input id="pdList" type="number" min="0" step="0.01" className="w-100 p-1" value={editing.salePrice} onChange={e => setEditing({ ...editing, salePrice: e.target.value })} />
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="pdStd">Giá mua (chưa thuế)</label>
                <input id="pdStd" type="number" min="0" step="0.01" className="w-100 p-1" value={editing.costPrice} onChange={e => setEditing({ ...editing, costPrice: e.target.value })} />
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
        onClose={() => { if (!saving) setEditingCat(null); }}
        title={editingCat?.id ? 'Sửa nhóm sản phẩm' : 'Thêm nhóm sản phẩm'}
        size="sm"
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setEditingCat(null)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" disabled={saving} onClick={saveCategory}>Lưu</button>
          </>
        )}
      >
        {editingCat && (
          <div className="o-stack">
            <label className="d-block text-muted" htmlFor="catName">Tên nhóm *</label>
            <input id="catName" className="w-100 p-1" value={editingCat.name} onChange={e => setEditingCat({ ...editingCat, name: e.target.value })} />
            <label htmlFor="catSale">Tài khoản bán (doanh thu) *</label>
            <select id="catSale" value={editingCat.salesAccountId || ''} onChange={e => setEditingCat({ ...editingCat, salesAccountId: e.target.value })}><option value="">Chọn tài khoản</option>{data?.accounts.filter(a => a.accountType === 'income' && a.code === '511').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select>
            <label htmlFor="catPurchase">Tài khoản mua (tài sản) *</label>
            <select id="catPurchase" value={editingCat.purchaseAccountId || ''} onChange={e => setEditingCat({ ...editingCat, purchaseAccountId: e.target.value })}><option value="">Chọn tài khoản</option>{data?.accounts.filter(a => a.accountType === 'asset' && a.code === '156').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleting}
        title={deleting?.kind === 'product' ? 'Xóa sản phẩm?' : 'Xóa nhóm sản phẩm?'}
        message={`Xóa "${deleting?.item.name}"? Thao tác này không hoàn tác được.`}
        confirmLabel="Xóa"
        danger
        onClose={() => { if (!saving) setDeleting(null); }}
        onConfirm={doDelete}
      />
    </div>
  );
}
