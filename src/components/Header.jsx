import React, { useState } from 'react';
import { UserIcon, ClientIcon, RoleIcon, LogoutIcon, LogoSMA20 } from './Icons';
import ChangeRoleModal from './ChangeRoleModal';
import '../css/Header.css';

export default function Header({ session, onLogout, onSessionUpdate }) {
  const { username, clientName, clientId, roleName, roleId } = session;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangeRole, setShowChangeRole] = useState(false);

  return (
    <header className="header">
      {/* Brand & Navigation */}
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      </div>

      {/* Session Info */}
      <div className="header-session">
        <div className="header-info-item">
          <LogoSMA20 />
          <span className="header-info-value">SMA <em>App</em></span>
        </div>
        <div className="header-divider" />

        <div className="header-info-item">
          <UserIcon />
          <span className="header-info-value">{username}</span>
        </div>

        <div className="header-divider" />

        {/* Role + dropdown Ganti Role (muncul saat hover) */}
        <div
          className="header-info-item"
          style={{ position: 'relative', cursor: 'pointer' }}
          onMouseEnter={() => setMenuOpen(true)}
          onMouseLeave={() => setMenuOpen(false)}
        >
          <RoleIcon />
          <span className="header-info-value">{roleName}</span>
          {menuOpen && (
            <div className="header-dropdown">
              <button onClick={() => { setShowChangeRole(true); setMenuOpen(false); }}>
                Ganti Role
              </button>
              <button onClick={onLogout}>Logout</button>
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