import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/common/PageHeader';

// INV-11, PAY-06: tài khoản hạch toán lấy từ cấu hình. Trang này chỉ để xem.
export default function AccountingConfig() {
  const { request } = useApp();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const typeLabel = { sale: 'Bán hàng', purchase: 'Mua hàng', cash: 'Tiền mặt', general: 'Tổng hợp' };

  useEffect(() => {
    let cancelled = false;
    setError('');
    setConfig(null);
    request('/accounting-config').then(data => {
      if (!cancelled) setConfig(data);
    }).catch(err => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);
  return (
    <div className="o-page">
      <PageHeader breadcrumb="Kế toán" title="Tài khoản và sổ nhật ký" />
      <p className="text-muted o-report-note">Hệ thống lấy tài khoản hạch toán từ cấu hình này, không nhận tài khoản do người dùng nhập trên hóa đơn.</p>
      {error && <div className="o-notice o-notice-error" role="alert">{error} <button type="button" className="o-link-btn" onClick={() => setReloadKey(key => key + 1)}>Thử lại</button></div>}
      {!config && !error && <p>Đang tải cấu hình từ SQL Server…</p>}
      {config && <>
      <div className="o-grid-2">
        <div className="o-card">
          <h3 className="o-card-title">Sổ nhật ký</h3>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Mã</th><th>Tên sổ</th><th>Loại</th><th>TK mặc định</th><th>TK công nợ</th></tr></thead>
              <tbody>
                {config.journals.map(j => (
                  <tr key={j.id}>
                    <td><strong>{j.code}</strong></td>
                    <td>{j.name}</td>
                    <td>{typeLabel[j.type] || j.type}</td>
                    <td title={j.defaultAccount?.name || ''}>{j.defaultAccount?.code || '—'}</td>
                    <td title={j.counterpartAccount?.name || ''}>{j.counterpartAccount?.code || '—'}</td>
                  </tr>
                ))}
                {config.journals.length === 0 && <tr><td colSpan={5}>Chưa có sổ nhật ký.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="o-card">
          <h3 className="o-card-title">Hệ thống tài khoản</h3>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Số hiệu</th><th>Tên tài khoản</th><th>Nhóm</th></tr></thead>
              <tbody>
                {config.accounts.map(a => <tr key={a.id}><td><strong>{a.code}</strong></td><td>{a.name}</td><td>{a.accountType}</td></tr>)}
                {config.accounts.length === 0 && <tr><td colSpan={3}>Chưa có tài khoản.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-muted o-report-note">TK công nợ được suy ra để hiển thị: 131 cho sổ bán, 331 cho sổ mua; không phải cột trong sổ nhật ký.</p>
      <div className="o-card">
        <h3 className="o-card-title">Cách hạch toán</h3>
        <p className="text-muted o-report-note">Ví dụ theo cấu hình ban đầu; tài khoản hàng hóa thực tế có thể theo cấu hình nhóm sản phẩm.</p>
        <div className="o-table-wrapper">
          <table className="o-table w-100">
            <thead><tr><th>Chứng từ</th><th>Hàng hóa</th><th>Thuế</th><th>Công nợ / Tiền</th></tr></thead>
            <tbody>
              <tr><td>Hóa đơn bán (INV)</td><td>Có 511</td><td>Có 3331</td><td>Nợ 131</td></tr>
              <tr><td>Hóa đơn mua (BILL)</td><td>Nợ 156</td><td>Nợ 1331</td><td>Có 331</td></tr>
              <tr><td>Phiếu thu (CSH)</td><td colSpan={2}>—</td><td>Nợ 111 / Có 131</td></tr>
              <tr><td>Phiếu chi (CSH)</td><td colSpan={2}>—</td><td>Nợ 331 / Có 111</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  );
}
