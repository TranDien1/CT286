import React from 'react';
import { Link } from 'react-router-dom';
import { sumItems } from '../../backend/rules';
import { formatCurrency } from '../../utils/format';
import StatusBadge from './StatusBadge';

export default function EntryTable({ title, subtitle, partnerName, items, accountName, reconciledLink }) {
  const { debit, credit } = sumItems(items);
  return (
    <div className="o-entry">
      <div className="o-entry-head"><strong>{title}</strong><span className="text-muted o-meta">{subtitle}</span></div>
      <div className="o-table-wrapper">
        <table className="o-table o-entry-table w-100">
          <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
          <thead><tr><th>Tài khoản</th><th>Đối tác</th><th>Diễn giải</th><th className="o-entry-amount">Nợ</th><th className="o-entry-amount">Có</th><th>Đối soát</th></tr></thead>
          <tbody>{items.map(it => <tr key={it.id}>
            <td><strong>{it.accountCode}</strong> <span className="text-muted">{accountName(it.accountCode)}</span></td>
            <td>{partnerName || '—'}</td>
            <td>{it.label}{it.displayType === 'product' && it.quantity ? ` × ${it.quantity}` : ''}</td>
            <td className="o-entry-amount">{it.debit ? formatCurrency(it.debit) : ''}</td>
            <td className="o-entry-amount">{it.credit ? formatCurrency(it.credit) : ''}</td>
            <td>{['131', '331'].includes(it.accountCode) && <div className="o-reconcile-actions">
              <StatusBadge status={it.reconciled ? 'reconciled' : 'open'} />
              {it.reconciled && it.displayType === 'payment_term' && reconciledLink &&
                <Link className="o-btn o-btn-sm o-btn-secondary" to={reconciledLink.to}>{reconciledLink.label}</Link>}
            </div>}</td>
          </tr>)}</tbody>
          <tfoot><tr className="o-entry-total">
            <td colSpan={3}><strong>Tổng</strong> <span className={debit === credit ? 'text-success' : 'text-danger'}>({debit === credit ? 'cân' : 'không cân'})</span></td>
            <td className="o-entry-amount"><strong>{formatCurrency(debit)}</strong></td>
            <td className="o-entry-amount"><strong>{formatCurrency(credit)}</strong></td><td />
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}
