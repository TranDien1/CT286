import React from 'react';
import { sumItems } from '../../backend/rules';
import { formatCurrency } from '../../utils/format';
import StatusBadge from './StatusBadge';

export default function EntryTable({ title, subtitle, partnerName, items, accountName }) {
  const { debit, credit } = sumItems(items);
  return (
    <div className="o-entry">
      <div className="o-entry-head"><strong>{title}</strong><span className="text-muted o-meta">{subtitle}</span></div>
      <div className="o-table-wrapper">
        <table className="o-table w-100">
          <thead><tr><th>Tài khoản</th><th>Đối tác</th><th>Diễn giải</th><th className="text-right">Nợ</th><th className="text-right">Có</th><th>Đối soát</th></tr></thead>
          <tbody>{items.map(it => <tr key={it.id}>
            <td><strong>{it.accountCode}</strong> <span className="text-muted">{accountName(it.accountCode)}</span></td>
            <td>{partnerName || '—'}</td>
            <td>{it.label}{it.displayType === 'product' && it.quantity ? ` × ${it.quantity}` : ''}</td>
            <td className="text-right num">{it.debit ? formatCurrency(it.debit) : ''}</td>
            <td className="text-right num">{it.credit ? formatCurrency(it.credit) : ''}</td>
            <td>{['131', '331'].includes(it.accountCode) ? <StatusBadge status={it.reconciled ? 'reconciled' : 'open'} /> : ''}</td>
          </tr>)}</tbody>
          <tfoot><tr className="o-entry-total">
            <td colSpan={3}><strong>Tổng</strong> <span className={debit === credit ? 'text-success' : 'text-danger'}>({debit === credit ? 'cân' : 'không cân'})</span></td>
            <td className="text-right num"><strong>{formatCurrency(debit)}</strong></td>
            <td className="text-right num"><strong>{formatCurrency(credit)}</strong></td><td />
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}
