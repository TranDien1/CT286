import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp, api } from '../context/AppContext';
import { TYPE_INFO, PAYMENT_TERMS, computeAmounts, isOverdue, overdueDays, sumItems } from '../backend/rules';
import { formatCurrency, formatDate, formatDateTime, todayStr, addDays } from '../utils/format';
import StatusBadge from '../components/common/StatusBadge';
import Modal, { ConfirmModal } from '../components/common/Modal';
import { ReadOnlyNotice } from '../components/common/PageHeader';

const SHOW_PRINT = !import.meta.env.VITE_ARTIFACT;
const COMPANY = { name: 'Công ty Cổ phần Công nghệ ODOO VN', address: 'TP. Hồ Chí Minh', taxCode: '0312345678' };

let lineSeq = 1;
const newKey = () => `l${lineSeq++}`;

const emptyForm = () => {
  const t = todayStr();
  return { partnerId: '', invoiceDate: t, invoiceDateDue: t, date: t, paymentTerms: 'Thanh toán ngay', notes: '' };
};

export default function InvoiceForm({ type }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const {
    db, call, isAccountant, isAdmin, partnerById, productById, taxById, userById, accountName, showToast
  } = useApp();

  const stored = isNew ? null : db.invoices.find(i => i.id === Number(id));
  const entryType = stored ? stored.entryType : type;
  const info = TYPE_INFO[entryType];
  const isSale = entryType === 'out_invoice';

  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState([]);
  const [partnerText, setPartnerText] = useState('');
  const [partnerOpen, setPartnerOpen] = useState(false);
  const partnerRef = useRef(null);
  const [tab, setTab] = useState('lines');
  const [confirm, setConfirm] = useState(null); // 'cancel' | 'reset'
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ date: todayStr(), memo: '' });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', content: '' });

  // Nạp lại form mỗi khi bản lưu thay đổi (lưu, ghi sổ, chuyển nháp, thanh toán...)
  useEffect(() => {
    if (!stored) return;
    setForm({
      partnerId: stored.partnerId, invoiceDate: stored.invoiceDate, invoiceDateDue: stored.invoiceDateDue,
      date: stored.date, paymentTerms: stored.paymentTerms, notes: stored.notes
    });
    setLines(stored.lines.map(l => ({ ...l, key: newKey() })));
    setPartnerText(partnerById(stored.partnerId)?.name || '');
  }, [stored]);

  useEffect(() => {
    const close = (e) => { if (partnerRef.current && !partnerRef.current.contains(e.target)) setPartnerOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!isNew && !stored) {
    return (
      <div className="o-page">
        <div className="o-card">
          <p>Không tìm thấy hóa đơn này.</p>
          <Link to={info.path} className="o-btn o-btn-secondary">Về danh sách</Link>
        </div>
      </div>
    );
  }
  if (stored && stored.entryType !== type) return <Navigate to={`${info.path}/${stored.id}`} replace />;
  if (isNew && !isAccountant) {
    return (
      <div className="o-page">
        <ReadOnlyNotice>Admin không được tạo hóa đơn.</ReadOnlyNotice>
        <Link to={info.path} className="o-btn o-btn-secondary">Về danh sách</Link>
      </div>
    );
  }

  const state = stored ? stored.state : 'draft';
  const paymentState = stored ? stored.paymentState : 'not_paid';
  const editable = isAccountant && state === 'draft';
  const overdue = isOverdue(stored);

  // Danh mục cho đúng loại hóa đơn (INV-03, INV-05, CAT-02, CAT-05)
  const typeTaxes = db.taxes.filter(t => t.typeTaxUse === info.taxUse);
  const activePartners = db.partners.filter(p => p.partnerType === info.partnerType && p.active);
  const partner = partnerById(form.partnerId);
  const query = partnerText.trim().toLowerCase();
  const filteredPartners = activePartners.filter(p => p.name.toLowerCase().includes(query));
  const exactPartner = activePartners.find(p => p.name.toLowerCase() === query);
  const savedProductIds = new Set((stored?.lines || []).map(l => l.productId));

  const live = computeAmounts(lines, db.taxes);
  const shown = stored && !editable ? { ...stored, taxGroups: computeAmounts(stored.lines, db.taxes).taxGroups } : live;
  const payments = stored ? db.payments.filter(p => p.invoiceId === stored.id) : [];
  const payEntries = db.paymentEntries.filter(e => payments.some(p => p.entryId === e.id));
  const creator = stored ? userById(stored.createdBy) : null;

  // ---------------- Thao tác trên form ----------------

  const defaultTax = (product) => {
    const id0 = product ? (isSale ? product.saleTaxId : product.purchaseTaxId) : null;
    return typeTaxes.find(t => t.id === id0) || typeTaxes.find(t => t.amount === 10) || typeTaxes[0];
  };

  const setField = (field, value) => setForm(prev => {
    const next = { ...prev, [field]: value };
    const term = PAYMENT_TERMS.find(t => t.label === next.paymentTerms);
    if (field === 'invoiceDate' && value) {
      if (term) next.invoiceDateDue = addDays(value, term.days);
      if (prev.date === prev.invoiceDate || prev.date < value) next.date = value;
    }
    if (field === 'paymentTerms' && term && next.invoiceDate) next.invoiceDateDue = addDays(next.invoiceDate, term.days);
    return next;
  });

  const selectPartner = (p) => {
    setForm(prev => ({ ...prev, partnerId: p.id }));
    setPartnerText(p.name);
    setPartnerOpen(false);
  };

  const createPartnerInline = () => {
    const res = call(api.savePartner, [{ name: partnerText, partnerType: info.partnerType }],
      r => `Đã thêm ${info.partnerLabel.toLowerCase()} ${r.partner.name}.`);
    if (res.ok) selectPartner(res.partner);
  };

  const addLine = () => {
    const tax = defaultTax(null);
    setLines(prev => [...prev, { key: newKey(), productId: '', quantity: 1, priceUnit: '', taxId: tax ? tax.id : '' }]);
  };

  const updateLine = (key, field, value) => setLines(prev => prev.map(l => {
    if (l.key !== key) return l;
    const next = { ...l, [field]: value };
    if (field === 'productId') {
      const p = productById(value);
      if (p) {
        next.priceUnit = isSale ? p.listPrice : p.standardPrice;
        const tax = defaultTax(p);
        next.taxId = tax ? tax.id : '';
      }
    }
    return next;
  }));

  const removeLine = (key) => setLines(prev => prev.filter(l => l.key !== key));
  const payload = () => ({ ...form, lines });

  const save = () => {
    if (isNew) {
      const res = call(api.createInvoice, [entryType, payload()], 'Đã lưu hóa đơn nháp.');
      if (res.ok) navigate(`${info.path}/${res.invoice.id}`, { replace: true });
      return res;
    }
    return call(api.updateInvoice, [stored.id, payload()], 'Đã lưu thay đổi.');
  };

  // Ghi sổ: lưu những gì đang sửa trên form rồi ghi sổ
  const post = () => {
    const saved = call(api.updateInvoice, [stored.id, payload()]);
    if (saved.ok) call(api.postInvoice, [stored.id], r => `Đã ghi sổ hóa đơn ${r.invoice.name}.`);
  };

  const doConfirm = () => {
    if (confirm === 'cancel') call(api.cancelInvoice, [stored.id], 'Đã hủy hóa đơn.');
    if (confirm === 'reset') call(api.resetToDraft, [stored.id], 'Đã chuyển hóa đơn về nháp.');
    setConfirm(null);
  };

  const openPay = () => { setPayForm({ date: todayStr(), memo: '' }); setPayOpen(true); };
  const pay = () => {
    const res = call(api.registerPayment, [{ invoiceId: stored.id, date: payForm.date, memo: payForm.memo, paymentType: info.paymentType }],
      r => `Đã lập ${isSale ? 'phiếu thu' : 'phiếu chi'} ${r.payment.name}.`);
    if (res.ok) { setPayOpen(false); setTab('payments'); }
  };

  const openEmail = () => {
    setEmailForm({
      to: partner?.email || '',
      subject: `Hóa đơn ${stored.name} - ${COMPANY.name}`,
      content: `Kính gửi ${partner?.name || 'Quý khách'},\n\nChúng tôi gửi Quý khách hóa đơn số ${stored.name} ngày ${formatDate(stored.invoiceDate)}, tổng số tiền ${formatCurrency(stored.amountTotal)}.\nHạn thanh toán: ${formatDate(stored.invoiceDateDue)}.\n\nTrân trọng.`
    });
    setEmailOpen(true);
  };

  // ---------------- Hiển thị ----------------

  const title = stored?.name || (isNew ? `${info.label} mới` : state === 'cancel' ? `${info.label} (chưa cấp số)` : `${info.label} nháp`);
  const productOption = (p) => (p.active ? p.name : `${p.name} (ngừng hoạt động)`);

  return (
    <div className="o-page">
      <div className="o-page-header">
        <div className="o-breadcrumb"><Link to={info.path}>{info.plural}</Link> / {title}</div>
      </div>

      {isAdmin && <ReadOnlyNotice />}
      {state === 'cancel' && (
        <div className="o-notice o-notice-muted">Hóa đơn đã hủy: không thể sửa, khôi phục hay ghi sổ lại. Nếu hủy nhầm, hãy tạo hóa đơn nháp mới.</div>
      )}
      {state === 'draft' && stored?.name && (
        <div className="o-notice o-notice-info">Hóa đơn đã chuyển về nháp. Khi ghi sổ lại sẽ giữ nguyên số <strong>{stored.name}</strong>.</div>
      )}
      {paymentState === 'paid' && state === 'posted' && (
        <div className="o-notice o-notice-success">Hóa đơn đã thanh toán. Chưa hỗ trợ chỉnh sửa hoặc hủy hóa đơn đã thanh toán.</div>
      )}
      {overdue && (
        <div className="o-notice o-notice-error">Hóa đơn đã quá hạn thanh toán {overdueDays(stored)} ngày (hạn {formatDate(stored.invoiceDateDue)}).</div>
      )}

      <div className="o-card">
        <div className="o-form-status-bar">
          <div className="o-header-actions">
            {isAccountant && isNew && <button type="button" className="o-btn o-btn-primary" onClick={save}>Lưu nháp</button>}
            {isAccountant && !isNew && state === 'draft' && (
              <>
                <button type="button" className="o-btn o-btn-secondary" onClick={save}>Lưu</button>
                <button type="button" className="o-btn o-btn-primary" onClick={post}>Ghi sổ</button>
                <button type="button" className="o-btn o-btn-danger" onClick={() => setConfirm('cancel')}>Hủy hóa đơn</button>
              </>
            )}
            {isAccountant && state === 'posted' && paymentState === 'not_paid' && (
              <>
                <button type="button" className="o-btn o-btn-primary" onClick={openPay}>{isSale ? 'Lập phiếu thu' : 'Lập phiếu chi'}</button>
                <button type="button" className="o-btn o-btn-secondary" onClick={() => setConfirm('reset')}>Chuyển về nháp</button>
              </>
            )}
            {isAccountant && stored && isSale && state === 'posted' && <button type="button" className="o-btn o-btn-secondary" onClick={openEmail}>Gửi email</button>}
            {stored && <button type="button" className="o-btn o-btn-secondary" onClick={() => setPreviewOpen(true)}>Xem trước</button>}
          </div>

          <div className="o-pipeline" aria-label="Trạng thái">
            {state === 'cancel' ? (
              <span className="o-status-step active">Đã hủy</span>
            ) : (
              <>
                <span className={`o-status-step ${state === 'draft' ? 'active' : 'done'}`}>Nháp</span>
                <span className="o-pipeline-sep" aria-hidden="true">›</span>
                <span className={`o-status-step ${state === 'posted' && paymentState === 'not_paid' ? 'active' : paymentState === 'paid' ? 'done' : ''}`}>Đã ghi sổ</span>
                <span className="o-pipeline-sep" aria-hidden="true">›</span>
                <span className={`o-status-step ${paymentState === 'paid' ? 'active' : ''}`}>Đã thanh toán</span>
              </>
            )}
          </div>
        </div>

        <div className="o-form-title-row">
          <h2 className="o-form-header">
            {title}{' '}
            {stored && <StatusBadge status={state} />}{' '}
            {state === 'posted' && <StatusBadge status={paymentState} />}{' '}
            {overdue && <StatusBadge status="overdue" />}
          </h2>
          {stored && (
            <span className="text-muted o-meta">Người tạo: {creator?.fullName || '—'} · {formatDateTime(stored.createdAt)}</span>
          )}
        </div>

        <div className="o-form-grid">
          <div className="o-form-section">
            <div className="o-form-group" ref={partnerRef} style={{ position: 'relative' }}>
              <label className="d-block text-muted" htmlFor="partner">{info.partnerLabel} *</label>
              <input
                id="partner" type="text" className="w-100 p-1" autoComplete="off"
                placeholder={`Chọn ${info.partnerLabel.toLowerCase()}...`}
                value={partnerText} disabled={!editable}
                onFocus={() => editable && setPartnerOpen(true)}
                onChange={e => {
                  const val = e.target.value;
                  setPartnerText(val);
                  setPartnerOpen(true);
                  const match = activePartners.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                  setForm(prev => ({ ...prev, partnerId: match ? match.id : '' }));
                }}
              />
              {partnerOpen && editable && (
                <div className="o-combo-menu" role="listbox">
                  {filteredPartners.map(p => (
                    <div key={p.id} role="option" aria-selected={Number(form.partnerId) === p.id}
                      className={`o-combo-item ${Number(form.partnerId) === p.id ? 'selected' : ''}`}
                      onMouseDown={() => selectPartner(p)}>
                      <strong>{p.name}</strong>
                      {p.city && <span className="text-muted o-meta">{p.city}</span>}
                    </div>
                  ))}
                  {query && !exactPartner && (
                    <div className="o-combo-item o-combo-create" onMouseDown={createPartnerInline}>
                      Thêm {info.partnerLabel.toLowerCase()} mới "{partnerText.trim()}"
                    </div>
                  )}
                  {filteredPartners.length === 0 && !query && <div className="o-combo-empty">Chưa có đối tác đang hoạt động.</div>}
                </div>
              )}
              {editable && query && !form.partnerId && !partnerOpen && (
                <div className="o-field-error">Chọn {info.partnerLabel.toLowerCase()} trong danh sách hoặc thêm mới.</div>
              )}
              {partner && !partner.active && <div className="o-field-hint">Đối tác này đã ngừng hoạt động.</div>}
            </div>

            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="invoiceDate">Ngày hóa đơn *</label>
                <input id="invoiceDate" type="date" className="w-100 p-1" value={form.invoiceDate}
                  onChange={e => setField('invoiceDate', e.target.value)} disabled={!editable} />
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="date">Ngày hạch toán *</label>
                <input id="date" type="date" className="w-100 p-1" value={form.date} min={form.invoiceDate}
                  onChange={e => setField('date', e.target.value)} disabled={!editable} />
              </div>
            </div>
            {editable && form.date && form.invoiceDate && form.date < form.invoiceDate && (
              <div className="o-field-error">Ngày hạch toán phải bằng hoặc sau ngày hóa đơn.</div>
            )}
          </div>

          <div className="o-form-section">
            <div className="o-form-row">
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="paymentTerms">Điều khoản thanh toán</label>
                <select id="paymentTerms" className="w-100 p-1" value={form.paymentTerms}
                  onChange={e => setField('paymentTerms', e.target.value)} disabled={!editable}>
                  {PAYMENT_TERMS.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                  {form.paymentTerms && !PAYMENT_TERMS.some(t => t.label === form.paymentTerms) && <option value={form.paymentTerms}>{form.paymentTerms}</option>}
                </select>
              </div>
              <div className="o-form-group">
                <label className="d-block text-muted" htmlFor="invoiceDateDue">Hạn thanh toán *</label>
                <input id="invoiceDateDue" type="date" className="w-100 p-1" value={form.invoiceDateDue} min={form.invoiceDate}
                  onChange={e => setField('invoiceDateDue', e.target.value)} disabled={!editable} />
              </div>
            </div>
            {editable && form.invoiceDateDue && form.invoiceDate && form.invoiceDateDue < form.invoiceDate && (
              <div className="o-field-error">Hạn thanh toán không được trước ngày hóa đơn.</div>
            )}
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="notes">Ghi chú</label>
              <textarea id="notes" className="w-100 p-1" rows="2" value={form.notes}
                onChange={e => setField('notes', e.target.value)} disabled={!editable} />
            </div>
          </div>
        </div>

        <div className="o-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'lines'} className={`o-tab ${tab === 'lines' ? 'active' : ''}`} onClick={() => setTab('lines')}>
            Dòng hàng ({lines.length})
          </button>
          {stored && (
            <>
              <button type="button" role="tab" aria-selected={tab === 'journal'} className={`o-tab ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>
                Bút toán
              </button>
              <button type="button" role="tab" aria-selected={tab === 'payments'} className={`o-tab ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>
                {isSale ? 'Phiếu thu' : 'Phiếu chi'} ({payments.length})
              </button>
            </>
          )}
        </div>

        {tab === 'lines' && (
          <div>
            <div className="o-invoice-lines">
              <table className="o-table w-100">
                <thead>
                  <tr>
                    <th>Sản phẩm *</th>
                    <th style={{ width: 90 }}>Số lượng *</th>
                    <th style={{ width: 150 }}>Đơn giá (chưa thuế)</th>
                    <th style={{ width: 170 }}>Thuế *</th>
                    <th className="text-right" style={{ width: 130 }}>Tiền thuế</th>
                    <th className="text-right" style={{ width: 140 }}>Thành tiền</th>
                    {editable && <th style={{ width: 60 }} aria-label="Thao tác" />}
                  </tr>
                </thead>
                <tbody>
                  {live.lines.map(line => {
                    const options = editable
                      ? db.products.filter(p => p.active || (p.id === Number(line.productId) && savedProductIds.has(p.id)))
                      : db.products;
                    return (
                      <tr key={line.key}>
                        <td>
                          <select className="w-100 p-1" aria-label="Sản phẩm" value={line.productId}
                            onChange={e => updateLine(line.key, 'productId', e.target.value)} disabled={!editable}>
                            <option value="">Chọn sản phẩm...</option>
                            {options.map(p => <option key={p.id} value={p.id}>{productOption(p)}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="number" min="0" step="any" className="w-100 p-1" aria-label="Số lượng" value={line.quantity}
                            onChange={e => updateLine(line.key, 'quantity', e.target.value)} disabled={!editable} />
                        </td>
                        <td>
                          <input type="number" min="0" step="1" className="w-100 p-1" aria-label="Đơn giá" value={line.priceUnit}
                            onChange={e => updateLine(line.key, 'priceUnit', e.target.value)} disabled={!editable} />
                        </td>
                        <td>
                          <select className="w-100 p-1" aria-label="Thuế" value={line.taxId}
                            onChange={e => updateLine(line.key, 'taxId', e.target.value)} disabled={!editable}>
                            <option value="">Chọn thuế...</option>
                            {(editable ? typeTaxes : db.taxes).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td className="text-right num">{formatCurrency(line.taxAmount)}</td>
                        <td className="text-right num"><strong>{formatCurrency(line.subtotal)}</strong></td>
                        {editable && <td><button type="button" className="o-btn o-btn-sm o-btn-secondary" onClick={() => removeLine(line.key)}>Xóa</button></td>}
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr><td colSpan={editable ? 7 : 6} className="o-empty-cell">Chưa có dòng hàng nào.{editable && ' Bấm "Thêm dòng" để bắt đầu.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {editable && <button type="button" className="o-btn o-btn-sm o-btn-secondary mt-1" onClick={addLine}>Thêm dòng</button>}

            <div className="o-totals-wrap">
              <div className="o-totals-box">
                <div className="o-total-line"><span>Cộng tiền hàng (chưa thuế)</span><span className="num">{formatCurrency(shown.amountUntaxed)}</span></div>
                {shown.taxGroups.map(g => (
                  <div key={g.tax.id} className="o-total-line text-muted"><span>{g.tax.name}</span><span className="num">{formatCurrency(g.amount)}</span></div>
                ))}
                <div className="o-total-line"><span>Tổng tiền thuế</span><span className="num">{formatCurrency(shown.amountTax)}</span></div>
                <div className="o-total-line o-total-grand"><span>Tổng cộng</span><span className="num">{formatCurrency(shown.amountTotal)}</span></div>
                {state === 'posted' && (
                  <div className={`o-total-line o-total-due ${paymentState === 'paid' ? 'text-success' : 'text-danger'}`}>
                    <span>{isSale ? 'Còn phải thu' : 'Còn phải trả'}</span>
                    <span className="num">{formatCurrency(paymentState === 'paid' ? 0 : shown.amountTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'journal' && stored && (
          <div className="o-stack">
            <EntryTable
              title={`${stored.name || 'Chưa cấp số'} · Sổ ${info.code}`}
              subtitle={`Ngày hạch toán ${formatDate(stored.date)} · ${state === 'posted' ? 'Đã ghi sổ' : state === 'cancel' ? 'Đã hủy' : 'Nháp, chưa ghi sổ'}`}
              partnerName={partner?.name}
              items={stored.items}
              accountName={accountName}
            />
            {payEntries.map(e => (
              <EntryTable key={e.id} title={`${e.name} · Sổ tiền mặt`} subtitle={`Ngày hạch toán ${formatDate(e.date)} · Đã ghi sổ`}
                partnerName={partnerById(e.partnerId)?.name} items={e.items} accountName={accountName} />
            ))}
          </div>
        )}

        {tab === 'payments' && stored && (
          payments.length === 0 ? (
            <div className="o-empty-block">
              {state === 'posted'
                ? `Chưa có ${isSale ? 'phiếu thu' : 'phiếu chi'}. Thanh toán một lần toàn bộ số tiền của hóa đơn.`
                : 'Chỉ lập phiếu thu/chi cho hóa đơn đã ghi sổ và chưa thanh toán.'}
            </div>
          ) : (
            <div className="o-table-wrapper">
              <table className="o-table w-100">
                <thead>
                  <tr><th>Số chứng từ</th><th>Ngày</th><th>Đối tác</th><th>Hóa đơn</th><th>Sổ</th><th className="text-right">Số tiền</th><th>Đối soát</th></tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{formatDate(p.date)}</td>
                      <td>{partnerById(p.partnerId)?.name}</td>
                      <td>{stored.name}</td>
                      <td>Tiền mặt</td>
                      <td className="text-right num">{formatCurrency(p.amount)}</td>
                      <td><StatusBadge status="reconciled" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        title={confirm === 'cancel' ? 'Hủy hóa đơn?' : 'Chuyển về nháp?'}
        message={confirm === 'cancel'
          ? 'Hóa đơn sẽ chuyển sang trạng thái Đã hủy. Sau khi hủy không thể sửa, khôi phục hay ghi sổ lại.'
          : `Hóa đơn sẽ trở về nháp để sửa hoặc hủy. Khi ghi sổ lại vẫn giữ số ${stored?.name || ''}.`}
        confirmLabel={confirm === 'cancel' ? 'Hủy hóa đơn' : 'Chuyển về nháp'}
        danger={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
      />

      {stored && (
        <Modal
          isOpen={payOpen}
          onClose={() => setPayOpen(false)}
          title={isSale ? 'Lập phiếu thu' : 'Lập phiếu chi'}
          footer={(
            <>
              <button type="button" className="o-btn o-btn-secondary" onClick={() => setPayOpen(false)}>Đóng</button>
              <button type="button" className="o-btn o-btn-primary" onClick={pay}>Xác nhận {isSale ? 'thu tiền' : 'chi tiền'}</button>
            </>
          )}
        >
          <dl className="o-dl">
            <dt>Loại phiếu</dt><dd>{isSale ? 'Phiếu thu' : 'Phiếu chi'}</dd>
            <dt>Đối tác</dt><dd>{partner?.name}</dd>
            <dt>Hóa đơn</dt><dd>{stored.name}</dd>
            <dt>Số tiền</dt><dd><strong className="num">{formatCurrency(stored.amountTotal)}</strong></dd>
            <dt>Sổ</dt><dd>Tiền mặt (TK 111)</dd>
            <dt>Hạch toán</dt><dd>{isSale ? 'Nợ 111 / Có 131' : 'Nợ 331 / Có 111'}</dd>
          </dl>
          <p className="text-muted o-meta">Thanh toán một lần toàn bộ số tiền còn phải {isSale ? 'thu' : 'trả'}. Không trả thiếu, trả thừa và không tính phí phạt.</p>
          <div className="o-form-group">
            <label className="d-block text-muted" htmlFor="payDate">Ngày {isSale ? 'thu' : 'chi'}</label>
            <input id="payDate" type="date" className="w-100 p-1" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
          </div>
          <div className="o-form-group">
            <label className="d-block text-muted" htmlFor="payMemo">Ghi chú</label>
            <input id="payMemo" className="w-100 p-1" value={payForm.memo} placeholder={`Thanh toán ${stored.name}`} onChange={e => setPayForm({ ...payForm, memo: e.target.value })} />
          </div>
        </Modal>
      )}

      {stored && (
        <Modal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Xem trước hóa đơn"
          size="lg"
          footer={(
            <>
              <button type="button" className="o-btn o-btn-secondary" onClick={() => setPreviewOpen(false)}>Đóng</button>
              {SHOW_PRINT && <button type="button" className="o-btn o-btn-primary" onClick={() => window.print()}>In / Xuất PDF</button>}
            </>
          )}
        >
          <InvoicePreview inv={stored} isSale={isSale} partner={partner} db={db} productById={productById} taxById={taxById} />
        </Modal>
      )}

      {stored && (
        <Modal
          isOpen={emailOpen}
          onClose={() => setEmailOpen(false)}
          title="Gửi hóa đơn qua email"
          footer={(
            <>
              <button type="button" className="o-btn o-btn-secondary" onClick={() => setEmailOpen(false)}>Đóng</button>
              <button type="button" className="o-btn o-btn-primary" onClick={() => { showToast('Bản demo chưa nối máy chủ email nên chưa gửi thật.', 'warning'); setEmailOpen(false); }}>Gửi</button>
            </>
          )}
        >
          <div className="o-stack">
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="emailTo">Người nhận</label>
              <input id="emailTo" type="email" className="w-100 p-1" value={emailForm.to} onChange={e => setEmailForm({ ...emailForm, to: e.target.value })} />
            </div>
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="emailSubject">Tiêu đề</label>
              <input id="emailSubject" className="w-100 p-1" value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} />
            </div>
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="emailContent">Nội dung</label>
              <textarea id="emailContent" className="w-100 p-1" rows="6" value={emailForm.content} onChange={e => setEmailForm({ ...emailForm, content: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Bảng bút toán: đối tác lấy từ phần đầu chứng từ (INV-13, REP-04), không lưu trên từng dòng.
export function EntryTable({ title, subtitle, partnerName, items, accountName }) {
  const { debit, credit } = sumItems(items);
  return (
    <div className="o-entry">
      <div className="o-entry-head">
        <strong>{title}</strong>
        <span className="text-muted o-meta">{subtitle}</span>
      </div>
      <div className="o-table-wrapper">
        <table className="o-table w-100">
          <thead>
            <tr><th>Tài khoản</th><th>Đối tác</th><th>Diễn giải</th><th className="text-right">Nợ</th><th className="text-right">Có</th><th>Đối soát</th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td><strong>{it.accountCode}</strong> <span className="text-muted">{accountName(it.accountCode)}</span></td>
                <td>{partnerName || '—'}</td>
                <td>{it.label}{it.displayType === 'product' && it.quantity ? ` × ${it.quantity}` : ''}</td>
                <td className="text-right num">{it.debit ? formatCurrency(it.debit) : ''}</td>
                <td className="text-right num">{it.credit ? formatCurrency(it.credit) : ''}</td>
                <td>{['131', '331'].includes(it.accountCode) ? <StatusBadge status={it.reconciled ? 'reconciled' : 'open'} /> : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="o-entry-total">
              <td colSpan={3}><strong>Tổng</strong> <span className={debit === credit ? 'text-success' : 'text-danger'}>({debit === credit ? 'cân' : 'không cân'})</span></td>
              <td className="text-right num"><strong>{formatCurrency(debit)}</strong></td>
              <td className="text-right num"><strong>{formatCurrency(credit)}</strong></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function InvoicePreview({ inv, isSale, partner, db, productById, taxById }) {
  const computed = computeAmounts(inv.lines, db.taxes);
  const seller = isSale ? COMPANY : { name: partner?.name, address: [partner?.address, partner?.city].filter(Boolean).join(', '), taxCode: partner?.taxCode };
  const buyer = isSale ? { name: partner?.name, address: [partner?.address, partner?.city].filter(Boolean).join(', '), taxCode: partner?.taxCode } : COMPANY;
  return (
    <div className="o-preview">
      {inv.state !== 'posted' && <div className="o-preview-watermark" aria-hidden="true">{inv.state === 'cancel' ? 'ĐÃ HỦY' : 'BẢN NHÁP'}</div>}
      <div className="o-preview-head">
        <div>
          <h3>{isSale ? 'HÓA ĐƠN BÁN HÀNG' : 'HÓA ĐƠN MUA HÀNG'}</h3>
          <div className="text-muted o-meta">Sổ {inv.journalCode}</div>
        </div>
        <div className="text-right">
          <div><strong>Số: {inv.name || 'Chưa cấp (nháp)'}</strong></div>
          <div className="text-muted o-meta">Ngày hóa đơn: {formatDate(inv.invoiceDate)}</div>
          <div className="text-muted o-meta">Hạn thanh toán: {formatDate(inv.invoiceDateDue)}</div>
        </div>
      </div>
      <div className="o-grid-2 o-preview-parties">
        <div><div className="o-label">Bên bán</div><strong>{seller.name}</strong><div>{seller.address || '—'}</div><div>MST: {seller.taxCode || '—'}</div></div>
        <div><div className="o-label">Bên mua</div><strong>{buyer.name}</strong><div>{buyer.address || '—'}</div><div>MST: {buyer.taxCode || '—'}</div></div>
      </div>
      <div className="o-table-wrapper">
        <table className="o-table w-100">
          <thead><tr><th>STT</th><th>Hàng hóa, dịch vụ</th><th className="text-right">Số lượng</th><th className="text-right">Đơn giá</th><th className="text-right">Thuế</th><th className="text-right">Thành tiền</th></tr></thead>
          <tbody>
            {computed.lines.map((l, i) => (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td>{productById(l.productId)?.name}</td>
                <td className="text-right num">{l.quantity}</td>
                <td className="text-right num">{formatCurrency(l.priceUnit)}</td>
                <td className="text-right">{taxById(l.taxId)?.amount}%</td>
                <td className="text-right num">{formatCurrency(l.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="o-totals-wrap">
        <div className="o-totals-box plain">
          <div className="o-total-line"><span>Cộng tiền hàng</span><span className="num">{formatCurrency(inv.amountUntaxed)}</span></div>
          <div className="o-total-line"><span>Tiền thuế GTGT</span><span className="num">{formatCurrency(inv.amountTax)}</span></div>
          <div className="o-total-line o-total-grand"><span>Tổng thanh toán</span><span className="num">{formatCurrency(inv.amountTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}
