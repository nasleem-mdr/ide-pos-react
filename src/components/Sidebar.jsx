import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PartnerIcon, HomeIcon, BoxIcon, ShoppingCartIcon, LogoSMAWarna, ListIconR, RequisitionIcon, ListIconP, UserTake, DeliveryIcon} from './Icons';
import { useAccess } from '../context/AccessContext';
import '../css/Sidebar.css';

// Ikon chevron kecil untuk indikator collapse section — rotasi diatur lewat CSS
// (lihat .section-chevron di Sidebar.css), bukan lewat prop, supaya transisinya halus.
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
  const location = useLocation();
  const { canView, loading } = useAccess();

  // Track section mana yang di-collapse-ke-atas — keyed by sectionLabel.
  // Default: semua section terbuka (object kosong = tidak ada yang collapsed).
  const [collapsedSections, setCollapsedSections] = useState({});

  const toggleSection = (label) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // 1. Mengelompokkan menu berdasarkan section/kategori
  const menuSections = [
    {
      sectionLabel: 'Transaksi',
      defaultCollapsed: false,
      items: [
        { key: 'dashboard',       path: '/dashboard',        label: 'Dashboard',        icon: <HomeIcon /> },
        { key: 'requisition',     path: '/requisition',      label: 'Requisition',      icon: <RequisitionIcon /> },
        { key: 'purchasing',      path: '/purchasing',       label: 'Purchasing',       icon: <ShoppingCartIcon /> },
        { key: 'goodsReceipt',   path: '/goods-receipt',    label: 'Goods Receipt',    icon: <DeliveryIcon /> },
        { key: 'internalUse',   path: '/internal-use',    label: 'Internal Use',    icon: <UserTake /> },
      ]
    },
    {
      sectionLabel: 'Laporan & Master',
      defaultCollapsed: true,
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
            const visibleItems = section.items.filter(item => !item.key || canView(item.key));
            if (visibleItems.length === 0) return null;

            const isSectionCollapsed = !!collapsedSections[section.sectionLabel];
            const [collapsedSections, setCollapsedSections] = useState(() =>
            Object.fromEntries(menuSections.map(s => [s.sectionLabel, !!s.defaultCollapsed]))
            );
            return (
              <div key={index} className="sidebar-section">
                {index > 0 && <hr className="sidebar-divider" />}

                {/* Judul section jadi tombol toggle — hanya berfungsi saat sidebar
                    tidak collapsed (mode icon-only tidak punya ruang untuk header). */}
                {!isCollapsed && (
                  <button
                    className="sidebar-section-header"
                    onClick={() => toggleSection(section.sectionLabel)}
                    aria-expanded={!isSectionCollapsed}
                  >
                    <span className="sidebar-section-title">{section.sectionLabel}</span>
                    <span className={`section-chevron ${isSectionCollapsed ? 'closed' : ''}`}>
                      <ChevronIcon />
                    </span>
                  </button>
                )}

                {/* Saat sidebar icon-only (isCollapsed true), section TIDAK pernah
                    disembunyikan — collapse per-section cuma relevan saat label
                    terlihat. Saat sidebar penuh, hormati state collapse section. */}
                {(isCollapsed || !isSectionCollapsed) && visibleItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsCollapsed(true)}
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    data-tooltip={item.label}
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
