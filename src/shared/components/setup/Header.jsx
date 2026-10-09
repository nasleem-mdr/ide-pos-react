import React, { useState, useRef, useEffect } from 'react';
import { UserIcon, RoleIcon, LogoIconW, LogoutIcon } from '@/shared/components';
import ChangeRoleModal from './ChangeRoleModal';
import { useNavigate, Link } from "react-router-dom";
import { useWorkflowPendingCount } from '@/shared/hooks/useWorkflowPendingCount';

import '@/css/Header.css';
 
export default function Header({ session, onLogout, onSessionUpdate }) {
  const { username, clientName, clientId, roleName, roleId } = session;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { count: pendingCount } = useWorkflowPendingCount(roleId);
  
  // Deteksi apakah device mendukung hover asli (desktop/mouse) atau tidak
  // (mobile/touch). (hover: hover) + (pointer: fine) hanya true untuk mouse.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setIsTouchDevice(!mq.matches);
    const handler = (e) => setIsTouchDevice(!e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
 
  // Tutup dropdown saat klik di luar area menu — hanya relevan untuk mode click (mobile).
  useEffect(() => {
    if (!menuOpen || !isTouchDevice) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen, isTouchDevice]);
 
  // Handler untuk trigger Role: click di mobile/touch, hover di desktop.
  const triggerProps = isTouchDevice
    ? { onClick: () => setMenuOpen((p) => !p) }
    : {
        onMouseEnter: () => setMenuOpen(true),
        onMouseLeave: () => setMenuOpen(false),
      };
 
  return (
    <header className="header">
      {/* Brand & Navigation — Mepet Ke Kiri */}
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div className="header-info-item">
          <button 
            onClick={() => navigate('/dashboard')} 
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            <LogoIconW size={20}/>
          </button>
          <span className="header-info-value header-hide-mobile">Procure<em>Grid</em></span>
        </div>
      </div>
 
      {/* Session Info — Sisi Kanan */}
      <div className="header-session">
        {/* 1. Role + Dropdown Ganti Role */}
        <div
          className="header-role-wrap"
          ref={menuRef}
          {...(!isTouchDevice ? triggerProps : {})}
        >
          <div
            className="header-info-item"
            style={{ cursor: 'pointer' }}
            {...(isTouchDevice ? triggerProps : {})}
          >
            <RoleIcon />
            <span className="header-info-value">{roleName}</span>
          </div>

          {menuOpen && (
            <div className="header-dropdown">
              {/* 3. User Info (Geser ke paling kanan) */}
            <div className="header-info-item header-hide-mobile">
              <UserIcon />
              <span className="header-info-value">{username}</span>
            </div>
              <button onClick={() => { setShowChangeRole(true); setMenuOpen(false); }}>
                <RoleIcon />Change Role
              </button>
              <button onClick={onLogout}>
                <LogoutIcon />Logout
              </button>
            </div>
          )}
        </div>

        <div className="header-divider" />

        {/* 2. Notifikasi Approval Pending */}
        <Link
          to="/workflow-approval"
          className="header-notif"
          title={pendingCount > 0 ? `${pendingCount} approval menunggu` : 'Tidak ada approval pending'}
          aria-label={`Workflow approval, ${pendingCount} pending`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {pendingCount > 0 && (
            <span className="header-notif-badge">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </Link>

        <div className="header-divider header-hide-mobile" />

        
      </div>

      {/* Modal Ganti Role */}
      {showChangeRole && (
        <ChangeRoleModal
          token={localStorage.getItem('loginToken')}
          onClose={() => setShowChangeRole(false)}
          onSuccess={(newSession) => {
            onSessionUpdate(newSession);
            setShowChangeRole(false);
          }}
        />
      )}
    </header>
  );
}