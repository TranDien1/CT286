import React from 'react';

// state: draft / posted / cancel · payment_state: not_paid / paid · overdue tính khi hiển thị
const LABELS = {
  draft: 'Nháp',
  posted: 'Đã ghi sổ',
  cancel: 'Đã hủy',
  not_paid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  overdue: 'Quá hạn',
  reconciled: 'Đã đối soát',
  open: 'Chưa đối soát',
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  locked: 'Đã khóa',
  inbound: 'Phiếu thu',
  outbound: 'Phiếu chi',
  customer: 'Khách hàng',
  vendor: 'Nhà cung cấp',
  sale: 'Bán',
  purchase: 'Mua',
  admin: 'Admin',
  accountant: 'Kế toán'
};

export default function StatusBadge({ status, label }) {
  return <span className={`o-badge o-badge-${status}`}>{label || LABELS[status] || status}</span>;
}
