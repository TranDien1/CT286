import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { TYPE_INFO } from '../backend/rules';
import { invoiceStatusKey } from '../backend/queries';
import { formatCurrency, formatDate, todayStr } from '../utils/format';
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
  const { db, isAccountant, partnerById, userById } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const today = todayStr();

  const rows = useMemo(() => db.invoices
    .filter(i => i.entryType === type)
    .map(i => ({ ...i, partner: partnerById(i.partnerId), status: invoiceStatusKey(i, today) }))
    .sort((a, b) => b.id - a.id), [db, type, today]);

  const filtered = rows.filter(r => {
    const s = search.trim().toLowerCase();
    const matchSearch = !s || (r.name || '').toLowerCase().includes(s) || (r.partner?.name || '').toLowerCase().includes(s);
    const matchFilter = filter === 'all'
      || (filter === 'not_paid' ? ['not_paid', 'overdue'].includes(r.status) : r.status === filter);
    return matchSearch && matchFilter;
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? rows.length
      : rows.filter(r => (f.key === 'not_paid' ? ['not_paid', 'overdue'].includes(r.status) : r.status === f.key)).length;
    return acc;
  }, {});

  const totalDue = filtered.filter(r => r.state === 'posted' && r.paymentState === 'not_paid').reduce((s, r) => s + r.amountTotal, 0);

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
    { key: 'createdBy', label: 'Người tạo', render: r => userById(r.createdBy)?.fullName }
  ];

  return (
    <div className="o-page">
      <PageHeader
        breadcrumb={type === 'out_invoice' ? 'Bán hàng' : 'Mua hàng'}
        title={info.plural}
        actions={isAccountant && <button className="o-btn o-btn-primary" onClick={() => navigate(`${info.path}/new`)}>Tạo {info.label.toLowerCase()}</button>}
      />

      <div className="o-toolbar">
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

      <div className="o-summary-bar">
        <span>{filtered.length} hóa đơn</span>
        <span>{type === 'out_invoice' ? 'Còn phải thu' : 'Còn phải trả'}: <strong className="num">{formatCurrency(totalDue)}</strong></span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={r => navigate(`${info.path}/${r.id}`)}
        emptyMessage="Không có hóa đơn nào khớp bộ lọc."
      />
    </div>
  );
}
