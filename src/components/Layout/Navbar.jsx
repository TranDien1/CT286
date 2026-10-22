import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const MENU = [
  { label: 'Tổng quan', to: '/', end: true },
  { label: 'Bán hàng', match: ['/invoices'], children: [
    { label: 'Hóa đơn bán', to: '/invoices' },
    { label: 'Khách hàng', to: '/partners?type=customer' }
  ] },
  { label: 'Mua hàng', match: ['/bills'], children: [
    { label: 'Hóa đơn mua', to: '/bills' },
    { label: 'Nhà cung cấp', to: '/partners?type=vendor' }
  ] },
  { label: 'Thu chi', to: '/payments' },
  { label: 'Kế toán', match: ['/journal-entries', '/config'], children: [
    { label: 'Bút toán', to: '/journal-entries' },
    { label: 'Tài khoản và sổ nhật ký', to: '/config' }
  ] },
  { label: 'Danh mục', match: ['/products', '/taxes', '/partners'], children: [
    { label: 'Đối tác', to: '/partners' },
    { label: 'Sản phẩm và nhóm sản phẩm', to: '/products' },
    { label: 'Thuế', to: '/taxes' }
  ] },
  { label: 'Báo cáo', match: ['/reports', '/partner-ledger'], children: [
    { label: 'Báo cáo tổng hợp', to: '/reports' },
    { label: 'Sổ cái đối tác', to: '/partner-ledger' }
  ] },
  { label: 'Người dùng', to: '/admin/users', adminOnly: true }
];

export default function Navbar() {
  const { user, isAdmin, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(null); // tên menu đang mở, 'user' hoặc 'mobile'
  const ref = useRef(null);

  useEffect(() => { setOpen(null); }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = MENU.filter(m => !m.adminOnly || isAdmin);
  const isActive = (m) => (m.match || []).some(p => location.pathname.startsWith(p));

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="o-top-navbar" ref={ref}>
      <div className="o-nav-left">
        <Link to="/" className="o-nav-brand"><span className="o-app-title">Hóa đơn</span></Link>
        <nav className="o-nav-links o-nav-desktop" aria-label="Menu chính">
          {items.map(m => (m.children ? (
            <div className="o-dropdown" key={m.label}>
              <button
                type="button"
                className={`o-nav-item o-dropdown-btn ${isActive(m) ? 'active' : ''}`}
                aria-expanded={open === m.label}
                onClick={() => setOpen(o => (o === m.label ? null : m.label))}
              >
                {m.label}
              </button>
              {open === m.label && (
                <div className="o-dropdown-menu">
                  {m.children.map(c => <Link key={c.to} to={c.to} className="o-dropdown-item">{c.label}</Link>)}
                </div>
              )}
            </div>
          ) : (
            <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive: a }) => `o-nav-item ${a ? 'active' : ''}`}>{m.label}</NavLink>
          )))}
        </nav>
      </div>

      <div className="o-nav-right">
        <button type="button" className="o-btn o-btn-secondary o-btn-sm o-nav-mobile-toggle" aria-expanded={open === 'mobile'}
          onClick={() => setOpen(o => (o === 'mobile' ? null : 'mobile'))}>
          Menu
        </button>
        <div className="o-dropdown">
          <button type="button" className="o-user-chip" aria-expanded={open === 'user'} onClick={() => setOpen(o => (o === 'user' ? null : 'user'))}>
            <span className="o-user-avatar" aria-hidden="true">{user.fullName.charAt(0)}</span>
            <span className="o-user-chip-text">
              <span className="o-user-chip-name">{user.fullName}</span>
              <span className="o-user-chip-role">{isAdmin ? 'Admin' : 'Kế toán'}</span>
            </span>
          </button>
          {open === 'user' && (
            <div className="o-dropdown-menu o-dropdown-right">
              <div className="o-user-menu-head">
                <strong>{user.fullName}</strong>
                <span className="text-muted">{user.userName}{user.email ? ` · ${user.email}` : ''}</span>
              </div>
              <Link to="/profile" className="o-dropdown-item">Đổi mật khẩu</Link>
              <div className="o-dropdown-divider" />
              <button type="button" className="o-dropdown-item text-danger" onClick={handleLogout}>Đăng xuất</button>
            </div>
          )}
        </div>
      </div>

      {open === 'mobile' && (
        <nav className="o-nav-mobile-panel" aria-label="Menu">
          {items.map(m => (m.children ? (
            <div key={m.label} className="o-nav-mobile-group">
              <div className="o-nav-mobile-label">{m.label}</div>
              {m.children.map(c => <Link key={c.to} to={c.to} className="o-nav-mobile-link">{c.label}</Link>)}
            </div>
          ) : (
            <Link key={m.to} to={m.to} className="o-nav-mobile-link">{m.label}</Link>
          )))}
        </nav>
      )}
    </header>
  );
}
