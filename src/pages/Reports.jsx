import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { unpaidInvoices, overdueInvoices, openDebts, paymentReport, invoicePath } from '../backend/queries';
import { isOverdue, TYPE_INFO } from '../backend/rules';
import { formatCurrency, formatDate } from '../utils/format';
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
  const { db, partnerById } = useApp();
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
  const unpaid = useMemo(() => unpaidInvoices(db, kind || undefined), [db, kind]);
  // REP-06
  const overdue = useMemo(() => overdueInvoices(db, kind || undefined), [db, kind]);
  // REP-03
  const receivable = useMemo(() => openDebts(db, '131'), [db]);
  const payable = useMemo(() => openDebts(db, '331'), [db]);
  // REP-05
  const pays = useMemo(() => paymentReport(db), [db]);

  const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);

  return (
    <div className="o-page">
      <PageHeader breadcrumb="Báo cáo" title="Báo cáo" />
      <div className="o-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`o-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'unpaid' && (
        <section className="o-stack">
          <p className="text-muted o-report-note">Hóa đơn đã ghi sổ và chưa thanh toán. Không gồm hóa đơn nháp hoặc đã hủy.</p>
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
              { key: 'st', label: 'Tình trạng', render: r => <StatusBadge status={isOverdue(r) ? 'overdue' : 'not_paid'} /> }
            ]}
          />
        </section>
      )}

      {tab === 'debts' && (
        <section className="o-stack">
          <p className="text-muted o-report-note">Tính từ các dòng công nợ chưa đối soát (reconciled = 0) của bút toán đã ghi sổ. Đối tác lấy qua bút toán.</p>
          <div className="o-grid-2">
            <DebtTable title="Phải thu khách hàng (TK 131)" rows={receivable} />
            <DebtTable title="Phải trả nhà cung cấp (TK 331)" rows={payable} />
          </div>
        </section>
      )}

      {tab === 'payments' && (
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

      {tab === 'overdue' && (
        <section className="o-stack">
          <p className="text-muted o-report-note">Hóa đơn đã ghi sổ, chưa thanh toán và đã qua hạn thanh toán (đúng ngày đến hạn chưa tính là quá hạn).</p>
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
                <td>{r.partner?.name}</td>
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
