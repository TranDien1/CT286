import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { PAYMENT_INFO, TYPE_INFO } from '../backend/rules';
import { formatCurrency, formatDate, todayStr } from '../utils/format';
import { reportPeriod } from '../utils/reportPeriod';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';

// Mục 5 + REP-05: danh sách phiếu thu/chi; lập phiếu từ hóa đơn đã ghi sổ, chưa thanh toán.
export default function Payments() {
  const { request, showToast, isAccountant } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [params, setParams] = useSearchParams();
  const typeFilter = params.get('type') || '';
  const [search, setSearch] = useState('');
  const [periodMode, setPeriodMode] = useState('all');
  const [day, setDay] = useState('');
  const [week, setWeek] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ paymentType: 'inbound', partnerId: '', invoiceId: '', date: todayStr() });
  const periodValue = { day, week, month, year }[periodMode] || '';
  const period = reportPeriod(periodMode, periodValue);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    Promise.all([request('/payments'),request('/invoices?type=out_invoice'),request('/invoices?type=in_invoice'),request('/accounting-config')])
      .then(([payments,sales,purchases,config]) => { if (!cancelled) setData({ payments, invoices: [...sales,...purchases], config }); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reload]);
  const rows = (data?.payments || []).filter(p => !typeFilter || p.paymentType === typeFilter);
  const filtered = rows.filter(r => {
    const s = search.trim().toLowerCase();
    const matchSearch = !s || (r.name || '').toLowerCase().includes(s) || (r.partner?.name || '').toLowerCase().includes(s) || (r.invoiceName || '').toLowerCase().includes(s);
    const matchPeriod = period !== undefined && (!period || (r.paymentDate >= period.from && r.paymentDate <= period.to));
    return matchSearch && matchPeriod;
  });
  const totalInbound = filtered.filter(r => r.paymentType === 'inbound').reduce((s, r) => s + r.amount, 0);
  const totalOutbound = filtered.filter(r => r.paymentType === 'outbound').reduce((s, r) => s + r.amount, 0);

  // Danh sách chọn trong hộp thoại: chỉ hóa đơn đúng loại, đã ghi sổ, chưa thanh toán (PAY-01, PAY-04, PAY-12)
  const invType = PAYMENT_INFO[form.paymentType].invoiceType;
  const openInvoices = (data?.invoices || []).filter(i => i.entryType === invType && i.state === 'posted' && i.paymentState === 'not_paid' && i.amountTotal > 0);
  const partnerOptions = [...new Map(openInvoices.filter(i => i.partner).map(i => [i.partner.id,i.partner])).values()];
  const invoiceOptions = openInvoices.filter(i => !form.partnerId || i.partner?.id === Number(form.partnerId));
  const selected = data?.invoices.find(i => i.id === Number(form.invoiceId));
  const cashCode = data?.config.journals.find(j => j.code === 'CSH')?.defaultAccount?.code || 'chưa cấu hình';

  const openDialog = (paymentType = 'inbound') => {
    setForm({ paymentType, partnerId: '', invoiceId: '', date: todayStr() });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.invoiceId || !form.date || pending.current) return;
    pending.current = true; setSaving(true);
    try {
      const payment = await request('/payments', { method: 'POST', body: { invoiceId: Number(form.invoiceId), paymentDate: form.date } });
      showToast(`Đã lập ${PAYMENT_INFO[payment.paymentType].label.toLowerCase()} ${payment.name}.`);
      setOpen(false); navigate(`/payments/${payment.id}`);
    } catch (err) { showToast(err.message, 'warning'); }
    finally { pending.current = false; setSaving(false); }
  };

  const columns = [
    { key: 'name', label: 'Số chứng từ', sortable: true, render: r => <Link to={`/payments/${r.id}`}><strong>{r.name}</strong></Link> },
    { key: 'paymentType', label: 'Loại', render: r => <StatusBadge status={r.paymentType} /> },
    { key: 'paymentDate', label: 'Ngày', sortable: true, render: r => formatDate(r.paymentDate) },
    { key: 'partner', label: 'Đối tác', sortable: true, sortValue: r => r.partner?.name, render: r => r.partner?.name },
    { key: 'invoice', label: 'Hóa đơn liên quan', render: r => <Link to={`${r.invoiceType === 'out_invoice' ? '/invoices' : '/bills'}/${r.invoiceId}`} onClick={e => e.stopPropagation()}>{r.invoiceName || '—'}</Link> },
    { key: 'journal', label: 'Sổ', render: r => r.journal?.name || '—' },
    { key: 'amount', label: 'Số tiền', sortable: true, className: 'text-right num', render: r => formatCurrency(r.amount) },
    { key: 'createdBy', label: 'Người lập', render: r => r.createdBy?.name || '—' }
  ];

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb="Thu chi"
        title="Phiếu thu và phiếu chi"
        actions={isAccountant && (
          <>
            <button type="button" className="o-btn o-btn-primary" disabled={!data || saving} onClick={() => openDialog('inbound')}>Lập phiếu thu</button>
            <button type="button" className="o-btn o-btn-secondary" disabled={!data || saving} onClick={() => openDialog('outbound')}>Lập phiếu chi</button>
          </>
        )}
      />

      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
      {!data && !error && <p>Đang tải phiếu thu/chi từ SQL Server…</p>}
      {data && <><div className="o-toolbar">
        <input type="search" className="o-search" aria-label="Tìm phiếu" placeholder="Tìm theo số phiếu, đối tác hoặc hóa đơn..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="o-chip-group" role="group" aria-label="Lọc loại phiếu">
          {[['', 'Tất cả'], ['inbound', 'Phiếu thu'], ['outbound', 'Phiếu chi']].map(([k, label]) => (
            <button key={k} type="button" className={`o-chip ${typeFilter === k ? 'active' : ''}`}
              onClick={() => setParams(k ? { type: k } : {})}>{label}</button>
          ))}
        </div>
      </div>

      <div className="o-toolbar">
        <label htmlFor="paymentPeriod">Lọc theo ngày thanh toán</label>
        <select id="paymentPeriod" value={periodMode} onChange={e => setPeriodMode(e.target.value)}>
          <option value="all">Tất cả thời gian</option><option value="day">Theo ngày</option>
          <option value="week">Theo tuần</option><option value="month">Theo tháng</option><option value="year">Theo năm</option>
        </select>
        {periodMode === 'day' && <><label htmlFor="paymentDay">Chọn ngày</label><input id="paymentDay" type="date" value={day} onChange={e => setDay(e.target.value)} /></>}
        {periodMode === 'week' && <><label htmlFor="paymentWeek">Chọn một ngày trong tuần</label><input id="paymentWeek" type="date" value={week} onChange={e => setWeek(e.target.value)} /></>}
        {periodMode === 'month' && <><label htmlFor="paymentMonth">Chọn tháng và năm</label><input id="paymentMonth" type="month" value={month} onChange={e => setMonth(e.target.value)} /></>}
        {periodMode === 'year' && <><label htmlFor="paymentYear">Chọn năm</label><input id="paymentYear" type="number" min="1000" max="9999" step="1" value={year} onChange={e => setYear(e.target.value)} /></>}
        {period && <span className="text-muted">Từ {formatDate(period.from)} đến {formatDate(period.to)}</span>}
      </div>
      {period === undefined && <p className="o-notice o-notice-info">Vui lòng chọn thời gian để lọc phiếu thu/chi.</p>}

      {period !== undefined && <><div className="o-summary-bar">
        <span>{filtered.length} phiếu</span>
        <span>Tổng thu: <strong className="num text-success">{formatCurrency(totalInbound)}</strong></span>
        <span>Tổng chi: <strong className="num text-danger">{formatCurrency(totalOutbound)}</strong></span>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="Chưa có phiếu thu/chi nào khớp bộ lọc." /></>}
      </>}

      <Modal
        isOpen={open}
        onClose={() => { if (!saving) setOpen(false); }}
        title={form.paymentType === 'inbound' ? 'Lập phiếu thu' : 'Lập phiếu chi'}
        footer={(
          <>
            <button type="button" className="o-btn o-btn-secondary" disabled={saving} onClick={() => setOpen(false)}>Đóng</button>
            <button type="button" className="o-btn o-btn-primary" onClick={submit} disabled={!form.invoiceId || !form.date || saving}>Xác nhận</button>
          </>
        )}
      >
        <div className="o-stack">
          <div className="o-form-group">
            <label className="d-block text-muted" htmlFor="pType">Loại phiếu</label>
            <select id="pType" className="w-100 p-1" value={form.paymentType}
              onChange={e => setForm({ ...form, paymentType: e.target.value, partnerId: '', invoiceId: '' })}>
              <option value="inbound">Phiếu thu (hóa đơn bán)</option>
              <option value="outbound">Phiếu chi (hóa đơn mua)</option>
            </select>
          </div>
          <div className="o-form-group">
            <label className="d-block text-muted" htmlFor="pPartner">{form.paymentType === 'inbound' ? 'Khách hàng' : 'Nhà cung cấp'}</label>
            <select id="pPartner" className="w-100 p-1" value={form.partnerId}
              onChange={e => setForm({ ...form, partnerId: e.target.value, invoiceId: '' })}>
              <option value="">Tất cả đối tác còn nợ</option>
              {partnerOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="o-form-group">
            <label className="d-block text-muted" htmlFor="pInvoice">Hóa đơn cần thanh toán *</label>
            <select id="pInvoice" className="w-100 p-1" value={form.invoiceId}
              onChange={e => {
                const inv = data?.invoices.find(i => i.id === Number(e.target.value));
                setForm({ ...form, invoiceId: e.target.value, partnerId: inv?.partner ? String(inv.partner.id) : form.partnerId });
              }}>
              <option value="">Chọn hóa đơn...</option>
              {invoiceOptions.map(i => (
                <option key={i.id} value={i.id}>{i.name} · {i.partner?.name} · {formatCurrency(i.amountTotal)}</option>
              ))}
            </select>
            {invoiceOptions.length === 0 && <div className="o-field-hint">Không có {TYPE_INFO[invType].label.toLowerCase()} nào đã ghi sổ và chưa thanh toán.</div>}
          </div>
          {selected && (
            <dl className="o-dl">
              <dt>Số tiền</dt><dd><strong className="num">{formatCurrency(selected.amountTotal)}</strong> (trả đủ một lần)</dd>
              <dt>Sổ</dt><dd>Tiền mặt (TK {cashCode})</dd>
              <dt>Hạch toán</dt><dd>{form.paymentType === 'inbound' ? `Nợ ${cashCode} / Có 131` : `Nợ 331 / Có ${cashCode}`}</dd>
            </dl>
          )}
          <div className="o-form-row">
            <div className="o-form-group">
              <label className="d-block text-muted" htmlFor="pDate">Ngày {form.paymentType === 'inbound' ? 'thu' : 'chi'}</label>
              <input id="pDate" type="date" className="w-100 p-1" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
