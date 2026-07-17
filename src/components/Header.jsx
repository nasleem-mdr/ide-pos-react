import React, { useState, useRef, useEffect } from 'react';
import { UserIcon, ClientIcon, RoleIcon, LogoutIcon, LogoSMA20 } from './Icons';
import ChangeRoleModal from './ChangeRoleModal';
import '../css/Header.css';
 
export default function Header({ session, onLogout, onSessionUpdate }) {
  const { username, clientName, clientId, roleName, roleId } = session;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const menuRef = useRef(null);
 
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
      {/* Brand & Navigation */}
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      </div>
 
      {/* Session Info */}
      <div className="header-session">
        <div className="header-info-item">
          <LogoSMA20 />
          <span className="header-info-value header-hide-mobile">SMA <em>App</em></span>
        </div>
        <div className="header-divider header-hide-mobile" />
 
        <div className="header-info-item header-hide-mobile">
          <UserIcon />
          <span className="header-info-value">{username}</span>
        </div>
 
        <div className="header-divider" />
 
        {/* Role + dropdown Ganti Role — hover di desktop, click di mobile/touch */}
        <div
          className="header-info-item"
          style={{ position: 'relative', cursor: 'pointer' }}
          ref={menuRef}
          {...(!isTouchDevice ? triggerProps : {})}
        >
          <div
            className="header-info-item"
            {...(isTouchDevice ? triggerProps : {})}
          >
            <RoleIcon />
            <span className="header-info-value">{roleName}</span>
          </div>
          {menuOpen && (
            <div className="header-dropdown">
              <button onClick={() => { setShowChangeRole(true); setMenuOpen(false); }}>
                <RoleIcon />Change Role
              </button>
              <button onClick={onLogout}>
                <LogoutIcon />Logout
              </button>
            </div>
          )}
        </div>
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