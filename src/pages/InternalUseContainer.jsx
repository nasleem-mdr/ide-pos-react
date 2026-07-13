import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Dialog from '../components/common/Dialog';
import CartFab from '../components/cart/CartFab';
import ProductCard from '../components/product/ProductCard';
import ProductDetailSheet from '../components/product/ProductDetailSheet';
import BarcodeScanner from '../components/scanner/BarcodeScanner';
import ChargePickerModal from '../components/internaluse/ChargePickerModal';
import InventoryPickerModal from '../components/internaluse/InventoryPickerModal';
import InternalUseSuccessModal from '../components/internaluse/InternalUseSuccessModal';
import InternalUseCartSidebar from '../components/internaluse/InternalUseCartSidebar';
import InternalUseCartPanel from '../components/internaluse/InternalUseCartPanel';
import { useInternalUseCart } from '../hooks/useInternalUseCart';
import { useInternalUseSubmit } from '../hooks/useInternalUseSubmit';
import { useProductStock } from '../hooks/useProductStock';
import { useAccess } from '../context/AccessContext';
import { useProductSearch } from '../hooks/useProductSearch';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { getLoginInfo, getMissingSessionFields } from '../hooks/useLoginInfo';
import { resolveDocTypeId, DOC_BASE_TYPE, DOC_SUB_TYPE_INV } from '../utils/docTypeResolver';
import { idempiereApi } from '../utils/idempiereApi';
import { COLOR, RADIUS } from '../utils/styleTokens';
import '../css/Header.css';
import { HomeIcon } from '../components/Icons';

const INTERNAL_USE_DESCRIPTION = 'Internal Use via Web';

const InternalUseContainer = () => {
  const navigate  = useNavigate();
  const isDesktop = useIsDesktop();

  const [warehouseInfo, setWarehouseInfo] = useState(null);
  const [docTypeId, setDocTypeId] = useState(null);

  const [cartOpen, setCartOpen]       = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [dialog, setDialog]           = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [chargePickerTarget, setChargePickerTarget] = useState(null);

  const searchRef = useRef(null);
  const alert = (message, title = 'Perhatian') => setDialog({ isOpen: true, title, message });

  const { products, loading: productsLoading, fetchProducts, search, searchValue, setSearchValue } = useProductSearch();
  const {
    cart, addItem, addItems, removeItem, removeItems, updateQty, updateCharge, updateUom,
    setItemResolving, updateItemWarehouseStock,
    clearCart, totalItems, totalQty, missingChargeCount,
  } = useInternalUseCart();
  // ⚠️ warehouses + resolveProductStock dipakai bareng di sini (search
  // manual & scan barcode) DAN di InventoryPickerModal (instance hook
  // terpisah di sana). Daftar warehouse di-fetch sekali saat init supaya
  // dropdown 🏭 di InternalUseCartItem langsung terisi.
  const { warehouses, fetchWarehouses, resolveProductStock } = useProductStock();
  const { submit, isSubmitting } = useInternalUseSubmit({
    docTypeId,
    description: INTERNAL_USE_DESCRIPTION,
    onError: alert,
  });
  const { canEdit } = useAccess();
  const canSubmitIU = canEdit('internalUse');

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
          const dt = await resolveDocTypeId(DOC_BASE_TYPE.MATERIAL_INVENTORY, {
            orgId: info.orgId,
            docSubTypeInv: DOC_SUB_TYPE_INV.INTERNAL_USE, // 'IU' — WAJIB, karena
            // DocBaseType 'MMI' dipakai bareng oleh Physical Inventory ('PI') juga.
          });
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

        // Daftar semua gudang — dipakai utk dropdown 🏭 per item di cart,
        // supaya user bisa ambil barang dari gudang selain default sesi login.
        fetchWarehouses();

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

  const handleConfirmAddToCart = useCallback(async (product, qty, uom) => {
    closeProductDetail();
    if (!warehouseInfo?.id) return;

    const stock = await resolveProductStock(product.M_Product_ID, warehouseInfo.id);
    if (!stock) {
      alert(`Produk "${product.Name}" tidak memiliki stok di gudang ${warehouseInfo.name}.`, 'Stok Tidak Tersedia');
      return;
    }

    const matchedUom = stock.uomOptions?.find(u => u.C_UOM_ID === (uom?.C_UOM_ID || product.C_UOM_ID)) || stock.uomOptions?.[0];

    addItem({
      M_Product_ID:   product.M_Product_ID,
      Name:           product.Name,
      UomName:        matchedUom?.Name || product.C_UOM_Name,
      Qty:            qty,
      QtyOnHand:      stock.QtyOnHand,
      // Gudang sumber stok saat pertama kali ditambahkan — default ikut
      // gudang aktif user (warehouseInfo), tapi bisa diganti belakangan
      // lewat dropdown 🏭 di InternalUseCartItem (lihat handleItemWarehouseChange).
      M_Warehouse_ID: warehouseInfo.id,
      WarehouseName:  warehouseInfo.name,
      M_Locator_ID:   stock.M_Locator_ID,
      LocatorName:    stock.LocatorName,
      C_Charge_ID:    stock.DefaultChargeId,
      ChargeName:     stock.DefaultChargeName,
      uomOptions:     stock.uomOptions,
      selectedUom:    matchedUom,
    });
  }, [addItem, resolveProductStock, warehouseInfo, closeProductDetail]);

  const handleBarcodeDetected = useCallback(async (code) => {
    const found = products.find(p => p.Value?.toUpperCase() === code.toUpperCase());
    setScannerOpen(false);
    if (!found) { setSearchValue(code); fetchProducts(code); return; }
    if (!warehouseInfo?.id) return;

    const stock = await resolveProductStock(found.M_Product_ID, warehouseInfo.id);
    if (!stock) {
      alert(`Produk "${found.Name}" tidak memiliki stok di gudang ${warehouseInfo.name}.`, 'Stok Tidak Tersedia');
      return;
    }

    addItem({
      M_Product_ID:   found.M_Product_ID,
      Name:           found.Name,
      UomName:        stock.uomOptions?.[0]?.Name || found.C_UOM_Name,
      Qty:            1,
      QtyOnHand:      stock.QtyOnHand,
      M_Warehouse_ID: warehouseInfo.id,
      WarehouseName:  warehouseInfo.name,
      M_Locator_ID:   stock.M_Locator_ID,
      LocatorName:    stock.LocatorName,
      C_Charge_ID:    stock.DefaultChargeId,
      ChargeName:     stock.DefaultChargeName,
      uomOptions:     stock.uomOptions,
      selectedUom:    stock.uomOptions?.[0],
    });
  }, [products, addItem, resolveProductStock, warehouseInfo, fetchProducts, setSearchValue]);

  const handleImportFromPicker = useCallback((items) => {
    // items sudah bawa M_Warehouse_ID/WarehouseName dari InventoryPickerModal
    // (sesuai gudang yang aktif dipilih user di modal itu).
    addItems(items);
    const missingChargeInBatch = items.filter(i => !i.C_Charge_ID).length;
    alert(
      `${items.length} produk berhasil diimport ke daftar pengambilan.` +
      (missingChargeInBatch > 0 ? `\n⚠ ${missingChargeInBatch} produk belum punya Charge default — lengkapi manual di cart.` : ''),
      'Import Berhasil'
    );
  }, [addItems]);

  const handleChargeClick = useCallback((item) => {
    setChargePickerTarget(item.M_Product_ID);
  }, []);

  const handleChargePicked = useCallback((charge) => {
    if (chargePickerTarget) updateCharge(chargePickerTarget, charge);
    setChargePickerTarget(null);
  }, [chargePickerTarget, updateCharge]);

  // Ganti gudang sumber stok utk 1 item di cart. Locator, QtyOnHand, dan
  // opsi UOM di-resolve ULANG utk gudang baru — TIDAK cuma ganti label.
  // Qty entry (item.Qty) sengaja tidak diubah.
  const handleItemWarehouseChange = useCallback(async (productId, newWarehouseId) => {
    const cartItem = cart.find(i => i.M_Product_ID === productId);
    if (!cartItem) return;

    setItemResolving(productId, true);
    try {
      const stock = await resolveProductStock(productId, newWarehouseId);
      if (!stock) {
        const whName = warehouses.find(w => w.M_Warehouse_ID === newWarehouseId)?.Name || newWarehouseId;
        alert(`Produk "${cartItem.Name}" tidak memiliki stok di gudang ${whName}.`, 'Stok Tidak Tersedia');
        setItemResolving(productId, false);
        return;
      }

      const newWarehouseName = warehouses.find(w => w.M_Warehouse_ID === newWarehouseId)?.Name;
      // Coba pertahankan UOM yang sama (mis. "Dus") kalau tersedia juga di
      // gudang baru; kalau tidak ada, fallback ke opsi pertama.
      const matchedUom = stock.uomOptions?.find(u => u.C_UOM_ID === cartItem.selectedUom?.C_UOM_ID) || stock.uomOptions?.[0];

      updateItemWarehouseStock(productId, {
        M_Warehouse_ID: newWarehouseId,
        WarehouseName:  newWarehouseName,
        M_Locator_ID:   stock.M_Locator_ID,
        LocatorName:    stock.LocatorName,
        QtyOnHand:      stock.QtyOnHand,
        uomOptions:     stock.uomOptions,
        selectedUom:    matchedUom,
        // Charge TIDAK ditimpa kalau item sudah punya charge (charge itu
        // atribut produk, bukan atribut gudang) — cuma di-suggest kalau
        // sebelumnya belum ada.
        C_Charge_ID: cartItem.C_Charge_ID || stock.DefaultChargeId,
        ChargeName:  cartItem.ChargeName || stock.DefaultChargeName,
      });
    } catch (err) {
      alert('Gagal memuat stok untuk gudang terpilih:\n' + err.message, 'Error');
      setItemResolving(productId, false);
    }
  }, [cart, resolveProductStock, warehouses, setItemResolving, updateItemWarehouseStock, alert]);

  const handleSubmit = async () => {
    const result = await submit(cart, { warehouseId: warehouseInfo?.id });
    if (!result) return;

    const { documents, failed } = result;

    // Hanya hapus dari cart produk yang dokumennya BERHASIL di-Complete.
    // Produk pada kelompok gudang yang gagal sengaja dibiarkan di cart
    // supaya user bisa submit ulang tanpa input dari awal (lihat catatan
    // partial-success di useInternalUseSubmit.jsx).
    const succeededProductIds = documents.flatMap(d => d.items.map(i => i.M_Product_ID));
    removeItems(succeededProductIds);

    // ⚠️ successData sekarang array dokumen (bisa >1 kalau cart berisi
    // beberapa gudang sekaligus). InternalUseSuccessModal perlu disesuaikan
    // untuk menampilkan daftar dokumen, bukan cuma 1 documentNo/date/items.
    setSuccessData({ documents });
    setSuccessOpen(true);

    if (failed.length === 0) {
      setCartOpen(false);
    }
    // Kalau ada yang gagal, cart panel/sidebar sengaja TIDAK ditutup supaya
    // user langsung lihat sisa item yang gagal (pesan detail sudah
    // ditampilkan oleh useInternalUseSubmit via onError).
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
        onClose={() => setDialog({ isOpen: false, title: '', message: '' })}
      />

      <ProductDetailSheet
        isOpen={detailOpen}
        product={selectedProduct}
        onClose={closeProductDetail}
        onConfirm={handleConfirmAddToCart}
        confirmLabel="Tambah ke Pengambilan"
      />

      <ChargePickerModal
        isOpen={chargePickerTarget !== null}
        onClose={() => setChargePickerTarget(null)}
        onSelect={handleChargePicked}
      />

      <InternalUseSuccessModal
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

      <BarcodeScanner isOpen={scannerOpen} onDetected={handleBarcodeDetected} onClose={() => setScannerOpen(false)} />

      <InventoryPickerModal
        isOpen={pickerOpen}
        defaultWarehouseId={warehouseInfo?.id}
        onClose={() => setPickerOpen(false)}
        onImport={handleImportFromPicker}
      />

      <div className='header'>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, WebkitTapHighlightColor: 'transparent',
          }}
        ><HomeIcon/></button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', flex: 1 }}>📤 Internal Use</span>
        <span style={{
          background: 'rgba(255,255,255,0.18)', borderRadius: '20px',
          padding: '3px 10px', fontSize: '11px', color: '#e0eaff', whiteSpace: 'nowrap',
        }}>
          {warehouseInfo?.name || '...'}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

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
              onClick={() => setPickerOpen(true)}
              title="Lihat ketersediaan stok & pilih banyak produk sekaligus"
              style={{
                background: COLOR.success, border: 'none', color: '#fff',
                borderRadius: RADIUS.md, padding: '10px 14px', cursor: 'pointer',
                fontSize: '18px', lineHeight: 1, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
              }}
            >📦</button>
          </div>

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
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📤</div>
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
          <InternalUseCartSidebar
            cart={cart}
            warehouses={warehouses}
            onRemove={removeItem}
            onQtyChange={updateQty}
            onChargeClick={handleChargeClick}
            onUomChange={updateUom}
            onWarehouseChange={handleItemWarehouseChange}
            onClearCart={canSubmitIU ? clearCart : undefined}
            totalItems={totalItems}
            totalQty={totalQty}
            missingChargeCount={missingChargeCount}
            summaryRight={cartSummaryRight}
            onSubmit={canSubmitIU ? handleSubmit : undefined}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {!isDesktop && totalItems > 0 && !cartOpen && (
        <CartFab count={totalItems} label="Daftar Pengambilan" icon="📤" onClick={() => setCartOpen(true)} />
      )}

      {!isDesktop && (
        <InternalUseCartPanel
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          cart={cart}
          warehouses={warehouses}
          onRemove={removeItem}
          onQtyChange={updateQty}
          onChargeClick={handleChargeClick}
          onUomChange={updateUom}
          onWarehouseChange={handleItemWarehouseChange}
          onClearCart={canSubmitIU ? clearCart : undefined}
          totalItems={totalItems}
          totalQty={totalQty}
          missingChargeCount={missingChargeCount}
          summaryRight={cartSummaryRight}
          onSubmit={canSubmitIU ? handleSubmit : undefined}
          isSubmitting={isSubmitting}
        />
      )}

      {!canSubmitIU && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fef3c7', color: '#92400e', fontSize: '12px',
          padding: '8px 14px', textAlign: 'center', zIndex: 150,
        }}>
          ⚠ Role Anda hanya memiliki akses lihat (read-only) untuk Internal Use.
        </div>
      )}
    </div>
  );
};

export default InternalUseContainer;
