import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Dialog from '../components/common/Dialog';
import CartFab from '../components/cart/CartFab';
import ProductCard from '../components/product/ProductCard';
import ProductDetailSheet from '../components/product/ProductDetailSheet';
import BarcodeScanner from '../components/scanner/BarcodeScanner';
import VendorPickerModal from '../components/purchasing/VendorPickerModal';
import RequisitionToPOImportModal from '../components/purchasing/RequisitionToPOImportModal';
import PurchaseOrderSuccessModal from '../components/purchasing/PurchaseOrderSuccessModal';
import POCartSidebar from '../components/purchasing/POCartSidebar';
import POCartPanel from '../components/purchasing/POCartPanel';
import { usePOCart, lineKey } from '../hooks/usePOCart';
import { usePurchaseOrderSubmit } from '../hooks/usePurchaseOrderSubmit';
import { useProductVendorInfo } from '../hooks/useProductVendorInfo';
import { useUomConversion } from '../hooks/useUomConversion';
import { useAccess } from '../context/AccessContext';
import { useProductSearch } from '../hooks/useProductSearch';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { getLoginInfo, getMissingSessionFields } from '../hooks/useLoginInfo';
import { resolveDocTypeId, DOC_BASE_TYPE } from '../utils/docTypeResolver';
import { idempiereApi } from '../utils/idempiereApi';

import { COLOR, RADIUS } from '../utils/styleTokens';
import '../css/Header.css';
import { HomeIcon } from '../components/Icons';

// ⚠️ WAJIB DISESUAIKAN: ganti dengan C_DocType_ID Document Type "Purchase
// Order" di instance Anda.
// Cek lewat: GET /api/v1/models/c_doctype?$select=C_DocType_ID,Name,DocBaseType&$filter=contains(Name,'Purchase Order')
const PURCHASING_CONFIG = {
  DESCRIPTION:  'Purchase Order via Web',
};


const PurchasingContainer = () => {
  const navigate  = useNavigate();
  const isDesktop = useIsDesktop();

  const [warehouseInfo, setWarehouseInfo] = useState(null);

  const [cartOpen, setCartOpen]       = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [dialog, setDialog]           = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [pendingSuccessOpen, setPendingSuccessOpen] = useState(false);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [docTypeId, setDocTypeId] = useState(null);
  const [description, setDescription]         = useState('');
  // Vendor picker per-baris cart — vendorPickerTarget = itemKey baris yang
  // sedang diganti vendornya (null = modal tertutup).
  const [vendorPickerTarget, setVendorPickerTarget] = useState(null);

  const searchRef = useRef(null);
  const alert = (message, title = 'Perhatian') => setDialog({ isOpen: true, title, message });

  const { products, loading: productsLoading, fetchProducts, search, searchValue, setSearchValue } = useProductSearch();
  const {
    cart, addItem, addItems, removeItem, updateQty, updatePrice, updateVendor,
    clearCart, totalItems, totalAmount, vendorGroups,
  } = usePOCart();
  const { fetchDefaultVendor } = useProductVendorInfo();
  const { toBaseQty } = useUomConversion();
  const { submit, isSubmitting } = usePurchaseOrderSubmit({
    docTypeId,
    defaultDescription: PURCHASING_CONFIG.DESCRIPTION,
    onError:     alert,
  });
  const { canEdit } = useAccess();
  const canSubmitPO = canEdit('purchasing');

  useEffect(() => {
    const init = async () => {
      try {
        const info = getLoginInfo();
        const missing = getMissingSessionFields(info);
        if (missing.length) {
          alert(`Data sesi tidak lengkap:\n${missing.map(k => `• ${k}`).join('\n')}\n\nSilakan login kembali.`, 'Sesi Tidak Valid');
          return;
        }
        // supaya benar untuk client manapun yang login (lihat docTypeResolver.jsx).
        try {
          const dt = await resolveDocTypeId(DOC_BASE_TYPE.PURCHASE_ORDER, { orgId: info.orgId });
            setDocTypeId(dt);
            } catch (err) {
             alert(err.message, 'Document Type Tidak Ditemukan');
        }
        
        try {
          const wh = await idempiereApi(`/models/m_warehouse/${info.warehouseId}?$select=M_Warehouse_ID,Name`);
          setWarehouseInfo({ id: info.warehouseId, name: wh.Name || `WH #${info.warehouseId}` });
        } catch {
          setWarehouseInfo({ id: info.warehouseId, name: `WH #${info.warehouseId}` });
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

  // Tambah produk manual — vendor & harga di-suggest otomatis dari
  // M_Product_PO/M_PriceList kalau ada; kalau tidak ada, item masuk cart
  // tanpa vendor dan ditandai perlu dilengkapi (lihat badge merah di
  // POCartItem).
  //
  // ── HARGA HARUS DI-SCALE KE UOM YANG DIPILIH USER ──────────────────────
  // suggestion.default.Price dari useProductVendorInfo SELALU harga per UOM
  // DASAR produk. toBaseQty(1, uom) dipakai untuk dapat "berapa base unit
  // per 1 entered unit", dipakai ulang untuk scale harga (rumus sama yang
  // sudah terbukti benar untuk qty).
  //
  // UnitsPerBaseUom disimpan di item (= unitsPerEntered) supaya POCartItem
  // bisa tampilkan preview hasil konversi ("≈ 6 pcs") yang tetap akurat
  // walau Qty diedit lagi di cart. BaseUOMName untuk teks preview itu.
  //
  // BaseUOM_ID: SELALU product.C_UOM_ID (UOM dasar produk), dibutuhkan
  // usePurchaseOrderSubmit.jsx untuk konversi saat submit PO.
  const handleConfirmAddToCart = useCallback(async (product, qty, uom) => {
    closeProductDetail();
    const suggestion = await fetchDefaultVendor(product.M_Product_ID);
    const basePrice = suggestion.default?.Price ?? 0;
    const unitsPerEntered = toBaseQty(1, uom); // 1 6-Pack → 6 (base unit per 1 entered unit)
    const priceForEnteredUom = unitsPerEntered > 0 ? basePrice * unitsPerEntered : basePrice;

    addItem({
      M_Product_ID: product.M_Product_ID,
      Name:         product.Name,
      C_UOM_ID:     uom?.C_UOM_ID || product.C_UOM_ID,
      UomName:      uom?.Name || product.C_UOM_Name,
      BaseUOM_ID:   product.C_UOM_ID,   // ← UOM dasar produk, untuk konversi saat submit PO
      BaseUOMName:  product.C_UOM_Name, // ← untuk teks preview konversi di cart
      UnitsPerBaseUom: unitsPerEntered, // ← untuk preview konversi di cart, live walau Qty diedit
      Qty:          qty,
      Price:        priceForEnteredUom, // ← sudah di-scale ke UOM yang dipilih user
      C_BPartner_ID: suggestion.default?.C_BPartner_ID ?? null,
      VendorName:    suggestion.default?.VendorName ?? '',
    });
  }, [addItem, fetchDefaultVendor, closeProductDetail, toBaseQty]);

  const handleBarcodeDetected = useCallback(async (code) => {
    const found = products.find(p => p.Value?.toUpperCase() === code.toUpperCase());
    setScannerOpen(false);
    if (found) {
      const suggestion = await fetchDefaultVendor(found.M_Product_ID);
      // Barcode selalu tambah dalam UOM DASAR produk (tidak ada langkah
      // pilih UOM di alur scan cepat ini) — jadi harga TIDAK perlu
      // di-scale, dan UnitsPerBaseUom = 1 (tidak ada konversi, tidak perlu
      // preview di cart).
      addItem({
        M_Product_ID: found.M_Product_ID,
        Name:         found.Name,
        C_UOM_ID:     found.C_UOM_ID,
        UomName:      found.C_UOM_Name,
        BaseUOM_ID:   found.C_UOM_ID,
        BaseUOMName:  found.C_UOM_Name,
        UnitsPerBaseUom: 1,
        Qty:          1,
        Price:        suggestion.default?.Price ?? 0,
        C_BPartner_ID: suggestion.default?.C_BPartner_ID ?? null,
        VendorName:    suggestion.default?.VendorName ?? '',
      });
    } else {
      setSearchValue(code);
      fetchProducts(code);
    }
  }, [products, addItem, fetchDefaultVendor, fetchProducts, setSearchValue]);
  
  const handleClearCart = useCallback(() => {
    clearCart();
    setDescription('');
  }, [clearCart]);

  const handleImportFromRequisition = useCallback((cartItems, requisition) => {
    addItems(cartItems);
    setDescription(prev => prev.trim() ? prev : (requisition.Description || `Import dari FPB ${requisition.DocumentNo}`));
    const vendorCount = new Set(cartItems.map(i => i.C_BPartner_ID)).size;
    alert(
      `${cartItems.length} item dari FPB ${requisition.DocumentNo} berhasil diimport.\n` +
      `Akan menghasilkan ${vendorCount} Purchase Order terpisah saat submit.`,
      'Import Berhasil'
    );
  }, [addItems]);

  const handleVendorClick = useCallback((item, itemKey) => {
    setVendorPickerTarget(itemKey);
  }, []);

  const handleVendorPicked = useCallback((vendor) => {
    if (vendorPickerTarget) updateVendor(vendorPickerTarget, vendor);
    setVendorPickerTarget(null);
  }, [vendorPickerTarget, updateVendor]);
  const handleSubmit = async (mode = 'complete') => {
    const { results, hadError } = await submit(cart, {
      warehouseId: warehouseInfo?.id,
      description, mode,
    });
    if (!results || results.length === 0) return;
  
    setSuccessData(results);
    clearCart();
    setCartOpen(false);
  
    if (hadError) {
      setPendingSuccessOpen(true);
    } else {
      setSuccessOpen(true);
    }
  };

  const cartSummaryRight = `📦 ${warehouseInfo?.name || '...'}`;

  return (
    <div style={{
      flex: 1, minHeight: 0, background: COLOR.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      <Dialog
        isOpen={dialog.isOpen} title={dialog.title} message={dialog.message}
        onClose={() => {
          setDialog({ isOpen: false, title: '', message: '' });
          // Kalau ada success modal yang ditunda (kasus partial success +
          // error), tampilkan sekarang setelah user selesai baca errornya.
          if (pendingSuccessOpen) {
            setPendingSuccessOpen(false);
            setSuccessOpen(true);
          }
        }}
      />

      <ProductDetailSheet
        isOpen={detailOpen}
        product={selectedProduct}
        onClose={closeProductDetail}
        onConfirm={handleConfirmAddToCart}
        confirmLabel="Tambah ke PO"
      />

      <VendorPickerModal
        isOpen={vendorPickerTarget !== null}
        onClose={() => setVendorPickerTarget(null)}
        onSelect={handleVendorPicked}
      />

      <PurchaseOrderSuccessModal
        isOpen={successOpen}
        data={successData}
        onClose={() => {
          setSuccessOpen(false);
          setSuccessData(null);
          setDescription(''); // ← tambahan
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

      <RequisitionToPOImportModal
        isOpen={importOpen}
        warehouseId={warehouseInfo?.id}
        onClose={() => setImportOpen(false)}
        onImport={handleImportFromRequisition}
      />

      {/* Top Bar */}
      <div className='header-purchasing'>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, WebkitTapHighlightColor: 'transparent',
          }}
        ><HomeIcon/></button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', flex: 1 }}>🧾 Purchasing</span>
        <span style={{
          background: 'rgba(255,255,255,0.18)', borderRadius: '20px',
          padding: '3px 10px', fontSize: '11px', color: '#e0eaff', whiteSpace: 'nowrap',
        }}>
          {warehouseInfo?.name || '...'}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Search + Scan + Import FPB */}
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

            <button
              onClick={() => setImportOpen(true)}
              title="Import dari FPB yang sudah Approved"
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
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🧾</div>
                <p style={{ margin: 0 }}>Tidak ada produk ditemukan.</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: COLOR.textLt, marginBottom: '8px' }}>
                  {products.length} produk ditemukan
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(170px, 1fr))' : 'repeat(2, 1fr)',
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

        {isDesktop && (
          <POCartSidebar
            isOpen={cartOpen}
            onClose={() => setCartOpen(false)}
            vendorGroups={vendorGroups}
            onRemove={removeItem}
            onQtyChange={updateQty}
            onPriceChange={updatePrice}
            onVendorClick={handleVendorClick}
            onClearCart={canSubmitPO ? handleClearCart : undefined}
            totalItems={totalItems}
            totalAmount={totalAmount}
            summaryRight={cartSummaryRight}
            onSubmitDraft={canSubmitPO ? handleSubmit : undefined}
            onSubmitComplete={canSubmitPO ? handleSubmit : undefined}
            isSubmitting={isSubmitting}
            description={description}
            onDescriptionChange={canSubmitPO ? setDescription : undefined}
            descriptionPlaceholder={PURCHASING_CONFIG.DESCRIPTION}
          />
        )}
      </div>

      {!isDesktop && totalItems > 0 && !cartOpen && (
        <CartFab count={totalItems} label="Daftar PO" icon="🧾" onClick={() => setCartOpen(true)} />
      )}

      {!isDesktop && (
        <POCartPanel
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          vendorGroups={vendorGroups}
          onRemove={removeItem}
          onQtyChange={updateQty}
          onPriceChange={updatePrice}
          onVendorClick={handleVendorClick}
          onClearCart={canSubmitPO ? handleClearCart : undefined}
          totalItems={totalItems}
          totalAmount={totalAmount}
          summaryRight={cartSummaryRight}
          onSubmitDraft={canSubmitPO ? handleSubmit : undefined}
          nSubmitComplete={canSubmitPO ? handleSubmit : undefined}
          isSubmitting={isSubmitting}
        />
      )}

      {!canSubmitPO && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fef3c7', color: '#92400e', fontSize: '12px',
          padding: '8px 14px', textAlign: 'center', zIndex: 150,
        }}>
          ⚠ Role Anda hanya memiliki akses lihat (read-only) untuk Purchasing.
        </div>
      )}
    </div>
  );
};

export default PurchasingContainer;
