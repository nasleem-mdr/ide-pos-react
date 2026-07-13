import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Dialog from '../components/common/Dialog';
import CartFab from '../components/cart/CartFab';
import CartPanel from '../components/cart/CartPanel';
import CartSidebar from '../components/cart/CartSidebar';
import ProductCard from '../components/product/ProductCard';
import ProductDetailSheet from '../components/product/ProductDetailSheet';
import BarcodeScanner from '../components/scanner/BarcodeScanner';
import PurchaseOrderImportModal from '../components/goodsreceipt/PurchaseOrderImportModal';
import GoodsReceiptSuccessModal from '../components/goodsreceipt/GoodsReceiptSuccessModal';
import { useGoodsReceiptSubmit } from '../hooks/useGoodsReceiptSubmit';
import { useVendorSearch } from '../hooks/useVendorSearch';
import { useAccess } from '../context/AccessContext';
import { useCart } from '../hooks/useCart';
import { useProductSearch } from '../hooks/useProductSearch';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { getLoginInfo, getMissingSessionFields } from '../hooks/useLoginInfo';
import { idempiereApi, fkId } from '../utils/idempiereApi';
import { resolveDocTypeId, DOC_BASE_TYPE } from '../utils/docTypeResolver';
import { COLOR, RADIUS } from '../utils/styleTokens';
import '../css/Header.css';
import { HomeIcon } from '../components/Icons';

// Deskripsi dokumen — tidak client-specific, aman tetap konstan.
const GOODS_RECEIPT_DESCRIPTION = 'Goods Receipt via Web';

// ─────────────────────────────────────────────────────────────────────────────
// GoodsReceiptContainer.jsx (REVISI)
// Perbedaan dari draf pertama: sumber import sekarang PURCHASE ORDER
// (C_Order/C_OrderLine), bukan Requisition — karena proses bisnisnya punya
// tahap "Requisition dikonversi jadi PO" sebelum barang datang. Konsekuensi:
//
//   1. Tombol 📥 di sebelah Scan QR membuka PurchaseOrderImportModal, bukan
//      RequisitionImportModal.
//   2. Vendor TIDAK lagi input manual bebas di awal — begitu user import
//      dari PO, vendor & lokasi pengiriman otomatis terisi dari header PO
//      tersebut (paling akurat, karena itu komitmen resmi ke vendor).
//   3. Vendor field DIKUNCI (disabled) selama cart berisi item hasil import
//      PO, supaya header M_InOut tidak salah vendor dibanding line yang
//      sudah ter-link C_OrderLine_ID. User bisa "Reset" untuk ganti PO/vendor.
//   4. Pencarian vendor manual tetap tersedia sebagai fallback HANYA saat
//      cart kosong — untuk kasus penerimaan barang di luar PO (mis. sample,
//      barang hibah) yang tidak lazim tapi kadang perlu dicatat juga.
// ─────────────────────────────────────────────────────────────────────────────
const GoodsReceiptContainer = () => {
  const navigate   = useNavigate();
  const isDesktop  = useIsDesktop();

  const [warehouseInfo, setWarehouseInfo] = useState(null);
  const [defaultLocatorId, setDefaultLocatorId] = useState(null);
  const [docTypeId, setDocTypeId] = useState(null); // ← di-resolve dinamis, bukan hardcode

  // ── Vendor (BPartner) yang mengirim barang ──────────────────────────────
  const [vendorQuery, setVendorQuery]   = useState('');
  const [vendorOpen, setVendorOpen]     = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null); // { C_BPartner_ID, Name, locationId, source: 'po' | 'manual' }

  const [cartOpen, setCartOpen]         = useState(false);
  const [scannerOpen, setScannerOpen]   = useState(false);
  const [importOpen, setImportOpen]     = useState(false);
  const [dialog, setDialog]             = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData]   = useState(null);
  const [successOpen, setSuccessOpen]   = useState(false);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const searchRef = useRef(null);

  const alert = (message, title = 'Perhatian') => setDialog({ isOpen: true, title, message });

  const { products, loading: productsLoading, fetchProducts, search, searchValue, setSearchValue } = useProductSearch();
  const { cart, setCart, addToCart, removeFromCart, updateQty, updateUom, clearCart, totalQty, totalItems } = useCart();
  const { vendors, loading: vendorLoading, search: searchVendor, getDefaultBPLocation } = useVendorSearch();
  const { submit, isSubmitting } = useGoodsReceiptSubmit({
    docTypeId,
    description: GOODS_RECEIPT_DESCRIPTION,
    onError:     alert,
  });
  const { canEdit } = useAccess();
  const canSubmitReceipt = canEdit('goodsReceipt');

  // Vendor terkunci selama ada minimal 1 item cart yang berasal dari PO —
  // mencegah header M_InOut vendor-nya beda sama line yang sudah ter-link
  // C_OrderLine_ID (data jadi tidak konsisten kalau dibolehkan ganti).
  const hasPoLinkedItems = cart.some(i => i.sourceOrderLineId);
  const vendorLocked = hasPoLinkedItems;

  useEffect(() => {
    const init = async () => {
      try {
        const info = getLoginInfo();
        const missing = getMissingSessionFields(info);

        if (missing.length) {
          alert(`Data sesi tidak lengkap:\n${missing.map(k => `• ${k}`).join('\n')}\n\nSilakan login kembali.`, 'Sesi Tidak Valid');
          return;
        }

        try {
          const wh = await idempiereApi(`/models/m_warehouse/${info.warehouseId}?$select=M_Warehouse_ID,Name`);
          setWarehouseInfo({ id: info.warehouseId, name: wh.Name || `WH #${info.warehouseId}` });
        } catch {
          setWarehouseInfo({ id: info.warehouseId, name: `WH #${info.warehouseId}` });
        }

        // Resolve C_DocType_ID secara dinamis berdasarkan DocBaseType 'MMR'
        // (Material Receipt) + AD_Client_ID sesi login — BUKAN hardcode,
        // supaya benar untuk client manapun yang login (lihat docTypeResolver.jsx).
        try {
          const dt = await resolveDocTypeId(DOC_BASE_TYPE.MATERIAL_RECEIPT, { orgId: info.orgId });
          setDocTypeId(dt);
        } catch (err) {
          alert(err.message, 'Document Type Tidak Ditemukan');
        }

        // Cari locator default gudang ini — fallback ke locator aktif pertama
        // kalau tidak ada yang ditandai IsDefault.
        try {
          const defRes = await idempiereApi(
            `/models/m_locator?$select=M_Locator_ID&$filter=M_Warehouse_ID eq ${info.warehouseId} and IsDefault eq true and IsActive eq true&$top=1`
          );
          const defRecords = Array.isArray(defRes.records) ? defRes.records : [];
          if (defRecords.length > 0) {
            setDefaultLocatorId(fkId(defRecords[0].M_Locator_ID) ?? defRecords[0].id);
          } else {
            const anyRes = await idempiereApi(
              `/models/m_locator?$select=M_Locator_ID&$filter=M_Warehouse_ID eq ${info.warehouseId} and IsActive eq true&$top=1`
            );
            const anyRecords = Array.isArray(anyRes.records) ? anyRes.records : [];
            setDefaultLocatorId(anyRecords[0] ? (fkId(anyRecords[0].M_Locator_ID) ?? anyRecords[0].id) : null);
          }
        } catch {
          setDefaultLocatorId(null);
        }

        await fetchProducts('');
      } catch (err) {
        alert('Gagal inisialisasi: ' + err.message, 'Error');
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleBarcodeDetected = useCallback((code) => {
    const found = products.find(p => p.Value?.toUpperCase() === code.toUpperCase());
    if (found) {
      addToCart(found, 1, { C_UOM_ID: found.C_UOM_ID, Name: found.C_UOM_Name, multiplyRate: 1 });
      setScannerOpen(false);
    } else {
      setScannerOpen(false);
      setSearchValue(code);
      fetchProducts(code);
    }
  }, [products, addToCart, fetchProducts, setSearchValue]);

  // ── Vendor manual — HANYA aktif saat cart kosong (lihat vendorLocked) ──
  const handleSelectVendor = useCallback(async (vendor) => {
    setVendorOpen(false);
    setVendorQuery(vendor.Name);
    const locationId = await getDefaultBPLocation(vendor.C_BPartner_ID);
    if (!locationId) {
      alert(`Vendor "${vendor.Name}" tidak memiliki alamat (C_BPartner_Location) aktif.\nTambahkan alamat vendor terlebih dahulu di Business Partner.`, 'Vendor Tidak Lengkap');
      setSelectedVendor(null);
      return;
    }
    setSelectedVendor({ C_BPartner_ID: vendor.C_BPartner_ID, Name: vendor.Name, locationId, source: 'manual' });
  }, [getDefaultBPLocation]);

  // ── Import lines dari Purchase Order yang Completed/Approved ───────────
  // Vendor otomatis diisi dari header PO (paling akurat) — kalau sebelumnya
  // sudah ada vendor manual/PO lain yang berbeda, cart di-reset dulu supaya
  // tidak ada campuran vendor dalam 1 dokumen M_InOut.
  const handleImportFromPO = useCallback((cartItems, order) => {
    const poVendor = {
      C_BPartner_ID: order.C_BPartner_ID,
      Name:          order.VendorName,
      locationId:    order.C_BPartner_Location_ID,
      source:        'po',
    };

    setCart(prev => {
      const vendorChanged = selectedVendor && selectedVendor.C_BPartner_ID !== poVendor.C_BPartner_ID;
      const base = vendorChanged ? [] : prev;

      const merged = [...base];
      cartItems.forEach(item => {
        const idx = merged.findIndex(i => i.M_Product_ID === item.M_Product_ID && i.sourceOrderLineId === item.sourceOrderLineId);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], Qty: merged[idx].Qty + item.Qty };
        } else {
          merged.push(item);
        }
      });
      return merged;
    });

    setSelectedVendor(poVendor);
    setVendorQuery(poVendor.Name || '');
    alert(`${cartItems.length} item dari PO ${order.DocumentNo} berhasil diimport.\nVendor otomatis diset ke: ${poVendor.Name}`, 'Import Berhasil');
  }, [setCart, selectedVendor]);

  // Reset vendor + cart supaya user bisa mulai sesi penerimaan baru
  // (mis. ganti ke PO/vendor lain).
  const handleResetVendor = useCallback(() => {
    setSelectedVendor(null);
    setVendorQuery('');
    clearCart();
  }, [clearCart]);

  const handleSubmit = async () => {
    if (!docTypeId) {
      alert('Document Type belum siap (gagal di-resolve). Cek konfigurasi Document Type "MMR" di iDempiere, lalu muat ulang halaman.', 'Error');
      return;
    }
    if (!selectedVendor) {
      alert('Vendor belum ditentukan. Import dari Purchase Order, atau pilih vendor manual.', 'Vendor Belum Dipilih');
      return;
    }
    const result = await submit(cart, {
      warehouseId:      warehouseInfo?.id,
      locatorId:        defaultLocatorId,
      vendorId:         selectedVendor.C_BPartner_ID,
      vendorLocationId: selectedVendor.locationId,
      vendorName:       selectedVendor.Name,
    });
    if (result) {
      setSuccessData(result);
      handleResetVendor();
      setCartOpen(false);
      setSuccessOpen(true);
    }
  };

  const cartSummaryRight = `📦 ${warehouseInfo?.name || '...'}`;

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
        confirmLabel="Tambah ke Penerimaan"
      />

      <GoodsReceiptSuccessModal
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

      <PurchaseOrderImportModal
        isOpen={importOpen}
        warehouseId={warehouseInfo?.id}
        onClose={() => setImportOpen(false)}
        onImport={handleImportFromPO}
      />

      {/* Top Bar */}
      <div className='header'>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, WebkitTapHighlightColor: 'transparent',
          }}
        ><HomeIcon/></button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', flex: 1 }}>📦 Penerimaan Barang</span>
        <span style={{
          background: 'rgba(255,255,255,0.18)', borderRadius: '20px',
          padding: '3px 10px', fontSize: '11px', color: '#e0eaff', whiteSpace: 'nowrap',
        }}>
          {warehouseInfo?.name || '...'}
        </span>
      </div>

      {/* Vendor strip */}
      <div style={{
        background: vendorLocked ? '#f0fdf4' : '#dbeafe', padding: '8px 16px', fontSize: '12px', color: COLOR.textMd,
        display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0,
        position: 'relative',
      }}>
        <span>🚚</span>

        {vendorLocked ? (
          <>
            <div style={{ fontSize: '12px' }}>
              Vendor (dari PO): <strong style={{ color: COLOR.textDk }}>{selectedVendor?.Name}</strong>
              <span style={{ marginLeft: '6px', color: COLOR.success }}>🔒</span>
            </div>
            <button
              onClick={handleResetVendor}
              title="Kosongkan cart & ganti PO/vendor"
              style={{
                background: 'none', border: 'none', color: COLOR.danger,
                fontSize: '11px', cursor: 'pointer', fontWeight: 600, padding: 0,
              }}
            >✕ Reset & Ganti PO</button>
          </>
        ) : (
          <>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '360px' }}>
              <input
                type="text"
                value={vendorQuery}
                onChange={e => {
                  setVendorQuery(e.target.value);
                  setSelectedVendor(null);
                  setVendorOpen(true);
                  searchVendor(e.target.value);
                }}
                onFocus={() => setVendorOpen(true)}
                placeholder="Vendor manual (tanpa PO)..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '6px 10px',
                  border: `1.5px solid ${selectedVendor ? COLOR.success : COLOR.border}`,
                  borderRadius: RADIUS.sm, fontSize: '12px', outline: 'none',
                  background: '#fff',
                }}
              />
              {vendorOpen && vendorQuery && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                  background: COLOR.surface, border: `1px solid ${COLOR.border}`,
                  borderRadius: RADIUS.md, boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                  maxHeight: '220px', overflowY: 'auto', zIndex: 200,
                }}>
                  {vendorLoading ? (
                    <div style={{ padding: '10px', fontSize: '12px', color: COLOR.textLt }}>Mencari...</div>
                  ) : vendors.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '12px', color: COLOR.textLt }}>Vendor tidak ditemukan.</div>
                  ) : (
                    vendors.map(v => (
                      <div
                        key={v.C_BPartner_ID}
                        onClick={() => handleSelectVendor(v)}
                        style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', color: COLOR.textDk }}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <strong>{v.Name}</strong> {v.Value ? <span style={{ color: COLOR.textLt }}>({v.Value})</span> : null}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <span style={{ color: COLOR.textLt, fontSize: '11px' }}>
              atau klik 📥 di bawah untuk import dari PO (vendor otomatis terisi)
            </span>
          </>
        )}
      </div>

      {/* Body: dua kolom di desktop (produk + sidebar cart), satu kolom di mobile */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Search bar + Scan + Import PO */}
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
                placeholder="Cari nama / kode produk (tambahan manual)..."
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

            {/* Tombol: Import dari Purchase Order Completed/Approved */}
            <button
              onClick={() => setImportOpen(true)}
              title="Import dari Purchase Order yang sudah Approved"
              style={{
                background: COLOR.success, border: 'none', color: '#fff',
                borderRadius: RADIUS.md, padding: '10px 14px', cursor: 'pointer',
                fontSize: '18px', lineHeight: 1, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
              }}
            >📥</button>
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
              </div>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: COLOR.textLt, marginBottom: '8px' }}>
                  {products.length} produk ditemukan
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
            onClearCart={canSubmitReceipt ? clearCart : undefined}
            totalItems={totalItems}
            totalQty={totalQty}
            summaryRight={cartSummaryRight}
            title="📦 Daftar Penerimaan"
            submitLabel="✅ TERIMA BARANG"
            onSubmit={canSubmitReceipt ? handleSubmit : undefined}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Mobile only: FAB + bottom sheet cart */}
      {!isDesktop && cart.length > 0 && !cartOpen && (
        <CartFab count={totalItems} label="Daftar Penerimaan" onClick={() => setCartOpen(true)} />
      )}

      {!isDesktop && (
        <CartPanel
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          cart={cart}
          onRemove={removeFromCart}
          onQtyChange={updateQty}
          onUomChange={updateUom}
          onClearCart={canSubmitReceipt ? clearCart : undefined}
          totalItems={totalItems}
          totalQty={totalQty}
          summaryRight={cartSummaryRight}
          title="📦 Daftar Penerimaan"
          submitLabel="✅ TERIMA BARANG"
          onSubmit={canSubmitReceipt ? handleSubmit : undefined}
          isSubmitting={isSubmitting}
        />
      )}

      {!canSubmitReceipt && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fef3c7', color: '#92400e', fontSize: '12px',
          padding: '8px 14px', textAlign: 'center', zIndex: 150,
        }}>
          ⚠ Role Anda hanya memiliki akses lihat (read-only) untuk Goods Receipt.
        </div>
      )}
    </div>
  );
};

export default GoodsReceiptContainer;
