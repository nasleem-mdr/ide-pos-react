import { Link, useLocation } from 'react-router-dom';
import { PartnerIcon, HomeIcon, BoxIcon, ShoppingCartIcon } from './Icons';
import '../css/Sidebar.css';

// Terima props isCollapsed dan setIsCollapsed dari parent
export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { path: '/business-partner', label: 'Business Partner', icon: <PartnerIcon /> },
    { path: '/product', label: 'Products', icon: <BoxIcon /> },
    { path: '/sales-orders', label: 'Sales Order', icon: <ShoppingCartIcon /> },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
      <div className="sidebar-brand">
          <div className="brand-icon">iD</div>
          {!isCollapsed && <span>iDempiere <em>POS</em></span>}
        </div>

        <button 
          className="hamburger-btn" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label="Toggle Sidebar"
        >
          ☰
        </button>
        
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link 
            key={item.path}
            to={item.path} 
            onClick={() => setIsCollapsed(true)} 
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <div className="nav-icon">{item.icon}</div>
            {!isCollapsed && <span className="nav-label">{item.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
