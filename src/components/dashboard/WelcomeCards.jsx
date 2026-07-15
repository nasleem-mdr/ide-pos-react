import { Link } from 'react-router-dom';
import { ShoppingCartIcon, DeliveryIcon, RequisitionIcon, UserTake } from '../Icons';

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
        <div className="welcome-card-icon"><RequisitionIcon size={36} /></div>
        <div className="welcome-card-label">Formulir</div>
        <div className="welcome-card-value">Requisition</div>
      </div>
      </Link>
      <Link to="/purchasing" className="welcome-card-link">
      <div className="welcome-card">
        <div className="welcome-card-icon"><ShoppingCartIcon size={32} /></div>
        <div className="welcome-card-label">Formulir</div>
        <div className="welcome-card-value">Purchase Order</div>
      </div>
      </Link>
      {/* Delivery Icon */}
      <Link to="/goods-receipt" className="welcome-card-link">
      <div className="welcome-card">
        <div className="welcome-card-icon"><DeliveryIcon size={38} /></div>
        <div className="welcome-card-label">Formulir</div>
        <div className="welcome-card-value">Goods Receipt</div>
      </div>
      </Link>
      {/* Info: Organisasi */}
      <Link to="/internal-use" className="welcome-card-link">
      <div className="welcome-card">
        <div className="welcome-card-icon"><UserTake size={32} /></div>
        <div className="welcome-card-label">Formulir</div>
        <div className="welcome-card-value">Internal Use</div>
      </div>
      </Link>
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
