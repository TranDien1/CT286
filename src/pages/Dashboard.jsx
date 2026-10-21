import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { overdueInvoices, invoicePath } from '../backend/queries';
import { formatCurrency, formatDate, todayStr } from '../utils/format';
import { paymentTrend } from '../utils/paymentTrend';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';

export default function Dashboard() {
  const { request, user, isAccountant } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    Promise.all([
      request('/invoices?type=out_invoice'), request('/invoices?type=in_invoice'),
      request('/payments'), request('/reports/debts')
    ]).then(([sales, purchases, payments, debts]) => {
      if (!cancelled) setData({ invoices: [...sales, ...purchases], payments, debts });
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reload]);

  const stats = useMemo(() => {
    if (!data) return null;
    const sum = (code) => data.debts.filter(row => row.accountCode === code).reduce((s, row) => s + Number(row.balance), 0);
    const overdue = overdueInvoices({ invoices: data.invoices.filter(i => i.invoiceDateDue) });
    return {
      receivable: sum('131'),
      payable: sum('331'),
      overdue,
      overdueTotal: overdue.reduce((s, i) => s + i.amountTotal, 0),
      drafts: data.invoices.filter(i => i.state === 'draft'),
      trend: paymentTrend(data.payments, todayStr()),
      recentPayments: [...data.payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id - a.id).slice(0, 5)
    };
  }, [data]);

  const tiles = stats && [
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

      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
      {!data && !error && <p>Đang tải dữ liệu tổng quan từ SQL Server…</p>}
      {stats && <>

      <div className="o-tiles">
        {tiles.map(t => (
          <Link key={t.label} to={t.to} className={`o-tile ${t.tone || ''}`}>
            <span className="o-tile-label">{t.label}</span>
            <span className="o-tile-value num">{t.value}</span>
            {t.sub && <span className="o-tile-sub num">{t.sub}</span>}
          </Link>
        ))}
      </div>

      <PaymentTrendChart rows={stats.trend} />

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
                    <td>{i.partner?.name}</td>
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
                    <td>{formatDate(p.paymentDate)}</td>
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
                    <td>{i.partner?.name}</td>
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
      </>}
    </div>
  );
}

function PaymentTrendChart({ rows }) {
  const [activeMonth, setActiveMonth] = useState(null);
  const total = type => rows.reduce((sum, row) => sum + row[type], 0);
  const max = Math.max(1, ...rows.flatMap(row => [row.inbound, row.outbound]));
  const x = index => 80 + index * 70;
  const y = value => 210 - (value / max) * 170;
  const points = type => rows.map((row, index) => `${x(index)},${y(row[type])}`).join(' ');
  const label = key => `${key.slice(5)}/${key.slice(0, 4)}`;
  const selected = activeMonth === null ? null : rows[activeMonth];
  const tooltipX = activeMonth === null ? 0 : Math.min(Math.max(x(activeMonth) - 120, 80), 610);

  return (
    <section className="o-card o-payment-trend" aria-labelledby="payment-trend-title">
      <div className="o-card-head">
        <h3 className="o-card-title" id="payment-trend-title">Tổng thu và chi</h3>
        <Link to="/reports?tab=payments">Xem báo cáo thu/chi</Link>
      </div>
      <p className="text-muted">Theo ngày thanh toán trong 12 tháng gần nhất, tính đến hôm nay. Đây là dòng tiền, không phải doanh thu hay chi phí.</p>
      <div className="o-trend-totals">
        <div><span>Tổng thu</span><strong className="num text-success">{formatCurrency(total('inbound'))}</strong></div>
        <div><span>Tổng chi</span><strong className="num text-danger">{formatCurrency(total('outbound'))}</strong></div>
      </div>
      <div className="o-trend-scroll">
        <svg className="o-trend-chart" viewBox="0 0 900 250" role="group" aria-label="Biểu đồ đường tổng thu và tổng chi theo tháng. Xem số liệu chi tiết trong bảng bên dưới.">
          {[0, 0.5, 1].map(fraction => <g key={fraction}>
            <line x1="80" x2="850" y1={y(max * fraction)} y2={y(max * fraction)} stroke="#e2e8f0" />
            <text x="72" y={y(max * fraction) + 4} textAnchor="end" className="o-trend-axis">{new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(max * fraction)}</text>
          </g>)}
          <polyline points={points('inbound')} fill="none" stroke="#16a34a" strokeWidth="3" />
          <polyline points={points('outbound')} fill="none" stroke="#dc2626" strokeWidth="3" />
          {rows.map((row, index) => <g key={row.key}>
            <circle cx={x(index)} cy={y(row.inbound)} r="4" fill="#16a34a"><title>Thu {label(row.key)}: {formatCurrency(row.inbound)}</title></circle>
            <circle cx={x(index)} cy={y(row.outbound)} r="4" fill="#dc2626"><title>Chi {label(row.key)}: {formatCurrency(row.outbound)}</title></circle>
            <text x={x(index)} y="235" textAnchor="middle" className="o-trend-axis">{label(row.key)}</text>
          </g>)}
          {rows.map((row, index) => <rect key={row.key} x={x(index) - 35} y="35" width="70" height="180"
            fill="transparent" tabIndex="0" role="img"
            aria-label={`${label(row.key)}: thu ${formatCurrency(row.inbound)}, chi ${formatCurrency(row.outbound)}`}
            onMouseEnter={() => setActiveMonth(index)} onMouseLeave={() => setActiveMonth(null)}
            onFocus={() => setActiveMonth(index)} onBlur={() => setActiveMonth(null)} />)}
          {selected && <g pointerEvents="none" aria-hidden="true">
            <line x1={x(activeMonth)} x2={x(activeMonth)} y1="40" y2="210" stroke="#94a3b8" strokeDasharray="4 4" />
            <rect x={tooltipX} y="44" width="240" height="68" rx="6" fill="#fff" stroke="#cbd5e1" />
            <text x={tooltipX + 10} y="62" fontSize="12" fontWeight="600" fill="#1e293b">{label(selected.key)}</text>
            <text x={tooltipX + 10} y="81" fontSize="12" fill="#15803d">Thu: {formatCurrency(selected.inbound)}</text>
            <text x={tooltipX + 10} y="100" fontSize="12" fill="#b91c1c">Chi: {formatCurrency(selected.outbound)}</text>
          </g>}
        </svg>
      </div>
      <details className="o-trend-details"><summary>Xem số liệu từng tháng</summary>
        <div className="o-table-wrapper"><table className="o-table w-100">
          <thead><tr><th>Tháng</th><th className="text-right">Tổng thu</th><th className="text-right">Tổng chi</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.key}><td>{label(row.key)}</td><td className="text-right num">{formatCurrency(row.inbound)}</td><td className="text-right num">{formatCurrency(row.outbound)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </section>
  );
}
