import { Link, useLocation } from 'react-router-dom';
import { PartnerIcon, HomeIcon, BoxIcon, ShoppingCartIcon, LogoSMAWarna, ListIconR, DeliveryIcon, RequisitionIcon, ListIconP} from './Icons';
import { useAccess } from '../context/AccessContext';
import '../css/Sidebar.css';

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const location = useLocation();
  const { canView, loading } = useAccess();

  // 1. Mengelompokkan menu berdasarkan section/kategori
  const menuSections = [
    {
      sectionLabel: 'Transaksi',
      items: [
        { key: 'dashboard',       path: '/dashboard',        label: 'Dashboard',        icon: <HomeIcon /> },
        { key: 'requisition',     path: '/requisition',      label: 'Requisition',      icon: <RequisitionIcon /> },
        { key: 'purchasing',      path: '/purchasing',       label: 'Purchasing',       icon: <ShoppingCartIcon /> },
        { key: 'goodsReceipt',   path: '/goods-receipt',    label: 'Goods Receipt',    icon: <DeliveryIcon /> },
        { key: 'internalUse',   path: '/internal-use',    label: 'Goods Receipt',    icon: <DeliveryIcon /> },
      ]
    },
    {
      sectionLabel: 'Laporan & Master',
      items: [
        { key: 'requisition-list', borderTop: true, path: '/requisition-list',  label: 'Requisition List',  icon: <ListIconR /> },
        { key: 'purchasing-list',  path: '/purchasing-list',   label: 'Purchasing List',   icon: <ListIconP /> },
        { key: 'businessPartner',  path: '/business-partner',  label: 'Business Partner', icon: <PartnerIcon /> },
        { key: 'product',          path: '/product',           label: 'Products',         icon: <BoxIcon /> },
      ]
    }
  ];

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
          {menuSections.map((section, index) => {
            // Filter item di dalam section ini berdasarkan hak akses
            const visibleItems = section.items.filter(item => !item.key || canView(item.key));

            // Jika tidak ada menu yang boleh dilihat di section ini, jangan rendor section-nya sama sekali
            if (visibleItems.length === 0) return null;

            return (
              <div key={index} className="sidebar-section">
                {/* Pembatas Garis & Judul Section (Hanya muncul dari section ke-2 dst, atau jika tidak collapsed) */}
                {index > 0 && <hr className="sidebar-divider" />}
                {!isCollapsed && <span className="sidebar-section-title">{section.sectionLabel}</span>}

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
              </div>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}