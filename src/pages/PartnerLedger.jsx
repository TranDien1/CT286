import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { invoicePath } from '../backend/queries';
import { formatCurrency, formatDate, todayStr } from '../utils/format';
import { buildPartnerLedger, hasDraftEntries, periodOf } from '../utils/partnerLedger';

const PERIODS = [
  ['this_year', 'Năm nay'], ['last_year', 'Năm trước'], ['this_month', 'Tháng này'],
  ['last_month', 'Tháng trước'], ['custom', 'Khoảng ngày'], ['all', 'Tất cả']
];
const ACCOUNTS = [
  ['both', 'Phải thu và phải trả', ['131', '331']],
  ['131', 'Phải thu khách hàng (131)', ['131']],
  ['331', 'Phải trả nhà cung cấp (331)', ['331']]
];
const SHOW_PRINT = !import.meta.env.VITE_ARTIFACT;
const money = (n) => (n ? formatCurrency(n) : '');

// Sổ cái đối tác (REP-03, REP-04): công nợ 131/331 theo từng đối tác, Admin và Kế toán đều xem được (REP-01).
export default function PartnerLedger() {
  const { request } = useApp();
  const [params] = useSearchParams();
  const focusPartner = Number(params.get('partner')) || null;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [preset, setPreset] = useState(focusPartner ? 'all' : 'this_year');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [account, setAccount] = useState('both');
  const [unreconciledOnly, setUnreconciledOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set(focusPartner ? [focusPartner] : []));
  const [hideDraftNotice, setHideDraftNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    Promise.all([request('/journal-entries'), request('/invoices?type=out_invoice'), request('/invoices?type=in_invoice'), request('/payments')])
      .then(([entries, sales, purchases, payments]) => {
        if (cancelled) return;
        const dueDates = {}; const matchOf = {};
        [...sales, ...purchases].forEach(i => { dueDates[i.id] = i.invoiceDateDue; if (i.name) matchOf[i.id] = i.name; });
        payments.forEach(p => { matchOf[p.entryId] = p.invoiceName; });
        setData({ entries, dueDates, matchOf });
      })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reload]);

  const period = periodOf(preset, todayStr(), custom);
  const invalidPeriod = preset === 'custom' && (!period.from || !period.to || period.from > period.to);
  const accountCodes = ACCOUNTS.find(a => a[0] === account)[2];
  const report = useMemo(() => (data && !invalidPeriod ? buildPartnerLedger(data.entries, {
    from: period.from, to: period.to, accountCodes, unreconciledOnly, search, dueDates: data.dueDates, matchOf: data.matchOf
  }) : null), [data, period.from, period.to, account, unreconciledOnly, search, invalidPeriod]);
  const showDraftNotice = data && !hideDraftNotice && hasDraftEntries(data.entries, period.to);

  const keyOf = (p) => p.partnerId ?? 'none';
  const toggle = (k) => setExpanded(prev => { const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  const allOpen = report && report.partners.length > 0 && report.partners.every(p => expanded.has(keyOf(p)));
  const setAll = (open) => setExpanded(open && report ? new Set(report.partners.map(keyOf)) : new Set());

  return (
    <div className="o-page o-ledger-page">
      <div className="o-page-header">
        <div className="o-breadcrumb">Báo cáo</div>
        <div className="o-page-header-row">
          <h1 className="o-page-title">Sổ cái đối tác</h1>
          <div className="o-page-actions o-no-print">
            <button type="button" className="o-btn o-btn-secondary" disabled={!report} onClick={() => setAll(!allOpen)}>{allOpen ? 'Thu gọn tất cả' : 'Mở tất cả'}</button>
            {SHOW_PRINT && <button type="button" className="o-btn o-btn-primary" disabled={!report} onClick={() => window.print()}>In</button>}
          </div>
        </div>
      </div>

      <div className="o-toolbar o-no-print">
        <input type="search" className="o-search" aria-label="Tìm đối tác" placeholder="Tìm đối tác..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="o-filter-row">
          <label htmlFor="ledgerPeriod" className="text-muted">Kỳ</label>
          <select id="ledgerPeriod" className="p-1" value={preset} onChange={e => setPreset(e.target.value)}>
            {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {preset === 'custom' && (
            <>
              <input type="date" aria-label="Từ ngày" className="p-1" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} />
              <span className="text-muted">đến</span>
              <input type="date" aria-label="Đến ngày" className="p-1" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} />
            </>
          )}
        </div>
        <div className="o-filter-row">
          <label htmlFor="ledgerAccount" className="text-muted">Tài khoản</label>
          <select id="ledgerAccount" className="p-1" value={account} onChange={e => setAccount(e.target.value)}>
            {ACCOUNTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <label className="o-check"><input type="checkbox" checked={unreconciledOnly} onChange={e => setUnreconciledOnly(e.target.checked)} /> Chỉ dòng chưa khớp</label>
      </div>

      <p className="text-muted o-report-note">
        {period.from || period.to
          ? `Kỳ ${period.from ? formatDate(period.from) : '…'} – ${period.to ? formatDate(period.to) : '…'}. Phát sinh trước kỳ được cộng vào số dư đầu kỳ.`
          : 'Toàn bộ phát sinh.'} Số dư = Nợ − Có: số dương là khách hàng còn nợ mình, số âm là mình còn nợ nhà cung cấp.
      </p>
      {account === 'both' && <p className="text-muted o-report-note">Số dư tổng hợp là Nợ trừ Có của cả 131 và 331, không thay thế số dư riêng của từng tài khoản. Chọn từng tài khoản để đối chiếu công nợ.</p>}
      {unreconciledOnly && <p className="text-muted o-report-note">Chỉ lọc trạng thái đối soát hiện tại, không tái dựng trạng thái đối soát trong quá khứ; tổng và số dư là của các dòng được lọc.</p>}
      {invalidPeriod && <div className="o-notice o-notice-error" role="alert">Chọn đủ ngày và bảo đảm ngày bắt đầu không sau ngày kết thúc.</div>}

      {showDraftNotice && (
        <div className="o-notice o-notice-info o-ledger-notice o-no-print" role="status">
          <span>Có <strong>bút toán chưa ghi sổ</strong> trước hoặc trong kỳ này. Sổ cái chỉ tính bút toán đã ghi sổ.</span>
          <button type="button" className="o-link-btn" onClick={() => setHideDraftNotice(true)}>Ẩn</button>
        </div>
      )}
      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReload(n => n + 1)}>Thử lại</button></div>}
      {!data && !error && <p>Đang tải sổ cái…</p>}

      {report && (
        <div className="o-table-wrapper o-ledger">
          <table className="o-table w-100">
            <thead>
              <tr>
                <th>Đối tác / Chứng từ</th><th>Sổ nhật ký</th><th>Tài khoản</th><th>Ngày</th><th>Ngày đến hạn</th><th>Khớp</th>
                <th className="text-right">Nợ</th><th className="text-right">Có</th><th className="text-right">Số dư</th>
              </tr>
            </thead>
            <tbody>
              {report.partners.length === 0 && (
                <tr><td colSpan={9} className="o-empty-cell">Không có phát sinh công nợ trong kỳ.</td></tr>
              )}
              {report.partners.map(p => {
                const k = keyOf(p);
                const open = expanded.has(k);
                return (
                  <React.Fragment key={k}>
                    <tr className="o-ledger-partner">
                      <td colSpan={6}>
                        <button type="button" className={`o-ledger-toggle ${open ? 'open' : ''}`} aria-expanded={open} onClick={() => toggle(k)}>
                          {p.partnerName}
                        </button>
                      </td>
                      <td className="text-right num">{formatCurrency(p.debit)}</td>
                      <td className="text-right num">{formatCurrency(p.credit)}</td>
                      <td className="text-right num"><strong>{formatCurrency(p.closing)}</strong></td>
                    </tr>
                    {open && (period.from ? (
                      <tr className="o-ledger-line o-ledger-opening">
                        <td>Số dư đầu kỳ</td><td /><td /><td>{formatDate(period.from)}</td><td /><td /><td /><td />
                        <td className="text-right num">{formatCurrency(p.opening)}</td>
                      </tr>
                    ) : null)}
                    {open && p.lines.map(l => (
                      <tr key={l.key} className="o-ledger-line">
                        <td>
                          {l.entryType === 'out_invoice' || l.entryType === 'in_invoice'
                            ? <Link to={invoicePath({ entryType: l.entryType, id: l.entryId })}>{l.entryName}</Link>
                            : <Link to={`/journal-entries/${l.entryId}`}>{l.entryName}</Link>}
                          {l.label && <span className="text-muted o-ledger-label">{l.label}</span>}
                        </td>
                        <td>{l.journalCode}</td>
                        <td>{l.accountCode}</td>
                        <td>{formatDate(l.date)}</td>
                        <td>{l.dueDate ? formatDate(l.dueDate) : ''}</td>
                        <td>{l.matching}</td>
                        <td className="text-right num">{money(l.debit)}</td>
                        <td className="text-right num">{money(l.credit)}</td>
                        <td className="text-right num">{formatCurrency(l.balance)}</td>
                      </tr>
                    ))}
                    {open && p.lines.length === 0 && (
                      <tr className="o-ledger-line"><td colSpan={9} className="text-muted">Không có phát sinh trong kỳ.</td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="o-entry-total">
                <td colSpan={6}><strong>Tổng sổ cái đối tác</strong></td>
                <td className="text-right num"><strong>{formatCurrency(report.totals.debit)}</strong></td>
                <td className="text-right num"><strong>{formatCurrency(report.totals.credit)}</strong></td>
                <td className="text-right num"><strong>{formatCurrency(report.totals.closing)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
