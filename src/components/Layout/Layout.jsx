import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { useApp } from '../../context/AppContext';

// AUTH-01: phải đăng nhập (Admin hoặc Kế toán) mới vào được hệ thống.
export default function Layout() {
  const { user, authLoading } = useApp();
  const location = useLocation();
  if (authLoading) return <div className="o-page">Đang kiểm tra phiên đăng nhập…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <div className="o-app-root">
      <Navbar />
      <main className="o-main-viewport">
        <Outlet />
      </main>
    </div>
  );
}

// AUTH-03: trang quản lý tài khoản chỉ dành cho Admin.
export function AdminOnly({ children }) {
  const { isAdmin } = useApp();
  if (!isAdmin) {
    return (
      <div className="o-page">
        <div className="o-card"><p style={{ margin: 0 }}>Chỉ Admin được vào trang quản lý tài khoản người dùng.</p></div>
      </div>
    );
  }
  return children;
}
