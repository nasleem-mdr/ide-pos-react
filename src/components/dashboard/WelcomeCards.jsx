import { Link } from 'react-router-dom';
import { CashierIcon, ShoppingCartIcon32, ListIcon } from '../Icons';

/**
 * WelcomeCards — kartu info sesi + shortcut navigasi
 * Props:
 *   session: { roleName, orgName, language }
 */
export default function WelcomeCards({ session }) {
  return (
    <div className="welcome-cards">

      {/* Shortcut: Requisition */}
      <Link to="/requisition" className="welcome-card-link">
      <div className="welcome-card">
        <div className="welcome-card-icon"><ShoppingCartIcon32 /></div>
        <div className="welcome-card-label">Formulir</div>
        <div className="welcome-card-value">Requisition</div>
      </div>
      </Link>
      <Link to="/requisition-list" className="welcome-card-link">
      <div className="welcome-card">
        <div className="welcome-card-icon"><ListIcon /></div>
        <div className="welcome-card-label">Daftar</div>
        <div className="welcome-card-value">Requisition</div>
      </div>
      </Link>
      {/* Info: Role */}
      <div className="welcome-card">
        <div className="welcome-card-icon">🛡️</div>
        <div className="welcome-card-label">Role</div>
        <div className="welcome-card-value">{session.roleName}</div>
      </div>

      {/* Info: Organisasi */}
      <div className="welcome-card">
        <div className="welcome-card-icon">🏬</div>
        <div className="welcome-card-label">Organisasi</div>
        <div className="welcome-card-value">{session.orgName}</div>
      </div>

      {/* Info: Bahasa 
      <div className="welcome-card">
        <div className="welcome-card-icon"><CashierIcon /></div>
        <div className="welcome-card-label">Bahasa</div>
        <div className="welcome-card-value">{session.language}</div>
      </div>
      */}
    </div>
  );
}
