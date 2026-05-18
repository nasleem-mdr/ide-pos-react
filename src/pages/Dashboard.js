import Header from '../components/Header';
import '../css/Dashboard.css';

/**
 * Dashboard komponen
 * Props:
 *   session: { username, clientId, clientName, roleId, roleName, orgId, orgName, language, token }
 *   onLogout: () => void
 */
export default function Dashboard({ session, onLogout }) {
  return (
    <div className="dashboard-root">
      
      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <div className="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 className="welcome-title">Selamat Datang di Aplikasi POS <em>iDempiere</em></h1>
          <p className="welcome-sub">
            Anda masuk sebagai <strong>{session.username}</strong> pada organisasi{" "}
            <strong>{session.orgName}</strong>.
          </p>

          <div className="welcome-cards">
            <div className="welcome-card">
              <div className="welcome-card-icon">🏢</div>
              <div className="welcome-card-label">Client</div>
              <div className="welcome-card-value">{session.clientName}</div>
            </div>
            <div className="welcome-card">
              <div className="welcome-card-icon">🛡️</div>
              <div className="welcome-card-label">Role</div>
              <div className="welcome-card-value">{session.roleName}</div>
            </div>
            <div className="welcome-card">
              <div className="welcome-card-icon">🏬</div>
              <div className="welcome-card-label">Organisasi</div>
              <div className="welcome-card-value">{session.orgName}</div>
            </div>
            <div className="welcome-card">
              <div className="welcome-card-icon">🌐</div>
              <div className="welcome-card-label">Bahasa</div>
              <div className="welcome-card-value">{session.language}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}