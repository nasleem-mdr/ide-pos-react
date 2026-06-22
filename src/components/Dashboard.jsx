import React from 'react';
import { Link } from 'react-router-dom';
import '../css/Dashboard.css';

function Dashboard() {
  const username = localStorage.getItem('username') || 'Admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  return (
    <div className="dashboard-root">
      {/* Background grid */}
      <div className="dashboard-grid" />

      <div className="dashboard-card">
        {/* Accent bar */}
        <div className="dashboard-accent-bar" />

        {/* Logo */}
        <div className="dashboard-logo">
          <div className="dashboard-logo-mark">iD</div>
          <div>
            <div className="dashboard-logo-text">
              iDempiere<span>PRO</span>
            </div>
            <div className="dashboard-logo-sub">Enterprise Resource Planning</div>
          </div>
        </div>

        {/* Welcome */}
        <div className="dashboard-welcome">
          <div className="dashboard-greeting">// Selamat datang kembali</div>
          <h1 className="dashboard-headline">
            Halo, <span>{username}</span>
          </h1>
          <p className="dashboard-desc">
            Sistem iDempiere PRO siap digunakan. Pilih modul di bawah untuk mulai bekerja atau navigasi melalui menu di atas.
          </p>
        </div>

        <div className="dashboard-divider" />

        {/* Actions */}
        <div className="dashboard-actions">
          <div className="dashboard-action-label">// Akses cepat</div>
          <div className="dashboard-action-group">
            <Link to="/pos" className="btn-action-primary">
              ⬡ &nbsp;Point of Sales
            </Link>
            <Link to="/bp" className="btn-action-secondary">
              ◎ &nbsp;Business Partner
            </Link>
            <button onClick={handleLogout} className="btn-action-secondary">
              ← &nbsp;Logout
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="dashboard-footer">
          <span className="dashboard-footer-text">iDempiere PRO · v1.0.0</span>
          <div className="dashboard-status">
            <div className="dashboard-status-dot" />
            SISTEM AKTIF
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
