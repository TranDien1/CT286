import React, { useState } from 'react';

/**
 * Bảng dữ liệu có sắp xếp. columns: [{ key, label, sortable, className, render(row), sortValue(row) }]
 */
export default function DataTable({ columns, data, onRowClick, emptyMessage = 'Không có dữ liệu', footer }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(col.key); setSortDir('asc'); }
  };

  const col = columns.find(c => c.key === sortKey);
  const valueOf = (row) => (col?.sortValue ? col.sortValue(row) : row[sortKey]);
  const rows = !col ? data : [...data].sort((a, b) => {
    const va = valueOf(a); const vb = valueOf(b);
    if (va === vb) return 0;
    if (va === undefined || va === null) return 1;
    if (vb === undefined || vb === null) return -1;
    return (va < vb ? -1 : 1) * (sortDir === 'asc' ? 1 : -1);
  });

  return (
    <div className="o-table-wrapper">
      <table className="o-table w-100">
        <thead>
          <tr>
            {columns.map(c => (
              <th
                key={c.key}
                className={`${c.className || ''} ${c.sortable ? 'o-sortable' : ''}`}
                onClick={() => handleSort(c)}
                aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="o-empty-cell">{emptyMessage}</td></tr>
          ) : rows.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'o-row-link' : ''}
            >
              {columns.map(c => (
                <td key={c.key} className={c.className || ''}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}
