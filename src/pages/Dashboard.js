//import Header from '../components/Header';
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, PartnerIcon, BoxIcon, ShoppingCartIcon, CashierIcon, WelcomeIcon } from '../components/Icons';
import '../css/Dashboard.css';

/**
 * Dashboard komponen
 * Props:
 *   session: { username, clientId, clientName, roleId, roleName, orgId, orgName, language, token }
 *   onLogout: () => void
 */
export default function Dashboard({ session, onLogout }) {
  const menuItems = [
      { path: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
      { path: '/business-partner', label: 'Business Partner', icon: <PartnerIcon /> },
      { path: '/product', label: 'Products', icon: <BoxIcon /> },
      { path: '/sales-order', label: 'Sales Order', icon: <ShoppingCartIcon /> },
    ];
  return (
    <div className="dashboard-root">
      
      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <div className="welcome-icon">
            <WelcomeIcon />
          </div>
          <h1 className="welcome-title">Selamat Datang di Aplikasi Point Of Sales <em>iDempiere</em></h1>
          <p className="welcome-sub">
            Anda masuk sebagai <strong>{session.username}</strong> pada organisasi{" "}
            <strong>{session.orgName}</strong>.
          </p>

          <div className="welcome-cards">
            <div className="welcome-card">
            <div className="welcome-card-icon"></div>
              <Link to="/sales-order" className="welcome-card-link"> 
                <CashierIcon />  
                <div className="welcome-card-label">Menu</div>
                <div className="welcome-card-value">Sales Order</div>
              </Link>

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
              <div className="welcome-card-icon">
                <CashierIcon />
              </div>
              <div className="welcome-card-label">Bahasa</div>
              <div className="welcome-card-value">{session.language}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}