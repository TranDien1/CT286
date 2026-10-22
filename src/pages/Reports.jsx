import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { unpaidInvoices, overdueInvoices, paymentReport, invoicePath } from '../backend/queries';
import { isOverdue, TYPE_INFO } from '../backend/rules';
import { formatCurrency, formatDate } from '../utils/format';
import { reportPeriod, invoicesAsOf, overdueAsOf } from '../utils/reportPeriod';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';

const TABS = [
  { key: 'unpaid', label: 'Hóa đơn chưa thanh toán' },
  { key: 'debts', label: 'Công nợ' },
  { key: 'payments', label: 'Phiếu thu/chi' },
  { key: 'overdue', label: 'Hóa đơn quá hạn' }
];

// REP-01: cả Admin và Kế toán đều xem được báo cáo.
export default function Reports() {
  const { request } = useApp();
  const [db, setDb] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState('all');
  const [day, setDay] = useState('');
  const [week, setWeek] = useState('');
  const [month, setMonth] = useState('');
  const [debts, setDebts] = useState(null);
  const [debtError, setDebtError] = useState('');
  const period = reportPeriod(mode, mode === 'day' ? day : mode === 'week' ? week : month);
  useEffect(() => {
    let cancelled = false;
    setDb(null); setError('');
    Promise.all([request('/invoices?type=out_invoice'), request('/invoices?type=in_invoice'), request('/payments'), request('/partners')])
      .then(([sales, purchases, payments, partners]) => {
        if (cancelled) return;
        const invoices = [...sales, ...purchases].map(i => ({ ...i, partnerId: i.partner?.id, date: i.accountingDate, journalCode: i.journal?.code }));
        setDb({ invoices, payments: payments.map(p => ({ ...p, partnerId: p.partner?.id, date: p.paymentDate })), partners });
      }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reload]);
  useEffect(() => {
    let cancelled = false;
    setDebts(null); setDebtError('');
    if (period === undefined) return () => { cancelled = true; };
    request(`/reports/debts${period ? `?asOf=${encodeURIComponent(period.to)}` : ''}`)
      .then(rows => { if (!cancelled) setDebts(rows); })
      .catch(err => { if (!cancelled) setDebtError(err.message); });
    return () => { cancelled = true; };
  }, [reload, mode, period?.to]);
  const partnerById = id => db?.partners.find(p => p.id === id);
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.key === params.get('tab')) ? params.get('tab') : 'unpaid';
  const kind = params.get('kind') || '';
  const setTab = (key) => setParams(kind ? { tab: key, kind } : { tab: key });
  const setKind = (k) => setParams(k ? { tab, kind: k } : { tab });

  const invoiceLink = (r) => <Link to={invoicePath(r)}><strong>{r.name}</strong></Link>;
  const typeCol = { key: 'entryType', label: 'Loại', render: r => TYPE_INFO[r.entryType].label };
  const partnerCol = { key: 'partner', label: 'Đối tác', sortable: true, sortValue: r => partnerById(r.partnerId)?.name, render: r => partnerById(r.partnerId)?.name };

  const kindFilter = (
    <div className="o-chip-group" role="group" aria-label="Lọc loại">
      {[['', 'Tất cả'], ['out_invoice', 'Hóa đơn bán'], ['in_invoice', 'Hóa đơn mua']].map(([k, label]) => (
        <button key={k} type="button" className={`o-chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>{label}</button>
      ))}
    </div>
  );

  // REP-02
  const unpaid = useMemo(() => !db || period === undefined ? [] : period
    ? invoicesAsOf(db.invoices, db.payments, period.to, kind)
    : unpaidInvoices(db, kind || undefined), [db, kind, mode, period?.to]);
  // REP-06
  const overdue = useMemo(() => !db || period === undefined ? [] : period
    ? overdueAsOf(unpaid, period.to) : overdueInvoices(db, kind || undefined), [db, kind, mode, period?.to, unpaid]);
  // REP-03
  const receivable = useMemo(() => debts ? debts.filter(d => d.accountCode === '131') : [], [debts]);
  const payable = useMemo(() => debts ? debts.filter(d => d.accountCode === '331') : [], [debts]);
  // REP-05
  const pays = useMemo(() => !db || period === undefined ? [] : paymentReport(db)
    .filter(p => !period || (p.paymentDate >= period.from && p.paymentDate <= period.to)), [db, mode, period?.from, period?.to]);

  const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);

  return (
    <div className="o-page">
      <PageHeader breadcrumb="Báo cáo" title="Báo cáo" />
      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
      {!db && !error && <p>Đang tải dữ liệu báo cáo từ SQL Server…</p>}
      <div className="o-toolbar">
        <label htmlFor="reportPeriod">Kỳ báo cáo</label>
        <select id="reportPeriod" value={mode} onChange={e => setMode(e.target.value)}>
          <option value="all">Hiện tại / Tất cả</option><option value="day">Theo ngày</option><option value="week">Theo tuần</option><option value="month">Theo tháng</option>
        </select>
        {mode === 'day' && <><label htmlFor="reportDay">Chọn ngày</label><input id="reportDay" type="date" value={day} onChange={e => setDay(e.target.value)} /></>}
        {mode === 'week' && <><label htmlFor="reportWeek">Chọn một ngày trong tuần</label><input id="reportWeek" type="date" value={week} onChange={e => setWeek(e.target.value)} /></>}
        {mode === 'month' && <><label htmlFor="reportMonth">Chọn tháng và năm</label><input id="reportMonth" type="month" value={month} onChange={e => setMonth(e.target.value)} /></>}
        {period && <span>Kỳ: {formatDate(period.from)} – {formatDate(period.to)}</span>}
      </div>
      {period === undefined && <p className="o-notice o-notice-info">Vui lòng chọn thời gian báo cáo.</p>}
      {period && <p className="text-muted o-report-note">Công nợ và hóa đơn tính đến cuối {formatDate(period.to)}; thu/chi tính trong kỳ. Số liệu được dựng theo ngày hạch toán và ngày thanh toán hiện lưu, không phải bản chụp lịch sử ghi sổ.</p>}
      <div className="o-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`o-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {db && period !== undefined && tab === 'unpaid' && (
        <section className="o-stack">
          <p className="text-muted o-report-note">Hóa đơn đã ghi sổ và chưa thanh toán {period ? `đến cuối ${formatDate(period.to)}, bao gồm công nợ từ các kỳ trước` : 'hiện tại'}. Không gồm hóa đơn nháp hoặc đã hủy.</p>
          <div className="o-toolbar">{kindFilter}</div>
          <div className="o-summary-bar"><span>{unpaid.length} hóa đơn</span><span>Tổng còn nợ: <strong className="num">{formatCurrency(sum(unpaid, r => r.amountTotal))}</strong></span></div>
          <DataTable
            data={unpaid}
            emptyMessage="Không có hóa đơn nào chưa thanh toán."
            columns={[
              { key: 'name', label: 'Số hóa đơn', sortable: true, render: invoiceLink },
              typeCol, partnerCol,
              { key: 'invoiceDate', label: 'Ngày hóa đơn', sortable: true, render: r => formatDate(r.invoiceDate) },
              { key: 'invoiceDateDue', label: 'Hạn thanh toán', sortable: true, render: r => formatDate(r.invoiceDateDue) },
              { key: 'amountTotal', label: 'Số tiền', sortable: true, className: 'text-right num', render: r => formatCurrency(r.amountTotal) },
              { key: 'st', label: 'Tình trạng', render: r => <StatusBadge status={period ? (r.invoiceDateDue && r.invoiceDateDue < period.to ? 'overdue' : 'not_paid') : (isOverdue(r) ? 'overdue' : 'not_paid')} /> }
            ]}
          />
        </section>
      )}

      {period !== undefined && tab === 'debts' && (
        <section className="o-stack">
          <p className="text-muted o-report-note">{period ? 'Tính công nợ hóa đơn theo ngày hạch toán và phiếu thanh toán đến cuối kỳ, bao gồm công nợ kỳ trước.' : 'Tính từ các dòng công nợ chưa đối soát của bút toán đã ghi sổ.'}</p>
          {debtError && <div className="o-notice o-notice-error" role="alert">{debtError} <button type="button" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
          {!debts && !debtError && <p>Đang tải công nợ…</p>}
          {debts && <>
          <div className="o-grid-2">
            <DebtTable title="Phải thu khách hàng (TK 131)" rows={receivable} />
            <DebtTable title="Phải trả nhà cung cấp (TK 331)" rows={payable} />
          </div>
          </>}
        </section>
      )}

      {db && period !== undefined && tab === 'payments' && (
        <section className="o-stack">
          <div className="o-summary-bar">
            <span>Tổng thu: <strong className="num text-success">{formatCurrency(sum(pays.filter(p => p.paymentType === 'inbound'), p => p.amount))}</strong></span>
            <span>Tổng chi: <strong className="num text-danger">{formatCurrency(sum(pays.filter(p => p.paymentType === 'outbound'), p => p.amount))}</strong></span>
          </div>
          <DataTable
            data={pays}
            emptyMessage="Chưa có phiếu thu/chi."
            columns={[
              { key: 'name', label: 'Số chứng từ', sortable: true, render: r => <strong>{r.name}</strong> },
              { key: 'paymentType', label: 'Loại', render: r => <StatusBadge status={r.paymentType} /> },
              { key: 'partner', label: 'Đối tác', sortable: true, sortValue: r => r.partner?.name, render: r => r.partner?.name },
              { key: 'invoice', label: 'Hóa đơn liên quan', render: r => r.invoice && <Link to={invoicePath(r.invoice)}>{r.invoice.name}</Link> },
              { key: 'amount', label: 'Số tiền', sortable: true, className: 'text-right num', render: r => formatCurrency(r.amount) },
              { key: 'date', label: 'Ngày thanh toán', sortable: true, render: r => formatDate(r.date) }
            ]}
          />
        </section>
      )}

      {db && period !== undefined && tab === 'overdue' && (
        <section className="o-stack">
          <p className="text-muted o-report-note">Hóa đơn đã ghi sổ, chưa thanh toán và đã qua hạn {period ? `vào cuối ${formatDate(period.to)}` : 'hiện tại'} (đúng ngày đến hạn chưa tính là quá hạn).</p>
          <div className="o-toolbar">{kindFilter}</div>
          <div className="o-summary-bar"><span>{overdue.length} hóa đơn quá hạn</span><span>Tổng: <strong className="num text-danger">{formatCurrency(sum(overdue, r => r.amountTotal))}</strong></span></div>
          <DataTable
            data={overdue}
            emptyMessage="Không có hóa đơn quá hạn."
            columns={[
              { key: 'name', label: 'Số hóa đơn', sortable: true, render: invoiceLink },
              typeCol, partnerCol,
              { key: 'invoiceDateDue', label: 'Hạn thanh toán', sortable: true, render: r => formatDate(r.invoiceDateDue) },
              { key: 'overdueDays', label: 'Số ngày quá hạn', sortable: true, className: 'text-right num', render: r => `${r.overdueDays} ngày` },
              { key: 'amountTotal', label: 'Số tiền', sortable: true, className: 'text-right num', render: r => formatCurrency(r.amountTotal) }
            ]}
          />
        </section>
      )}
    </div>
  );
}

function DebtTable({ title, rows }) {
  const total = rows.reduce((s, r) => s + r.balance, 0);
  return (
    <div className="o-card">
      <h3 className="o-card-title">{title}</h3>
      <div className="o-table-wrapper">
        <table className="o-table w-100">
          <thead><tr><th>Đối tác</th><th>Chứng từ</th><th className="text-right">Số dư</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="o-empty-cell">Không còn công nợ.</td></tr>}
            {rows.map(r => (
              <tr key={r.partnerId}>
                <td>{r.partnerId ? <Link to={`/partner-ledger?partner=${r.partnerId}`}>{r.partner?.name}</Link> : r.partner?.name}</td>
                <td className="text-muted">{r.entries.join(', ')}</td>
                <td className="text-right num">{formatCurrency(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="o-entry-total"><td colSpan={2}><strong>Tổng</strong></td><td className="text-right num"><strong>{formatCurrency(total)}</strong></td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
