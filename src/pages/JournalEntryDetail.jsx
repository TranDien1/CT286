import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { invoicePath } from '../backend/queries';
import { formatDate } from '../utils/format';
import EntryTable from '../components/common/EntryTable';
import StatusBadge from '../components/common/StatusBadge';

export default function JournalEntryDetail() {
  const { id } = useParams();
  const { request } = useApp();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setEntry(null); setError('');
    request(`/journal-entries/${encodeURIComponent(id)}`).then(result => { if (!cancelled) setEntry(result); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id, reload]);
  return <div className="o-page">
    <div className="o-page-header"><div className="o-breadcrumb"><Link to="/journal-entries">Bút toán</Link> / Chi tiết</div><h1 className="o-page-title">Chi tiết bút toán {entry?.name || ''}</h1></div>
    {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
    {!entry && !error && <p>Đang tải bút toán từ SQL Server…</p>}
    {entry && <div className="o-card">
      <p>Ngày hạch toán: {formatDate(entry.date)} · Trạng thái: <StatusBadge status={entry.state} /></p>
      {['out_invoice', 'in_invoice'].includes(entry.entryType) && <p><Link to={invoicePath(entry)}>Xem hóa đơn liên quan</Link></p>}
      {entry.state !== 'posted' && <p className="text-muted">Chứng từ chưa ghi sổ không được tính vào sổ cái.</p>}
      <EntryTable title={entry.name || 'Nháp (chưa cấp số)'} subtitle={`Sổ ${entry.journalName}`} partnerName={entry.partnerName} items={entry.items} accountName={code => entry.items.find(i => i.accountCode === code)?.accountName || ''} />
    </div>}
  </div>;
}
