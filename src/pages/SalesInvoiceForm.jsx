import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { computeAmounts, isOverdue } from '../backend/rules';
import { formatCurrency, formatDateTime, todayStr } from '../utils/format';
import StatusBadge from '../components/common/StatusBadge';
import Modal, { ConfirmModal } from '../components/common/Modal';
import { ReadOnlyNotice } from '../components/common/PageHeader';

const empty = () => ({ partnerId: '', invoiceDate: todayStr(), invoiceDateDue: todayStr(), accountingDate: todayStr(), notes: '' });
const asForm = inv => ({ partnerId: inv.partner?.id ?? '', invoiceDate: inv.invoiceDate || '', invoiceDateDue: inv.invoiceDateDue || '', accountingDate: inv.accountingDate || '', notes: inv.notes || '' });
let lineKey = 0;
const key = () => ++lineKey;

export default function SalesInvoiceForm({ type = 'out_invoice' }) {
  const purchase = type === 'in_invoice';
  const path = purchase ? '/bills' : '/invoices';
  const label = purchase ? 'Hóa đơn mua' : 'Hóa đơn bán';
  const partnerLabel = purchase ? 'Nhà cung cấp' : 'Khách hàng';
  const { id } = useParams();
  const navigate = useNavigate();
  const { request, isAccountant, isAdmin, showToast } = useApp();
  const [data, setData] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState(empty);
  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [preview, setPreview] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [tab, setTab] = useState('lines');
  const pending = useRef(false);

  const loadInvoice = inv => {
    setInvoice(inv); setForm(asForm(inv));
    setLines(inv.lines.map(l => ({ ...l, key: key() })));
  };
  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    Promise.all([request(`/partners?type=${purchase ? 'supplier' : 'customer'}`), request('/products'), request(`/taxes?use=${purchase ? 'purchase' : 'sale'}`),
      ...(id ? [request(`/invoices/${id}`)] : [])])
      .then(([partners, products, taxes, inv]) => {
        if (cancelled) return;
        if (inv && inv.entryType !== type) { setError('Hóa đơn không thuộc loại đang xem.'); return; }
        setData({ partners, products, taxes });
        if (inv) loadInvoice(inv); else { setInvoice(null); setForm(empty()); setLines([]); }
      }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id, reload, type]);

  const perform = async (fn) => {
    if (pending.current) return;
    pending.current = true; setSaving(true);
    try { await fn(); } catch (err) { showToast(err.message, 'warning'); }
    finally { pending.current = false; setSaving(false); }
  };
  const payload = () => ({ ...form, partnerId: form.partnerId === '' ? null : Number(form.partnerId),
    lines: lines.map(l => ({ productId: l.productId === '' ? null : Number(l.productId),
      quantity: l.quantity === '' ? null : l.quantity, priceUnit: l.priceUnit === '' ? null : l.priceUnit,
      taxId: l.taxId === '' ? null : Number(l.taxId) })) });
  const save = () => perform(async () => {
    const inv = await request(id ? `/invoices/${id}` : `/invoices/${purchase ? 'purchases' : 'sales'}`, { method: id ? 'PUT' : 'POST', body: payload() });
    showToast('Đã lưu hóa đơn nháp.');
    if (id) loadInvoice(inv); else navigate(`${path}/${inv.id}`, { replace: true });
  });
  const post = () => perform(async () => {
    const saved = await request(`/invoices/${id}`, { method: 'PUT', body: payload() });
    loadInvoice(saved);
    const inv = await request(`/invoices/${id}/post`, { method: 'POST' });
    loadInvoice(inv); showToast(`Đã ghi sổ hóa đơn ${inv.name}.`);
  });
  const transition = () => perform(async () => {
    const inv = await request(`/invoices/${id}/cancel`, { method: 'POST' });
    loadInvoice(inv); setConfirm(null); showToast('Đã hủy hóa đơn.');
  });
  const pay = () => perform(async () => {
    const result = await request('/payments', { method: 'POST', body: { invoiceId: Number(id), paymentDate } });
    setPaymentOpen(false);
    showToast(`Đã lập ${purchase ? 'phiếu chi' : 'phiếu thu'} ${result.name}.`);
    setReload(n => n + 1);
  });
  const createPartner = () => perform(async () => {
    const p = await request('/partners', { method: 'POST', body: { name: partnerName, partnerType: purchase ? 'supplier' : 'customer' } });
    setData(d => ({ ...d, partners: [...d.partners, p] }));
    setForm(f => ({ ...f, partnerId: p.id })); setPartnerOpen(false); setPartnerName('');
    showToast(`Đã thêm ${partnerLabel.toLowerCase()}.`);
  });
  const updateLine = (lineId, field, value) => setLines(prev => prev.map(l => {
    if (l.key !== lineId) return l;
    const next = { ...l, [field]: value };
    if (field === 'productId') {
      const product = data.products.find(p => p.id === Number(value));
      if (product) { next.priceUnit = purchase ? product.costPrice : product.salePrice; next.taxId = (purchase ? product.purchaseTaxId : product.saleTaxId) ?? ''; }
    }
    return next;
  }));

  if (error) return <div className="o-page"><div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReload(n => n + 1)}>Thử lại</button></div><Link to={path}>Về danh sách</Link></div>;
  if (!data) return <div className="o-page">Đang tải hóa đơn từ SQL Server…</div>;
  if (!id && !isAccountant) return <div className="o-page"><ReadOnlyNotice>Admin không được tạo hóa đơn.</ReadOnlyNotice><Link to={path}>Về danh sách</Link></div>;
  const state = invoice?.state || 'draft';
  const editable = isAccountant && state === 'draft';
  const shown = computeAmounts(lines, data.taxes);
  const savedProductIds = new Set((invoice?.lines || []).map(l => l.productId));
  const customers = data.partners.filter(p => p.active || p.id === Number(form.partnerId));
  const title = invoice?.name || (id ? `${label} nháp` : `${label} mới`);
  const productName = productId => data.products.find(p => p.id === productId)?.name || '—';
  const selectedPartner = data.partners.find(p => p.id === invoice?.partner?.id);

  return <div className="o-page">
    <div className="o-page-header"><div className="o-breadcrumb"><Link to={path}>{label}</Link> / {title}</div></div>
    {isAdmin && <ReadOnlyNotice />}
    {state === 'cancel' && <div className="o-notice o-notice-muted">Hóa đơn đã hủy; không thể sửa hoặc ghi sổ lại.</div>}
    {state === 'draft' && invoice?.name && <div className="o-notice o-notice-info">Ghi sổ lại sẽ giữ nguyên số {invoice.name}.</div>}
    {isOverdue(invoice) && <div className="o-notice o-notice-error">Hóa đơn đã quá hạn thanh toán.</div>}
    <div className="o-card">
      <div className="o-form-status-bar"><div className="o-header-actions">
        {editable && <button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={save}>{id ? 'Lưu' : 'Lưu nháp'}</button>}
        {editable && id && <><button type="button" className="o-btn o-btn-primary" disabled={saving} onClick={post}>Ghi sổ</button><button type="button" className="o-btn o-btn-danger" disabled={saving} onClick={() => setConfirm('cancel')}>Hủy hóa đơn</button></>}
        {isAccountant && state === 'posted' && invoice?.paymentState === 'not_paid' && <button type="button" className="o-btn o-btn-primary" disabled={saving || invoice.amountTotal <= 0} onClick={() => { setPaymentDate(todayStr()); setPaymentOpen(true); }}>{purchase ? 'Lập phiếu chi' : 'Lập phiếu thu'}</button>}
        {invoice && <button type="button" className="o-btn o-btn-secondary" onClick={() => setPreview(true)}>Xem trước</button>}
      </div><div className="o-pipeline"><span className={`o-status-step ${state === 'draft' ? 'active' : ''}`}>Nháp</span><span className="o-pipeline-sep">›</span><span className={`o-status-step ${state === 'posted' ? 'active' : ''}`}>Đã ghi sổ</span><span className="o-pipeline-sep">›</span><span className={`o-status-step ${invoice?.paymentState === 'paid' ? 'active' : ''}`}>Đã thanh toán</span></div></div>
      <div className="o-form-title-row"><h2 className="o-form-header">{title} {invoice && <StatusBadge status={state} />} {state === 'posted' && <StatusBadge status={invoice.paymentState} />}</h2>{invoice && <span className="text-muted o-meta">Người tạo: {invoice.createdBy?.name || '—'} · {formatDateTime(invoice.createdAt)}</span>}</div>
      {state === 'posted' && invoice?.paymentState === 'paid' && <p className="o-notice o-notice-success">Hóa đơn đã thanh toán đủ; chưa hỗ trợ chỉnh sửa hoặc hủy.</p>}
      {state === 'posted' && invoice?.paymentState === 'not_paid' && invoice.amountTotal <= 0 && <p className="o-notice o-notice-info">Không thể lập phiếu thanh toán cho hóa đơn có tổng tiền bằng 0.</p>}
      <div className="o-form-grid"><div className="o-form-section">
        <div className="o-form-group"><label className="d-block text-muted" htmlFor="salePartner">{partnerLabel} *</label><select id="salePartner" className="w-100 p-1" disabled={!editable} value={form.partnerId} onChange={e => setForm({ ...form, partnerId: e.target.value })}><option value="">Chọn {partnerLabel.toLowerCase()}</option>{customers.map(p => <option key={p.id} value={p.id}>{p.name}{!p.active ? ' (ngừng hoạt động)' : ''}</option>)}</select>{editable && <button type="button" className="o-link-btn" onClick={() => setPartnerOpen(true)}>Thêm nhanh {partnerLabel.toLowerCase()}</button>}</div>
        <div className="o-form-group"><label className="d-block text-muted" htmlFor="saleNotes">Ghi chú</label><textarea id="saleNotes" maxLength="1000" className="w-100 p-1" disabled={!editable} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div><div className="o-form-section">
        {[['invoiceDate','Ngày hóa đơn'],['invoiceDateDue','Hạn thanh toán'],['accountingDate','Ngày hạch toán']].map(([field,label]) => <div className="o-form-group" key={field}><label className="d-block text-muted" htmlFor={field}>{label} *</label><input id={field} type="date" className="w-100 p-1" disabled={!editable} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} /></div>)}
      </div></div>
      <div className="o-tabs"><button type="button" className={`o-tab ${tab === 'lines' ? 'active' : ''}`} onClick={() => setTab('lines')}>Dòng hóa đơn</button><button type="button" className={`o-tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>Bút toán</button></div>
      {tab === 'lines' ? <><div className="o-table-wrapper"><table className="o-table w-100"><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>{purchase ? 'Thuế mua' : 'Thuế bán'}</th><th>Thành tiền</th>{editable && <th />}</tr></thead><tbody>
        {lines.map((l, index) => <tr key={l.key}><td><select value={l.productId} disabled={!editable} onChange={e => updateLine(l.key,'productId',e.target.value)}><option value="">Chọn sản phẩm</option>{data.products.filter(p => p.active || savedProductIds.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}{!p.active ? ' (ngừng hoạt động)' : ''}</option>)}</select></td><td><input type="number" min="0" step="1" aria-label="Số lượng" value={l.quantity} disabled={!editable} onChange={e => updateLine(l.key,'quantity',e.target.value)} /></td><td><input type="number" min="0" step="0.01" value={l.priceUnit} disabled={!editable} onChange={e => updateLine(l.key,'priceUnit',e.target.value)} /></td><td><select value={l.taxId ?? ''} disabled={!editable} onChange={e => updateLine(l.key,'taxId',e.target.value)}><option value="">Chọn thuế</option>{data.taxes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td><td className="text-right num">{formatCurrency(shown.lines[index].subtotal)}</td>{editable && <td><button type="button" className="o-btn o-btn-sm o-btn-danger" onClick={() => setLines(ls => ls.filter(row => row.key !== l.key))}>Xóa</button></td>}</tr>)}
      </tbody></table></div>{editable && <button type="button" className="o-btn o-btn-secondary" onClick={() => setLines(ls => [...ls, { key: key(), productId: '', quantity: 1, priceUnit: '', taxId: '' }])}>Thêm dòng</button>}
      <div className="o-totals-wrap"><div className="o-totals-box"><div className="o-total-line"><span>Chưa thuế</span><span>{formatCurrency(editable ? shown.amountUntaxed : invoice?.amountUntaxed)}</span></div><div className="o-total-line"><span>Thuế</span><span>{formatCurrency(editable ? shown.amountTax : invoice?.amountTax)}</span></div><div className="o-total-line o-total-grand"><span>Tổng cộng</span><span>{formatCurrency(editable ? shown.amountTotal : invoice?.amountTotal)}</span></div></div></div></> : <><p className="text-muted">Các dòng bút toán theo lần lưu gần nhất.</p><div className="o-table-wrapper"><table className="o-table w-100"><thead><tr><th>Diễn giải</th><th>Tài khoản</th><th>Nợ</th><th>Có</th></tr></thead><tbody>{(invoice?.items || []).map(i => <tr key={i.id}><td>{i.name || productName(i.productId)}</td><td>{i.accountCode}</td><td>{formatCurrency(i.debit)}</td><td>{formatCurrency(i.credit)}</td></tr>)}</tbody></table></div></>}
    </div>
    <ConfirmModal isOpen={!!confirm} title="Hủy hóa đơn?" message="Hóa đơn sẽ bị hủy và không khôi phục được." confirmLabel="Xác nhận" danger onClose={() => { if (!saving) setConfirm(null); }} onConfirm={transition} />
    <Modal isOpen={paymentOpen} title={purchase ? 'Lập phiếu chi' : 'Lập phiếu thu'} onClose={() => { if (!saving) setPaymentOpen(false); }} footer={<><button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setPaymentOpen(false)}>Đóng</button><button type="button" className="o-btn o-btn-primary" disabled={saving || !paymentDate} onClick={pay}>Xác nhận</button></>}><p>Thanh toán tiền mặt đủ một lần: <strong>{formatCurrency(invoice?.amountTotal)}</strong>.</p><label htmlFor="paymentDate">Ngày thanh toán *</label><input id="paymentDate" type="date" className="w-100 p-1" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></Modal>
    <Modal isOpen={partnerOpen} title={`Thêm nhanh ${partnerLabel.toLowerCase()}`} onClose={() => { if (!saving) setPartnerOpen(false); }} footer={<><button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setPartnerOpen(false)}>Đóng</button><button type="button" className="o-btn o-btn-primary" disabled={saving} onClick={createPartner}>Thêm</button></>}><label htmlFor="quickPartner">Tên {partnerLabel.toLowerCase()} *</label><input id="quickPartner" className="w-100 p-1" value={partnerName} onChange={e => setPartnerName(e.target.value)} /></Modal>
    <Modal isOpen={preview} title="Xem trước hóa đơn" size="lg" onClose={() => setPreview(false)} footer={<button type="button" className="o-btn o-btn-secondary" onClick={() => setPreview(false)}>Đóng</button>}>
      <div className="o-preview"><h3>{purchase ? 'HÓA ĐƠN MUA HÀNG' : 'HÓA ĐƠN BÁN HÀNG'}</h3><p>Số: {invoice?.name || 'Chưa cấp (nháp)'} · Ngày: {invoice?.invoiceDate} · Hạn: {invoice?.invoiceDateDue}</p>
        <p><strong>{purchase ? 'Bên mua' : 'Bên bán'}:</strong> Công ty Cổ phần Công nghệ ODOO VN · TP. Hồ Chí Minh · MST: 0312345678 <span className="text-muted">(thông tin mẫu)</span></p>
        <p><strong>{purchase ? 'Bên bán' : 'Bên mua'}:</strong> {selectedPartner?.name || '—'} · {[selectedPartner?.address,selectedPartner?.city].filter(Boolean).join(', ') || '—'} · MST: {selectedPartner?.vat || '—'}</p>
        <p className="text-muted">Bản xem trước theo dữ liệu đã lưu gần nhất.</p>
        <div className="o-table-wrapper"><table className="o-table w-100"><thead><tr><th>Hàng hóa</th><th>Số lượng</th><th>Đơn giá</th><th>Thuế</th></tr></thead><tbody>{(invoice?.lines || []).map(l => <tr key={l.id}><td>{productName(l.productId)}</td><td>{l.quantity}</td><td>{formatCurrency(l.priceUnit)}</td><td>{data.taxes.find(t => t.id === l.taxId)?.name || '—'}</td></tr>)}</tbody></table></div>
        <p>Tổng chưa thuế: {formatCurrency(invoice?.amountUntaxed)} · Thuế: {formatCurrency(invoice?.amountTax)} · <strong>Tổng: {formatCurrency(invoice?.amountTotal)}</strong></p></div>
    </Modal>
  </div>;
}
