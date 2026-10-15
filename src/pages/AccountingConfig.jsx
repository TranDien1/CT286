import React from 'react';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/common/PageHeader';

// INV-11, PAY-06: tài khoản hạch toán lấy từ cấu hình. Trang này chỉ để xem.
export default function AccountingConfig() {
  const { db, accountName } = useApp();
  const typeLabel = { sale: 'Bán hàng', purchase: 'Mua hàng', cash: 'Tiền mặt' };
  return (
    <div className="o-page">
      <PageHeader breadcrumb="Kế toán" title="Tài khoản và sổ nhật ký" />
      <p className="text-muted o-report-note">Hệ thống lấy tài khoản hạch toán từ cấu hình này, không nhận tài khoản do người dùng nhập trên hóa đơn.</p>
      <div className="o-grid-2">
        <div className="o-card">
          <h3 className="o-card-title">Sổ nhật ký</h3>
          <div className="o-table-wrapper">
            <table className="o-table w-100">
              <thead><tr><th>Mã</th><th>Tên sổ</th><th>Loại</th><th>TK mặc định</th><th>TK công nợ</th></tr></thead>
              <tbody>
                {db.journals.map(j => (
                  <tr key={j.code}>
                    <td><strong>{j.code}</strong></td>
                    <td>{j.name}</td>
                    <td>{typeLabel[j.type]}</td>
                    <td title={accountName(j.defaultAccount)}>{j.defaultAccount}</td>
                    <td title={j.counterpartAccount ? accountName(j.counterpartAccount) : ''}>{j.counterpartAccount || '—'}</td>
                  </tr>
                ))}
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
                {db.accounts.map(a => <tr key={a.code}><td><strong>{a.code}</strong></td><td>{a.name}</td><td>{a.type}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="o-card">
        <h3 className="o-card-title">Cách hạch toán</h3>
        <div className="o-table-wrapper">
          <table className="o-table w-100">
            <thead><tr><th>Chứng từ</th><th>Hàng hóa</th><th>Thuế</th><th>Công nợ / Tiền</th></tr></thead>
            <tbody>
              <tr><td>Hóa đơn bán (INV)</td><td>Có 511</td><td>Có 3331</td><td>Nợ 131</td></tr>
              <tr><td>Hóa đơn mua (BILL)</td><td>Nợ 156</td><td>Nợ 1331</td><td>Có 331</td></tr>
              <tr><td>Phiếu thu (REC)</td><td colSpan={2}>—</td><td>Nợ 111 / Có 131</td></tr>
              <tr><td>Phiếu chi (PAY)</td><td colSpan={2}>—</td><td>Nợ 331 / Có 111</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
