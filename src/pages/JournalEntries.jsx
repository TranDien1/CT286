import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { invoicePath } from '../backend/queries';
import { sumItems } from '../backend/rules';
import { formatCurrency, formatDate } from '../utils/format';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';

const JOURNAL_LABEL = { INV: 'Hóa đơn bán', BILL: 'Hóa đơn mua', CSH: 'Tiền mặt' };

// Bút toán: đối tác của dòng lấy qua bút toán (REP-04).
export default function JournalEntries() {
  const { request } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [account, setAccount] = useState('');
  const [type, setType] = useState('');
  const [journal, setJournal] = useState('');
  const [state, setState] = useState('posted');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    Promise.all([request('/journal-entries'), request('/journals'), request('/accounts')])
      .then(([entries, journals, accounts]) => { if (!cancelled) setData({ entries, journals, accounts }); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reload]);
  const entries = useMemo(() => (data?.entries || [])
    .filter(e => (!journal || e.journalCode === journal) && (!state || e.state === state))
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to) && (!type || e.entryType === type) && (!account || e.items.some(i => i.accountCode === account)))
    .filter(e => {
      const s = search.trim().toLowerCase();
      return !s || (e.name || '').toLowerCase().includes(s) || (e.partnerName || '').toLowerCase().includes(s);
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [data, journal, state, search, from, to, account, type]);

  return (
    <div className="o-page">
      <PageHeader breadcrumb="Kế toán" title="Bút toán" />
      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
      {!data && !error && <p>Đang tải bút toán từ SQL Server…</p>}

      <div className="o-toolbar">
        <input type="search" className="o-search" aria-label="Tìm bút toán" placeholder="Tìm theo số chứng từ hoặc đối tác..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="o-filter-row">
          <label className="text-muted" htmlFor="fJournal">Sổ</label>
          <select id="fJournal" className="p-1" value={journal} onChange={e => setJournal(e.target.value)}>
            <option value="">Tất cả</option>
            {(data?.journals || []).map(j => <option key={j.code} value={j.code}>{j.name}</option>)}
          </select>
          <label htmlFor="fromDate">Từ ngày</label><input id="fromDate" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <label htmlFor="toDate">Đến ngày</label><input id="toDate" type="date" value={to} onChange={e => setTo(e.target.value)} />
          <label htmlFor="account">Tài khoản</label><select id="account" value={account} onChange={e => setAccount(e.target.value)}><option value="">Tất cả</option>{(data?.accounts || []).map(a => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}</select>
          <label htmlFor="entryType">Loại</label><select id="entryType" value={type} onChange={e => setType(e.target.value)}><option value="">Tất cả</option><option value="out_invoice">Hóa đơn bán</option><option value="in_invoice">Hóa đơn mua</option><option value="entry">Bút toán khác</option></select>
          <label className="text-muted" htmlFor="fState">Trạng thái</label>
          <select id="fState" className="p-1" value={state} onChange={e => setState(e.target.value)}>
            <option value="posted">Đã ghi sổ</option>
            <option value="draft">Nháp</option>
            <option value="cancel">Đã hủy</option>
            <option value="">Tất cả</option>
          </select>
        </div>
      </div>

      <div className="o-table-wrapper">
        <table className="o-table w-100">
          <thead>
            <tr><th>Số chứng từ</th><th>Ngày hạch toán</th><th>Sổ</th><th>Đối tác</th><th className="text-right">Tổng Nợ</th><th className="text-right">Tổng Có</th><th>Trạng thái</th><th aria-label="Chi tiết" /></tr>
          </thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={8} className="o-empty-cell">Không có bút toán nào.</td></tr>}
            {entries.map(e => {
              const { debit, credit } = sumItems(e.items);
              return (
                <React.Fragment key={e.id}>
                  <tr>
                    <td>
                      {['out_invoice', 'in_invoice'].includes(e.entryType)
                        ? <Link to={invoicePath(e)}><strong>{e.name || 'Nháp (chưa cấp số)'}</strong></Link>
                        : <strong>{e.name}</strong>}
                    </td>
                    <td>{formatDate(e.date)}</td>
                    <td>{JOURNAL_LABEL[e.journalCode] || e.journalCode}</td>
                    <td>{e.partnerName || '—'}</td>
                    <td className="text-right num">{formatCurrency(debit)}</td>
                    <td className="text-right num">{formatCurrency(credit)}</td>
                    <td><StatusBadge status={e.state} /></td>
                    <td className="text-right">
                      <Link className="o-btn o-btn-sm o-btn-secondary" to={`/journal-entries/${e.id}`}>Xem dòng</Link>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
