import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { TYPE_INFO } from '../backend/rules';
import { invoiceStatusKey } from '../backend/queries';
import { formatCurrency, formatDate, todayStr } from '../utils/format';
import { reportPeriod } from '../utils/reportPeriod';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'draft', label: 'Nháp' },
  { key: 'not_paid', label: 'Chưa thanh toán' },
  { key: 'overdue', label: 'Quá hạn' },
  { key: 'paid', label: 'Đã thanh toán' },
  { key: 'cancel', label: 'Đã hủy' }
];

export default function InvoiceList({ type }) {
  const info = TYPE_INFO[type];
  const navigate = useNavigate();
  const { request, downloadInvoicePdf, isAccountant, showToast } = useApp();
  const [sales, setSales] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [periodMode, setPeriodMode] = useState('all');
  const [day, setDay] = useState('');
  const [week, setWeek] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const today = todayStr();
  const periodValue = { day, week, month, year }[periodMode] || '';
  const period = reportPeriod(periodMode, periodValue);

  useEffect(() => {
    let cancelled = false;
    setSales(null); setLoadError('');
    request(`/invoices?type=${type}`).then(data => { if (!cancelled) setSales(data); })
      .catch(err => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, [type, reloadKey]);
  const rows = useMemo(() => (sales || [])
    .map(i => ({ ...i, status: invoiceStatusKey(i, today) }))
    .sort((a, b) => b.id - a.id), [today, sales]);

  const searchTerm = search.trim().toLowerCase();
  const baseRows = rows.filter(r => period !== undefined && (!period ||
    (r.invoiceDate >= period.from && r.invoiceDate <= period.to)) &&
    (!searchTerm || (r.name || '').toLowerCase().includes(searchTerm) ||
      (r.partner?.name || '').toLowerCase().includes(searchTerm)));
  const filtered = baseRows.filter(r => filter === 'all'
    || (filter === 'not_paid' ? ['not_paid', 'overdue'].includes(r.status) : r.status === filter));

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? baseRows.length
      : baseRows.filter(r => (f.key === 'not_paid' ? ['not_paid', 'overdue'].includes(r.status) : r.status === f.key)).length;
    return acc;
  }, {});

  const totalDue = filtered.filter(r => r.state === 'posted' && r.paymentState === 'not_paid').reduce((s, r) => s + r.amountTotal, 0);

  const downloadPdf = async (event, invoice) => {
    event.stopPropagation();
    if (downloadingId !== null) return;
    setDownloadingId(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id, type);
      showToast(`Đã tải PDF hóa đơn ${invoice.name}.`);
    } catch (error) { showToast(error.message, 'warning'); }
    finally { setDownloadingId(null); }
  };

  const columns = [
    { key: 'name', label: 'Số hóa đơn', sortable: true, sortValue: r => r.name || '', render: r => <strong>{r.name || 'Nháp (chưa cấp số)'}</strong> },
    { key: 'partner', label: info.partnerLabel, sortable: true, sortValue: r => r.partner?.name || '', render: r => r.partner?.name },
    { key: 'invoiceDate', label: 'Ngày hóa đơn', sortable: true, render: r => formatDate(r.invoiceDate) },
    { key: 'invoiceDateDue', label: 'Hạn thanh toán', sortable: true, render: r => formatDate(r.invoiceDateDue) },
    { key: 'amountTotal', label: 'Tổng tiền', sortable: true, className: 'text-right num', render: r => formatCurrency(r.amountTotal) },
    {
      key: 'due', label: type === 'out_invoice' ? 'Còn phải thu' : 'Còn phải trả', className: 'text-right num',
      sortable: true, sortValue: r => (r.state === 'posted' && r.paymentState === 'not_paid' ? r.amountTotal : 0),
      render: r => (r.state === 'posted' && r.paymentState === 'not_paid' ? formatCurrency(r.amountTotal) : '—')
    },
    { key: 'status', label: 'Trạng thái', render: r => <StatusBadge status={r.status} /> },
    { key: 'createdBy', label: 'Người tạo', render: r => r.createdBy?.name }
  ];
  if (isAccountant) columns.push({
    key: 'pdf', label: 'In hóa đơn',
    render: r => r.state === 'posted' ? <button type="button" className="o-btn o-btn-sm o-btn-secondary"
      disabled={downloadingId !== null} onClick={event => downloadPdf(event, r)}
      aria-label={`Tải PDF hóa đơn ${r.name}`}>
      {downloadingId === r.id ? 'Đang tải…' : 'Tải PDF'}
    </button> : '—'
  });

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb={type === 'out_invoice' ? 'Bán hàng' : 'Mua hàng'}
        title={info.plural}
        actions={isAccountant && <button className="o-btn o-btn-primary" onClick={() => navigate(`${info.path}/new`)}>Tạo {info.label.toLowerCase()}</button>}
      />

      {loadError && <div className="o-notice o-notice-error" role="alert">{loadError} <button type="button" className="o-link-btn" onClick={() => setReloadKey(k => k + 1)}>Thử lại</button></div>}
      {!sales && !loadError && <p>Đang tải hóa đơn từ SQL Server…</p>}
      {sales && <><div className="o-toolbar">
        <input
          type="search"
          className="o-search"
          aria-label="Tìm hóa đơn"
          placeholder={`Tìm theo số hóa đơn hoặc ${info.partnerLabel.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="o-chip-group" role="group" aria-label="Lọc theo trạng thái">
          {FILTERS.map(f => (
            <button key={f.key} type="button" className={`o-chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label} <span className="o-chip-count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="o-toolbar">
        <label htmlFor="invoicePeriod">Lọc theo ngày hóa đơn</label>
        <select id="invoicePeriod" value={periodMode} onChange={e => setPeriodMode(e.target.value)}>
          <option value="all">Tất cả thời gian</option><option value="day">Theo ngày</option>
          <option value="week">Theo tuần</option><option value="month">Theo tháng</option><option value="year">Theo năm</option>
        </select>
        {periodMode === 'day' && <><label htmlFor="invoiceDay">Chọn ngày</label><input id="invoiceDay" type="date" value={day} onChange={e => setDay(e.target.value)} /></>}
        {periodMode === 'week' && <><label htmlFor="invoiceWeek">Chọn một ngày trong tuần</label><input id="invoiceWeek" type="date" value={week} onChange={e => setWeek(e.target.value)} /></>}
        {periodMode === 'month' && <><label htmlFor="invoiceMonth">Chọn tháng và năm</label><input id="invoiceMonth" type="month" value={month} onChange={e => setMonth(e.target.value)} /></>}
        {periodMode === 'year' && <><label htmlFor="invoiceYear">Chọn năm</label><input id="invoiceYear" type="number" min="1000" max="9999" step="1" value={year} onChange={e => setYear(e.target.value)} /></>}
        {period && <span className="text-muted">Từ {formatDate(period.from)} đến {formatDate(period.to)}</span>}
      </div>
      {period === undefined && <p className="o-notice o-notice-info">Vui lòng chọn thời gian để lọc hóa đơn.</p>}
      {period && <p className="text-muted o-report-note">Lọc theo ngày hóa đơn; trạng thái và số tiền còn phải thu/trả là trạng thái hiện tại.</p>}

      {period !== undefined && <><div className="o-summary-bar">
        <span>{filtered.length} hóa đơn</span>
        <span>{type === 'out_invoice' ? 'Còn phải thu' : 'Còn phải trả'}: <strong className="num">{formatCurrency(totalDue)}</strong></span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={r => navigate(`${info.path}/${r.id}`)}
        emptyMessage="Không có hóa đơn nào khớp bộ lọc."
      /></>}
      </>}
    </div>
  );
}
