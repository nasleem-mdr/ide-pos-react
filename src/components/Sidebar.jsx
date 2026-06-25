import { Link, useLocation } from 'react-router-dom';
import { PartnerIcon, HomeIcon, BoxIcon, ShoppingCartIcon, LogoSMAWarna, ListIcon} from './Icons';
import { useAccess } from '../context/AccessContext';
import '../css/Sidebar.css';

// Terima props isCollapsed dan setIsCollapsed dari parent
export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const location = useLocation();
  const { canView, loading } = useAccess();

  const menuItems = [
    { key: 'dashboard',       path: '/dashboard',        label: 'Dashboard',        icon: <HomeIcon /> },
    { key: 'businessPartner', path: '/business-partner', label: 'Business Partner', icon: <PartnerIcon /> },
    { key: 'product',         path: '/product',          label: 'Products',         icon: <BoxIcon /> },
    //{ key: 'salesOrder',      path: '/sales-orders',     label: 'Sales Order',      icon: <ShoppingCartIcon /> },
    { key: 'requisition',     path: '/requisition',      label: 'Requisition',      icon: <ShoppingCartIcon /> },
    { key: 'requisition-list',     path: '/requisition-list',      label: 'Requisition List',      icon: <ListIcon /> },
  ];

  // Selama accessMap loading, tampilkan skeleton ringan alih-alih menu kosong
  // (mencegah "flash of no menu" lalu tiba-tiba muncul setelah fetch selesai).
  if (loading) {
    return (
      <div className="side-panel-left">
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className={`sidebar-brand ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="brand-icon">iD</div>
            {!isCollapsed && <span>SMA <em>App</em></span>}
          </div>
          <button
            className="hamburger-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle Sidebar"
          >
            ☰
          </button>
        </div>
        <nav className="sidebar-nav" style={{ padding: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '36px', background: '#f1f5f9', borderRadius: '6px', marginBottom: '8px' }} />
          ))}
        </nav>
      </aside>
      </div>
    );
  }

  // Item tanpa 'key' selalu tampil; item dengan 'key' disaring lewat canView().
  const visibleItems = menuItems.filter(item => !item.key || canView(item.key));

  return (
    <div className="side-panel-left">
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
          <div className={`sidebar-brand ${isCollapsed ? 'collapsed' : ''}`}>
          <div className="brand-icon"><LogoSMAWarna/></div>
          {!isCollapsed && <span>SMA <em>app</em></span>}
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
        {visibleItems.map((item) => (
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
    </div>
  );
}