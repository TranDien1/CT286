import React from 'react';

export default function PageHeader({ breadcrumb, title, actions, children }) {
  return (
    <div className="o-page-header">
      {breadcrumb && <div className="o-breadcrumb">{breadcrumb}</div>}
      <div className="o-page-header-row">
        <h1 className="o-page-title">{title}</h1>
        {actions && <div className="o-page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function ReadOnlyNotice({ children }) {
  return <div className="o-notice o-notice-info">{children || 'Bạn đang dùng tài khoản Admin: chỉ được xem, không được tạo, sửa hoặc xóa.'}</div>;
}
