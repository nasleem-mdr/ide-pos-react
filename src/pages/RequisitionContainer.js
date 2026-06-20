import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Dialog from '../components/common/Dialog';
import CartFab from '../components/cart/CartFab';
import CartPanel from '../components/cart/CartPanel';
import ProductCard from '../components/product/ProductCard';
import ProductDetailSheet from '../components/product/ProductDetailSheet';
import BarcodeScanner from '../components/scanner/BarcodeScanner';
import RequisitionSuccessModal from '../components/requisition/RequisitionSuccessModal';
import { useRequisitionSubmit } from '../components/requisition/useRequisitionSubmit';

import { useCart } from '../hooks/useCart';
import { useProductSearch } from '../hooks/useProductSearch';
import { getLoginInfo, getMissingSessionFields } from '../hooks/useLoginInfo';
import { idempiereApi } from '../utils/idempiereApi';
import { COLOR, RADIUS } from '../utils/styleTokens';
// ─────────────────────────────────────────────────────────────────────────────
// Konfigurasi khusus modul Requisition (bukan bagian dari sesi login)
// ─────────────────────────────────────────────────────────────────────────────
const REQUISITION_CONFIG = {
  C_DOCTYPE_ID: 320,
  DESCRIPTION:  'Purchase Requisition via Web',
};

// ─────────────────────────────────────────────────────────────────────────────
// RequisitionContainer.jsx
// Orchestrator saja — semua logic reusable sudah dipindah ke hooks/ dan
// component generic di components/common, components/product, components/cart,
// components/scanner. File ini hanya menyusun layout & menghubungkan state.
// ─────────────────────────────────────────────────────────────────────────────
const RequisitionContainer = () => {
  const navigate = useNavigate();

  const [loading, setLoading]           = useState(true);
  const [warehouseInfo, setWarehouseInfo] = useState(null);
  const [requesterName, setRequesterName] = useState('');
  const [cartOpen, setCartOpen]         = useState(false);
  const [scannerOpen, setScannerOpen]   = useState(false);
  const [dialog, setDialog]             = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData]   = useState(null);
  const [successOpen, setSuccessOpen]   = useState(false);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const searchRef = useRef(null);

  const alert = (message, title = 'Perhatian') => setDialog({ isOpen: true, title, message });

  // ── Hooks reusable ─────────────────────────────────────────────────────────
  const { products, loading: productsLoading, fetchProducts, search, searchValue, setSearchValue } = useProductSearch();
  const { cart, addToCart, removeFromCart, updateQty, updateUom, clearCart, totalQty, totalItems, setCart } = useCart();
  const { submit, isSubmitting } = useRequisitionSubmit({
    docTypeId:   REQUISITION_CONFIG.C_DOCTYPE_ID,
    description: REQUISITION_CONFIG.DESCRIPTION,
    onError:     alert,
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const info = getLoginInfo();
        const missing = getMissingSessionFields(info);

        if (missing.length) {
          alert(`Data sesi tidak lengkap:\n${missing.map(k => `• ${k}`).join('\n')}\n\nSilakan login kembali.`, 'Sesi Tidak Valid');
          setLoading(false);
          return;
        }

        try {
          const wh = await idempiereApi(`/models/m_warehouse/${info.warehouseId}?$select=M_Warehouse_ID,Name`);
          setWarehouseInfo({ id: info.warehouseId, name: wh.Name || `WH #${info.warehouseId}` });
        } catch {
          setWarehouseInfo({ id: info.warehouseId, name: `WH #${info.warehouseId}` });
        }

        try {
          const u = await idempiereApi(`/models/ad_user/${info.userId}?$select=AD_User_ID,Name`);
          setRequesterName(u.Name || info.userName);
        } catch {
          setRequesterName(info.userName);
        }

        await fetchProducts('');
      } catch (err) {
        alert('Gagal inisialisasi: ' + err.message, 'Error');
      } finally {
        setLoading(false);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Product detail flow ─────────────────────────────────────────────────────
  const openProductDetail = useCallback((product) => {
    setSelectedProduct(product);
    setDetailOpen(true);
  }, []);

  const closeProductDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedProduct(null);
  }, []);

  const handleConfirmAddToCart = useCallback((product, qty, uom) => {
    addToCart(product, qty, uom);
    closeProductDetail();
    setCartOpen(true);
  }, [addToCart, closeProductDetail]);

  // ── Barcode: produk sudah pasti dari scan → langsung ke cart ───────────────
  const handleBarcodeDetected = useCallback((code) => {
    const found = products.find(p => p.Value?.toUpperCase() === code.toUpperCase());
    if (found) {
      addToCart(found, 1, { C_UOM_ID: found.C_UOM_ID, Name: found.C_UOM_Name, multiplyRate: 1 });
      setScannerOpen(false);
      setCartOpen(true);
    } else {
      setScannerOpen(false);
      setSearchValue(code);
      fetchProducts(code);
    }
  }, [products, addToCart, fetchProducts, setSearchValue]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const result = await submit(cart, requesterName);
    if (result) {
      setSuccessData(result);
      clearCart();
      setCartOpen(false);
      setSuccessOpen(true);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100dvh', background: COLOR.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>

      <Dialog
        isOpen={dialog.isOpen} title={dialog.title} message={dialog.message}
        onClose={() => setDialog({ isOpen: false, title: '', message: '' })}
      />

      <ProductDetailSheet
        isOpen={detailOpen}
        product={selectedProduct}
        onClose={closeProductDetail}
        onConfirm={handleConfirmAddToCart}
        confirmLabel="Tambah ke Keranjang"
      />

      <RequisitionSuccessModal
        isOpen={successOpen}
        data={successData}
        onClose={() => {
          setSuccessOpen(false);
          setSuccessData(null);
          fetchProducts('');
          setSearchValue('');
          setTimeout(() => searchRef.current?.focus(), 150);
        }}
      />

      <BarcodeScanner
        isOpen={scannerOpen}
        onDetected={handleBarcodeDetected}
        onClose={() => setScannerOpen(false)}
      />

      {/* Top Bar */}
      <div style={{
        background: COLOR.primary, padding: '0 16px', display: 'flex', alignItems: 'center',
        gap: '10px', height: '52px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
      }}>
        <button
          onClick={() => navigate('/pos')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, WebkitTapHighlightColor: 'transparent',
          }}
        >← POS</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', flex: 1 }}>📋 Requisition</span>
        <span style={{
          background: 'rgba(255,255,255,0.18)', borderRadius: '20px',
          padding: '3px 10px', fontSize: '11px', color: '#e0eaff', whiteSpace: 'nowrap',
        }}>
          {warehouseInfo?.name || '...'}
        </span>
      </div>

      {/* Requester strip */}
      <div style={{
        background: '#dbeafe', padding: '6px 16px', fontSize: '12px', color: COLOR.textMd,
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0,
      }}>
        <span>👤 <strong>{requesterName || '...'}</strong></span>
        <span style={{ color: COLOR.textLt }}>|</span>
        <span>DocType: <strong>{REQUISITION_CONFIG.C_DOCTYPE_ID}</strong></span>
        <span style={{ color: COLOR.textLt }}>|</span>
        <span>Org: <strong>{getLoginInfo().orgId || '...'}</strong></span>
      </div>

      {/* Search bar */}
      <div style={{
        padding: '12px 14px', background: COLOR.surface, borderBottom: `1px solid ${COLOR.border}`,
        display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>🔍</span>
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={e => search(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchProducts(searchValue.trim()); } }}
            placeholder="Cari nama / kode produk..."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 34px',
              border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.md,
              fontSize: '14px', color: COLOR.textDk, background: COLOR.bg, outline: 'none',
            }}
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); fetchProducts(''); }}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: COLOR.textLt,
                fontSize: '16px', padding: '2px',
              }}
            >✕</button>
          )}
        </div>

        <button
          onClick={() => setScannerOpen(true)}
          title="Scan QR / Barcode"
          style={{
            background: COLOR.primary, border: 'none', color: '#fff',
            borderRadius: RADIUS.md, padding: '10px 14px', cursor: 'pointer',
            fontSize: '20px', lineHeight: 1, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <path d="M14 14h.01M14 17h.01M17 14h.01M17 17h.01M20 14h.01M20 17h.01M20 20h.01M17 20h.01M14 20h.01"/>
          </svg>
        </button>
      </div>

      {/* Product Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', paddingBottom: cart.length > 0 ? '80px' : '14px' }}>
        {productsLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
            <p style={{ margin: 0 }}>Memuat produk...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📦</div>
            <p style={{ margin: 0 }}>Tidak ada produk ditemukan.</p>
            <p style={{ margin: '6px 0 0', fontSize: '12px' }}>Pastikan produk memiliki vendor aktif di M_ProductPO.</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: COLOR.textLt, marginBottom: '8px' }}>
              {products.length} produk ditemukan
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '10px' }}>
              {products.map((p, idx) => (
                <ProductCard key={`${p.M_Product_ID}-${idx}`} product={p} onClick={openProductDetail} />
              ))}
            </div>
          </>
        )}
      </div>

      {cart.length > 0 && !cartOpen && (
        <CartFab count={totalItems} label="Daftar Permintaan" onClick={() => setCartOpen(true)} />
      )}

      <CartPanel
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRemove={removeFromCart}
        onQtyChange={updateQty}
        onUomChange={updateUom}
        onClearCart={clearCart}
        totalItems={totalItems}
        totalQty={totalQty}
        summaryRight={`📦 ${warehouseInfo?.name || '...'}`}
        title="📝 Daftar Permintaan"
        submitLabel="📤 KIRIM REQUISITION"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default RequisitionContainer;
