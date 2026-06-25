import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Dialog from '../components/common/Dialog';
import CartFab from '../components/cart/CartFab';
import CartPanel from '../components/cart/CartPanel';
import CartSidebar from '../components/cart/CartSidebar';
import ProductCard from '../components/product/ProductCard';
import ProductDetailSheet from '../components/product/ProductDetailSheet';
import BarcodeScanner from '../components/scanner/BarcodeScanner';
import RequisitionSuccessModal from '../components/requisition/RequisitionSuccessModal';
import { useRequisitionSubmit } from '../components/requisition/useRequisitionSubmit';
import { useAccess } from '../context/AccessContext';
import { useCart } from '../hooks/useCart';
import { useProductSearch } from '../hooks/useProductSearch';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { getLoginInfo, getMissingSessionFields } from '../hooks/useLoginInfo';
import { idempiereApi, fkId } from '../utils/idempiereApi';
import { COLOR, RADIUS } from '../utils/styleTokens';
import '../css/Header.css';
import { HomeIcon } from '../components/Icons';

const REQUISITION_CONFIG = {
  C_DOCTYPE_ID: 127, //sma 1000018 garden 127
  DESCRIPTION:  'Purchase Requisition via Web',
};

const RequisitionContainer = () => {
  const navigate   = useNavigate();
  const isDesktop  = useIsDesktop();
  const searchRef  = useRef(null);

  // ── state ─────────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses]           = useState([]);         // list semua WH
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);   // {id, name}
  const [requesterName, setRequesterName]     = useState('');
  const [cartOpen, setCartOpen]               = useState(false);
  const [scannerOpen, setScannerOpen]         = useState(false);
  const [dialog, setDialog]                   = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData]         = useState(null);
  const [successOpen, setSuccessOpen]         = useState(false);
  const [detailOpen, setDetailOpen]           = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const alert = (message, title = 'Perhatian') =>
    setDialog({ isOpen: true, title, message });

  // ── hooks ─────────────────────────────────────────────────────────────────
  const {
    products, loading: productsLoading,
    fetchProducts, search, searchValue, setSearchValue,
    searchByUPC,
  } = useProductSearch();

  const { cart, addToCart, removeFromCart, updateQty, updateUom, clearCart, totalQty, totalItems } = useCart();

  const { submit, isSubmitting } = useRequisitionSubmit({
    docTypeId:   REQUISITION_CONFIG.C_DOCTYPE_ID,
    description: REQUISITION_CONFIG.DESCRIPTION,
    onError:     alert,
  });

  const { canEdit } = useAccess();
  const canSubmitRequisition = canEdit('requisition');

  // ── init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const info    = getLoginInfo();
        const missing = getMissingSessionFields(info);
        if (missing.length) {
          alert(
            `Data sesi tidak lengkap:\n${missing.map(k => `• ${k}`).join('\n')}\n\nSilakan login kembali.`,
            'Sesi Tidak Valid'
          );
          return;
        }

        // Fetch daftar warehouse aktif untuk org ini
        const whData = await idempiereApi(
          `/models/m_warehouse?$select=M_Warehouse_ID,Name` +
          `&$filter=IsActive eq true and AD_Org_ID eq ${info.orgId}` +
          `&$orderby=Name&$top=50`
        );
        const whList = (whData.records || []).map(w => ({
          id:   fkId(w.M_Warehouse_ID),
          name: w.Name,
        }));
        setWarehouses(whList);

        // Default: warehouse dari session login
        const defaultWh = whList.find(w => String(w.id) === String(info.warehouseId))
          ?? (whList.length > 0 ? whList[0] : null);
        setSelectedWarehouse(defaultWh);

        // Fetch requester name
        try {
          const u = await idempiereApi(`/models/ad_user/${info.userId}?$select=AD_User_ID,Name`);
          setRequesterName(u.Name || info.userName);
        } catch {
          setRequesterName(info.userName);
        }

        // Fetch produk dengan filter warehouse default
        if (defaultWh) {
          await fetchProducts('', defaultWh.id);
        } else {
          await fetchProducts('');
        }
      } catch (err) {
        alert('Gagal inisialisasi: ' + err.message, 'Error');
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── warehouse change ──────────────────────────────────────────────────────
  const handleWarehouseChange = useCallback((e) => {
    const id   = Number(e.target.value);
    const found = warehouses.find(w => w.id === id) ?? null;
    setSelectedWarehouse(found);
    // Re-query produk dengan warehouse baru, pertahankan search term
    fetchProducts(searchValue, found?.id ?? null);
  }, [warehouses, fetchProducts, searchValue]);

  // ── product detail ────────────────────────────────────────────────────────
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
  }, [addToCart, closeProductDetail]);

  // ── barcode ───────────────────────────────────────────────────────────────
  const handleBarcodeDetected = useCallback(async (code) => {
    setScannerOpen(false);
    const whId = selectedWarehouse?.id ?? null;

    let found = await searchByUPC(code);
    // Kalau produk ketemu tapi tidak ada di warehouse ini, abaikan
    if (!found) {
      found = products.find(p => p.Value?.toUpperCase() === code.toUpperCase()) ?? null;
    }

    if (found) {
      addToCart(found, 1, { C_UOM_ID: found.C_UOM_ID, Name: found.C_UOM_Name, multiplyRate: 1 });
    } else {
      setSearchValue(code);
      fetchProducts(code, whId);
    }
  }, [products, addToCart, fetchProducts, setSearchValue, searchByUPC, selectedWarehouse]);

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Pass warehouseId yang dipilih user ke submit
    const result = await submit(cart, requesterName, selectedWarehouse?.id);
    if (result) {
      setSuccessData({ ...result, warehouseName: selectedWarehouse?.name });
      clearCart();
      setCartOpen(false);
      setSuccessOpen(true);
    }
  };

  const cartSummaryRight = `📦 ${selectedWarehouse?.name || '...'}`;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1, minHeight: 0, background: COLOR.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      display: 'flex', flexDirection: 'column', position: 'relative',
      overflow: 'hidden',
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
          fetchProducts('', selectedWarehouse?.id ?? null);
          setSearchValue('');
          setTimeout(() => searchRef.current?.focus(), 150);
        }}
      />

      <BarcodeScanner
        isOpen={scannerOpen}
        onDetected={handleBarcodeDetected}
        onClose={() => setScannerOpen(false)}
      />

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className='header'>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, WebkitTapHighlightColor: 'transparent',
          }}
        ><HomeIcon />Home</button>

        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', flex: 1 }}>
          📋 Requisition
        </span>

        {/* Warehouse combobox — menggantikan span statis */}
        <select
          value={selectedWarehouse?.id ?? ''}
          onChange={handleWarehouseChange}
          disabled={warehouses.length <= 1}
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '20px',
            padding: '3px 10px',
            fontSize: '11px',
            color: '#e0eaff',
            cursor: warehouses.length <= 1 ? 'default' : 'pointer',
            outline: 'none',
            maxWidth: isDesktop ? '200px' : '140px',
            // Warna option untuk kontras (browser native styling)
            colorScheme: 'dark',
          }}
        >
          {warehouses.length === 0 && (
            <option value="">Memuat...</option>
          )}
          {warehouses.map(wh => (
            <option key={wh.id} value={wh.id} style={{ background: '#1e3a5f', color: '#e0eaff' }}>
              📦 {wh.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Requester strip ──────────────────────────────────────────────── */}
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

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Kolom kiri: search + grid produk */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Search bar */}
          <div style={{
            padding: '12px 14px', background: COLOR.surface,
            borderBottom: `1px solid ${COLOR.border}`,
            display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
          }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '10px', top: '50%',
                transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none',
              }}>🔍</span>
              <input
                ref={searchRef}
                type="text"
                value={searchValue}
                onChange={e => search(e.target.value, selectedWarehouse?.id ?? null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    fetchProducts(searchValue.trim(), selectedWarehouse?.id ?? null);
                  }
                }}
                placeholder="Cari nama / kode produk..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px 10px 34px',
                  border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.md,
                  fontSize: '14px', color: COLOR.textDk, background: COLOR.bg, outline: 'none',
                }}
              />
              {searchValue && (
                <button
                  onClick={() => {
                    setSearchValue('');
                    fetchProducts('', selectedWarehouse?.id ?? null);
                  }}
                  style={{
                    position: 'absolute', right: '8px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: COLOR.textLt, fontSize: '16px', padding: '2px',
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
                fontSize: '20px', lineHeight: 1, flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <path d="M14 14h.01M14 17h.01M17 14h.01M17 17h.01M20 14h.01M20 17h.01M20 20h.01M17 20h.01M14 20h.01"/>
              </svg>
            </button>
          </div>

          {/* Product Grid */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            paddingBottom: (!isDesktop && cart.length > 0) ? '80px' : '14px',
          }}>
            {productsLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
                <p style={{ margin: 0 }}>Memuat produk...</p>
              </div>
            ) : products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📦</div>
                <p style={{ margin: 0 }}>Tidak ada produk ditemukan.</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px' }}>
                  {selectedWarehouse
                    ? `Pastikan produk memiliki Default Locator di gudang "${selectedWarehouse.name}".`
                    : 'Pastikan produk memiliki vendor aktif di M_ProductPO.'}
                </p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: COLOR.textLt, marginBottom: '8px' }}>
                  {products.length} produk
                  {selectedWarehouse ? ` di gudang ${selectedWarehouse.name}` : ''}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop
                    ? 'repeat(auto-fill, minmax(170px, 1fr))'
                    : 'repeat(2, 1fr)',
                  gap: '10px',
                }}>
                  {products.map((p, idx) => (
                    <ProductCard key={`${p.M_Product_ID}-${idx}`} product={p} onClick={openProductDetail} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Kolom kanan: cart sidebar — HANYA di desktop */}
        {isDesktop && (
          <CartSidebar
            cart={cart}
            onRemove={removeFromCart}
            onQtyChange={updateQty}
            onUomChange={updateUom}
            onClearCart={canSubmitRequisition ? clearCart : undefined}
            totalItems={totalItems}
            totalQty={totalQty}
            summaryRight={cartSummaryRight}
            title="📝 Daftar Permintaan"
            submitLabel="📤 KIRIM REQUISITION"
            onSubmit={canSubmitRequisition ? handleSubmit : undefined}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Mobile: FAB + bottom sheet cart */}
      {!isDesktop && cart.length > 0 && !cartOpen && (
        <CartFab count={totalItems} label="Daftar Permintaan" onClick={() => setCartOpen(true)} />
      )}

      {!isDesktop && (
        <CartPanel
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          cart={cart}
          onRemove={removeFromCart}
          onQtyChange={updateQty}
          onUomChange={updateUom}
          onClearCart={canSubmitRequisition ? clearCart : undefined}
          totalItems={totalItems}
          totalQty={totalQty}
          summaryRight={cartSummaryRight}
          title="📝 Daftar Permintaan"
          submitLabel="📤 KIRIM REQUISITION"
          onSubmit={canSubmitRequisition ? handleSubmit : undefined}
          isSubmitting={isSubmitting}
        />
      )}

      {!canSubmitRequisition && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fef3c7', color: '#92400e', fontSize: '12px',
          padding: '8px 14px', textAlign: 'center', zIndex: 150,
        }}>
          ⚠ Role Anda hanya memiliki akses lihat (read-only) untuk Requisition.
        </div>
      )}
    </div>
  );
};

export default RequisitionContainer;