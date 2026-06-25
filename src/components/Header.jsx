import React from 'react'; // Pastikan React diimport
import { UserIcon, ClientIcon, RoleIcon, LogoutIcon, LogoSMA20 } from './Icons'; 
import '../css/Header.css';
 
  export default function Header({ session, onLogout }) {
    const { username, clientName, clientId, roleName, roleId } = session;
  
    return (
      <header className="header">
        {/* Brand & Navigation */}
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  
        </div>
  
        {/* Session Info */}
        <div className="header-session">
                   {/* dst... */}
          <div className="header-info-item">
            <LogoSMA20 />
            <span className="header-info-value">SMA <em>App</em></span>
          </div>
          <div className="header-divider" />
          {/* ... (isi session info tetap sama) ... */}
          <div className="header-info-item">
            <UserIcon />
            <span className="header-info-value">{username}</span>
          </div>
          
          {/* dst...
          <div className="header-divider" />
          <div className="header-info-item">
            <ClientIcon />
            <span className="header-info-value">{clientName}</span>
          </div>
          */}
        </div>
  
        {/* Logout */}
        <button className="header-logout" onClick={onLogout} title="Keluar">
          <LogoutIcon />
          <span>Logout</span>
        </button>
      </header>
    );
  }
  
  // Style sederhana jika belum ada di Header.css
  const navLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'white',
    textDecoration: 'none',
    fontSize: '0.9rem',
    padding: '5px 10px',
    borderRadius: '4px',
    transition: 'background 0.3s'
  };