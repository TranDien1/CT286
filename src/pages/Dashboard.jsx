import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { openDebts, overdueInvoices, paymentReport, invoicePath } from '../backend/queries';
import { formatCurrency, formatDate } from '../utils/format';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';

export default function Dashboard() {
  const { db, user, isAccountant, partnerById } = useApp();

  const stats = useMemo(() => {
    const sum = (rows) => rows.reduce((s, r) => s + r.balance, 0);
    const overdue = overdueInvoices(db);
    return {
      receivable: sum(openDebts(db, '131')),
      payable: sum(openDebts(db, '331')),
      overdue,
      overdueTotal: overdue.reduce((s, i) => s + i.amountTotal, 0),
      drafts: db.invoices.filter(i => i.state === 'draft'),
      recentPayments: paymentReport(db).slice(0, 5)
    };
  }, [db]);

  const tiles = [
    { label: 'Phải thu khách hàng', value: formatCurrency(stats.receivable), to: '/reports?tab=debts' },
    { label: 'Phải trả nhà cung cấp', value: formatCurrency(stats.payable), to: '/reports?tab=debts' },
    { label: 'Hóa đơn quá hạn', value: `${stats.overdue.length}`, sub: formatCurrency(stats.overdueTotal), to: '/reports?tab=overdue', tone: stats.overdue.length ? 'danger' : '' },
    { label: 'Hóa đơn nháp', value: `${stats.drafts.length}`, sub: 'chưa ghi sổ', to: '/invoices' }
  ];

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb="Tổng quan"
        title={`Xin chào, ${user.fullName}`}
        actions={isAccountant && (
          <>
            <Link to="/invoices/new" className="o-btn o-btn-primary">Tạo hóa đơn bán</Link>
            <Link to="/bills/new" className="o-btn o-btn-secondary">Tạo hóa đơn mua</Link>
          </>
        )}
      />

      <div className="o-tiles">
        {tiles.map(t => (
          <Link key={t.label} to={t.to} className={`o-tile ${t.tone || ''}`}>
            <span className="o-tile-label">{t.label}</span>
            <span className="o-tile-value num">{t.value}</span>
            {t.sub && <span className="o-tile-sub num">{t.sub}</span>}
          </Link>
        ))}
      </div>

      <div className="o-grid-2">
        <div className="o-card">
          <div className="o-card-head">
            <h3 className="o-card-title">Hóa đơn quá hạn</h3>
            <Link to="/reports?tab=overdue">Xem báo cáo</Link>
          </div>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Số</th><th>Đối tác</th><th className="text-right">Quá hạn</th><th className="text-right">Số tiền</th></tr></thead>
              <tbody>
                {stats.overdue.length === 0 && <tr><td colSpan={4} className="o-empty-cell">Không có hóa đơn quá hạn.</td></tr>}
                {stats.overdue.map(i => (
                  <tr key={i.id}>
                    <td><Link to={invoicePath(i)}>{i.name}</Link></td>
                    <td>{partnerById(i.partnerId)?.name}</td>
                    <td className="text-right num text-danger">{i.overdueDays} ngày</td>
                    <td className="text-right num">{formatCurrency(i.amountTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="o-card">
          <div className="o-card-head">
            <h3 className="o-card-title">Thu chi gần đây</h3>
            <Link to="/payments">Xem tất cả</Link>
          </div>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Số phiếu</th><th>Đối tác</th><th>Ngày</th><th className="text-right">Số tiền</th></tr></thead>
              <tbody>
                {stats.recentPayments.length === 0 && <tr><td colSpan={4} className="o-empty-cell">Chưa có phiếu thu/chi.</td></tr>}
                {stats.recentPayments.map(p => (
                  <tr key={p.id}>
                    <td><StatusBadge status={p.paymentType} label={p.name} /></td>
                    <td>{p.partner?.name}</td>
                    <td>{formatDate(p.date)}</td>
                    <td className="text-right num">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {stats.drafts.length > 0 && (
        <div className="o-card">
          <h3 className="o-card-title">Hóa đơn nháp chờ ghi sổ</h3>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Loại</th><th>Đối tác</th><th>Ngày hóa đơn</th><th className="text-right">Tổng tiền</th><th aria-label="Mở" /></tr></thead>
              <tbody>
                {stats.drafts.map(i => (
                  <tr key={i.id}>
                    <td>{i.entryType === 'out_invoice' ? 'Hóa đơn bán' : 'Hóa đơn mua'}{i.name ? ` · ${i.name}` : ''}</td>
                    <td>{partnerById(i.partnerId)?.name}</td>
                    <td>{formatDate(i.invoiceDate)}</td>
                    <td className="text-right num">{formatCurrency(i.amountTotal)}</td>
                    <td className="text-right"><Link to={invoicePath(i)}>Mở</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
