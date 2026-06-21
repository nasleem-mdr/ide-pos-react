import { Link, useLocation } from 'react-router-dom';
import { PartnerIcon, HomeIcon, BoxIcon, ShoppingCartIcon } from './Icons';
import { useAccess } from '../context/AccessContext';
import '../css/Sidebar.css';

// Terima props isCollapsed dan setIsCollapsed dari parent
export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const location = useLocation();

  const menuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { key: 'businessPartner', path: '/business-partner', label: 'Business Partner', icon: <PartnerIcon /> },
    { path: '/product', label: 'Products', icon: <BoxIcon /> },
    { path: '/sales-orders', label: 'Sales Order', icon: <ShoppingCartIcon /> },
    { key: 'requisition',     label: 'Requisition',       path: '/requisition',      icon: '📋' },
  ];

  const Sidebar = () => {
  const { canView, loading } = useAccess();
  const location = useLocation();

  // Selama accessMap loading, tampilkan skeleton sederhana alih-alih
  // menu kosong (mencegah "flash of no menu" lalu tiba-tiba muncul).
  if (loading) {
    return (
      <nav style={{ padding: '12px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '36px', background: '#f1f5f9', borderRadius: '6px', marginBottom: '8px' }} />
        ))}
      </nav>
    );
  }

  const visibleItems = MENU_ITEMS.filter(item => canView(item.key));

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
