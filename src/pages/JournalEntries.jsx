import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { allEntries, invoicePath } from '../backend/queries';
import { sumItems } from '../backend/rules';
import { formatCurrency, formatDate } from '../utils/format';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import { EntryTable } from './InvoiceForm';

const JOURNAL_LABEL = { INV: 'Hóa đơn bán', BILL: 'Hóa đơn mua', CASH: 'Tiền mặt' };

// Bút toán: đối tác của dòng lấy qua bút toán (REP-04).
export default function JournalEntries() {
  const { db, partnerById, accountName } = useApp();
  const [journal, setJournal] = useState('');
  const [state, setState] = useState('posted');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const entries = useMemo(() => allEntries(db)
    .filter(e => (!journal || e.journalCode === journal) && (!state || e.state === state))
    .filter(e => {
      const s = search.trim().toLowerCase();
      return !s || (e.name || '').toLowerCase().includes(s) || (partnerById(e.partnerId)?.name || '').toLowerCase().includes(s);
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [db, journal, state, search]);

  return (
    <div className="o-page">
      <PageHeader breadcrumb="Kế toán" title="Bút toán" />

      <div className="o-toolbar">
        <input type="search" className="o-search" aria-label="Tìm bút toán" placeholder="Tìm theo số chứng từ hoặc đối tác..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="o-filter-row">
          <label className="text-muted" htmlFor="fJournal">Sổ</label>
          <select id="fJournal" className="p-1" value={journal} onChange={e => setJournal(e.target.value)}>
            <option value="">Tất cả</option>
            {db.journals.map(j => <option key={j.code} value={j.code}>{j.name}</option>)}
          </select>
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
              const isOpen = expanded === e.id;
              return (
                <React.Fragment key={e.id}>
                  <tr>
                    <td>
                      {e.kind === 'invoice'
                        ? <Link to={invoicePath(e.ref)}><strong>{e.name || 'Nháp (chưa cấp số)'}</strong></Link>
                        : <strong>{e.name}</strong>}
                    </td>
                    <td>{formatDate(e.date)}</td>
                    <td>{JOURNAL_LABEL[e.journalCode] || e.journalCode}</td>
                    <td>{partnerById(e.partnerId)?.name}</td>
                    <td className="text-right num">{formatCurrency(debit)}</td>
                    <td className="text-right num">{formatCurrency(credit)}</td>
                    <td><StatusBadge status={e.state} /></td>
                    <td className="text-right">
                      <button type="button" className="o-btn o-btn-sm o-btn-secondary" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : e.id)}>
                        {isOpen ? 'Thu gọn' : 'Xem dòng'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="o-expand-row">
                      <td colSpan={8}>
                        <EntryTable title={e.name || 'Nháp'} subtitle={`Sổ ${JOURNAL_LABEL[e.journalCode]}`} partnerName={partnerById(e.partnerId)?.name} items={e.items} accountName={accountName} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
