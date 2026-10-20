/** ─────────────────────────────────────────────────────────────────────────────
* ShipmentContainer.jsx
* Padanan GoodsReceiptContainer.jsx untuk sisi PENJUALAN — Material Shipment
* (Customer), DocBaseType MMS, IsSOTrx = true.
*
*   1. Tombol 📥 di sebelah Scan QR membuka SalesOrderImportModal.
*   2. Customer & alamat kirim otomatis terisi dari header SO saat import.
*   3. Customer DIKUNCI selama cart berisi item hasil import SO, supaya header
*      M_InOut tidak beda customer dengan line yang sudah ter-link
*      C_OrderLine_ID. "Reset" untuk ganti SO/customer.
*   4. Pencarian customer manual tersedia sebagai fallback HANYA saat cart
*      kosong (pengiriman di luar SO, mis. sample / pinjam-pakai).
*   5. Complete akan mengurangi stok locator — kalau stok kurang, dokumen
*      tetap tersimpan sebagai Draft (lihat useShipmentSubmit).
* ─────────────────────────────────────────────────────────────────────────────
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import SalesOrderImportModal from '@/features/material/shipment/components/SalesOrderImportModal';
import ShipmentSuccessModal from '@/features/material/shipment/components/ShipmentSuccessModal';
import { useShipmentSubmit } from '@/features/material/shipment/hooks/useShipmentSubmit';
import { useCustomerSearch } from '@/features/material/shipment/hooks/useCustomerSearch';
import {
  Dialog,
  CartFab,
  CartPanel,
  CartSidebar,
  ProductGrid,
  BarcodeScanner,
  ProductDetailSheet,
  DeliveryIcon,
  ScanIcon,
  ImportIcon
} from '@/shared/components';

import {
  useCart,
  useIsDesktop,
  useProductSearch,
  getLoginInfo,
  getMissingSessionFields,
  sessionFieldLabel,
} from '@/shared/hooks';

import { useAccess } from '@/context/AccessContext';

import { idempiereApi, fkId } from '@/api/idempiereApi';

import {
  resolveDocTypeId,
  DOC_BASE_TYPE, IS_SO_TRX,
  COLOR, RADIUS
} from '@/utils';

import {
  todayLocalISO,
  formatDateID,
} from '@/utils/dateOnly';

import '@/css/Header.css';

const SHIPMENT_DESCRIPTION = 'Material Shipment';

const ShipmentContainer = () => {
  const isDesktop = useIsDesktop();

  const [warehouseInfo, setWarehouseInfo]       = useState(null);
  const [defaultLocatorId, setDefaultLocatorId] = useState(null);
  const [docTypeId, setDocTypeId]               = useState(null);

  // ── Customer (BPartner) penerima barang ─────────────────────────────────
  const [customerQuery, setCustomerQuery]       = useState('');
  const [customerOpen, setCustomerOpen]         = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // { C_BPartner_ID, Name, locationId, source: 'so' | 'manual' }

  const [cartOpen, setCartOpen]       = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [dialog, setDialog]           = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const searchRef = useRef(null);
  const [movementDate, setMovementDate] = useState(todayLocalISO);

  const alert = (message, title = 'Perhatian') => setDialog({ isOpen: true, title, message });

  const { products, loading: productsLoading, loadingMore, hasMore,
    fetchProducts, loadMore, search, searchValue, setSearchValue
  } = useProductSearch();
  const { cart, setCart, addToCart, removeFromCart, updateQty, updateUom, clearCart, totalQty, totalItems } = useCart();
  const { customers, loading: customerLoading, search: searchCustomer, getDefaultBPLocation } = useCustomerSearch();
  const { submit, isSubmitting } = useShipmentSubmit({
    docTypeId,
    description: SHIPMENT_DESCRIPTION,
    onError:     alert,
  });
  const { canEdit } = useAccess();
  const canSubmitShipment = canEdit('shipment');

  // Customer terkunci selama ada minimal 1 item cart yang berasal dari SO.
  const hasSoLinkedItems = cart.some(i => i.sourceOrderLineId);
  const customerLocked   = hasSoLinkedItems;

  useEffect(() => {
    const init = async () => {
      try {
        const info = getLoginInfo();
        const missing = getMissingSessionFields(info);
        if (missing.length) {
          alert(
            `Data sesi tidak lengkap:\n${missing.map(k => `• ${sessionFieldLabel(k)}`).join('\n')}\n\nSilakan login kembali.`,
            'Sesi Tidak Valid'
          );
          return;
        }

        try {
          const wh = await idempiereApi(`/models/m_warehouse/${info.warehouseId}?$select=M_Warehouse_ID,Name`);
          setWarehouseInfo({ id: info.warehouseId, name: wh.Name || `WH #${info.warehouseId}` });
        } catch {
          setWarehouseInfo({ id: info.warehouseId, name: `WH #${info.warehouseId}` });
        }

        // Resolve C_DocType_ID dinamis: DocBaseType 'MMS' (Material Delivery /
        // Shipment) + IsSOTrx = true. BUKAN hardcode.
        try {
          const dt = await resolveDocTypeId(DOC_BASE_TYPE.MATERIAL_SHIPMENT, { orgId: info.orgId, isSOTrx: IS_SO_TRX.SALES });
          setDocTypeId(dt);
        } catch (err) {
          alert(err.message, 'Document Type Tidak Ditemukan');
        }

        // Locator default gudang ini — fallback ke locator aktif pertama.
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

  // ── Customer manual — HANYA aktif saat cart kosong (lihat customerLocked) ──
  const handleSelectCustomer = useCallback(async (customer) => {
    setCustomerOpen(false);
    setCustomerQuery(customer.Name);
    const locationId = await getDefaultBPLocation(customer.C_BPartner_ID);
    if (!locationId) {
      alert(`Customer "${customer.Name}" tidak memiliki alamat (C_BPartner_Location) aktif.\nTambahkan alamat customer terlebih dahulu di Business Partner.`, 'Customer Tidak Lengkap');
      setSelectedCustomer(null);
      return;
    }
    setSelectedCustomer({ C_BPartner_ID: customer.C_BPartner_ID, Name: customer.Name, locationId, source: 'manual' });
  }, [getDefaultBPLocation]);

  // ── Import lines dari Sales Order Completed ─────────────────────────────
  // Customer otomatis diisi dari header SO. Kalau sebelumnya sudah ada
  // customer lain, cart di-reset dulu supaya 1 dokumen M_InOut = 1 customer.
  const handleImportFromSO = useCallback((cartItems, order) => {
    const soCustomer = {
      C_BPartner_ID: order.C_BPartner_ID,
      Name:          order.CustomerName,
      locationId:    order.C_BPartner_Location_ID,
      source:        'so',
    };

    if (!soCustomer.locationId) {
      alert(`SO ${order.DocumentNo} tidak memiliki alamat kirim (C_BPartner_Location).\nLengkapi dulu di Sales Order.`, 'Import Gagal');
      return;
    }

    setCart(prev => {
      const customerChanged = selectedCustomer && selectedCustomer.C_BPartner_ID !== soCustomer.C_BPartner_ID;
      const base = customerChanged ? [] : prev;

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

    setSelectedCustomer(soCustomer);
    setCustomerQuery(soCustomer.Name || '');
    alert(`${cartItems.length} item dari SO ${order.DocumentNo} berhasil diimport.\nCustomer otomatis diset ke: ${soCustomer.Name}`, 'Import Berhasil');
  }, [setCart, selectedCustomer]);

  // Reset customer + cart supaya user bisa mulai sesi pengiriman baru.
  const handleResetCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    clearCart();
  }, [clearCart]);

  const handleSubmit = async (submitMode = 'complete') => {
    if (!docTypeId) {
      alert('Document Type belum siap (gagal di-resolve). Cek konfigurasi Document Type "MMS" (Material Delivery) di iDempiere, lalu muat ulang halaman.', 'Error');
      return;
    }
    if (!selectedCustomer) {
      alert('Customer belum ditentukan. Import dari Sales Order, atau pilih customer manual.', 'Customer Belum Dipilih');
      return;
    }
    if (!movementDate) {
      alert('Tanggal pengiriman belum diisi.', 'Data Belum Lengkap');
      return;
    }
    const result = await submit(cart, {
      warehouseId:        warehouseInfo?.id,
      locatorId:          defaultLocatorId,
      customerId:         selectedCustomer.C_BPartner_ID,
      customerLocationId: selectedCustomer.locationId,
      customerName:       selectedCustomer.Name,
      movementDate,
      submitMode,
    });
    if (result) {
      setSuccessData(result);
      handleResetCustomer();
      setMovementDate(todayLocalISO());
      setCartOpen(false);
      setSuccessOpen(true);
    }
  };

  const handleSubmitDraft    = () => handleSubmit('draft');
  const handleSubmitComplete = () => handleSubmit('complete');

  const isNotToday = movementDate !== todayLocalISO();
  const cartSummaryRight =
    `📦 ${warehouseInfo?.name || '...'}` +
    (isNotToday && movementDate ? ` · 📅 ${formatDateID(movementDate)}` : '');

  return (
    <div style={styles.container}>
      {/* Modals & Dialogs */}
      <Dialog
        isOpen={dialog.isOpen} title={dialog.title} message={dialog.message}
        onClose={() => setDialog({ isOpen: false, title: '', message: '' })}
      />

      <ProductDetailSheet
        isOpen={detailOpen}
        product={selectedProduct}
        onClose={closeProductDetail}
        onConfirm={handleConfirmAddToCart}
        confirmLabel="Tambah ke Pengiriman"
      />

      <ShipmentSuccessModal
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

      <SalesOrderImportModal
        isOpen={importOpen}
        warehouseId={warehouseInfo?.id}
        onClose={() => setImportOpen(false)}
        onImport={handleImportFromSO}
      />

      {/* Top Bar */}
      <div className='header-content'>
        <span style={styles.headerTitle}>
          <DeliveryIcon />
          <span>Material Shipment</span>
        </span>

        {/* Customer strip */}
        <div style={styles.customerStrip}>
          <span>🧑‍💼</span>

          {customerLocked ? (
            <>
              <div style={{ fontSize: '12px' }}>
                Customer (dari SO): <strong style={{ color: COLOR.textDk }}>{selectedCustomer?.Name}</strong>
                <span style={{ marginLeft: '6px', color: COLOR.success }}>🔒</span>
              </div>
              <button
                onClick={handleResetCustomer}
                title="Kosongkan cart & ganti SO/customer"
                style={styles.btnReset}
              >✕ Reset & Ganti SO</button>
            </>
          ) : (
            <>
              <div style={styles.customerInputWrapper}>
                <input
                  type="text"
                  value={customerQuery}
                  onChange={e => {
                    setCustomerQuery(e.target.value);
                    setSelectedCustomer(null);
                    setCustomerOpen(true);
                    searchCustomer(e.target.value);
                  }}
                  onFocus={() => setCustomerOpen(true)}
                  placeholder="Customer manual (tanpa SO)..."
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '6px 10px',
                    border: `1.5px solid ${selectedCustomer ? COLOR.success : COLOR.border}`,
                    borderRadius: RADIUS.sm, fontSize: '12px', outline: 'none',
                    background: '#fff',
                  }}
                />
                {customerOpen && customerQuery && (
                  <div style={styles.customerDropdown}>
                    {customerLoading ? (
                      <div style={styles.dropdownEmpty}>Mencari...</div>
                    ) : customers.length === 0 ? (
                      <div style={styles.dropdownEmpty}>Customer tidak ditemukan.</div>
                    ) : (
                      customers.map(c => (
                        <div
                          key={c.C_BPartner_ID}
                          onClick={() => handleSelectCustomer(c)}
                          style={styles.dropdownItem}
                          onMouseDown={e => e.preventDefault()}
                        >
                          <strong>{c.Name}</strong> {c.Value ? <span style={{ color: COLOR.textLt }}>({c.Value})</span> : null}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <span style={{ color: COLOR.textLt, fontSize: '11px' }}>
                atau klik 📥 di bawah untuk import dari SO (customer otomatis terisi)
              </span>
            </>
          )}

          {/* Warehouse Badge */}
          <div style={styles.badgeWrapper}>
            <span style={styles.badgeLabel}>Warehouse:</span>
            <span style={styles.badgeContent}>🏭 {warehouseInfo?.name || '...'}</span>
          </div>

          {/* Movement Date Picker */}
          <div style={styles.badgeWrapper}>
            <input
              type="date"
              value={movementDate}
              onChange={e => setMovementDate(e.target.value)}
              onBlur={e => { if (!e.target.value) setMovementDate(todayLocalISO()); }}
              disabled={!canSubmitShipment}
              title="Tanggal pengiriman barang (MovementDate)"
              style={{
                background: isNotToday ? 'rgba(196, 11, 51, 0.98)' : 'transparent',
                border: `0px solid ${isNotToday ? '#fbbf24' : 'rgba(255,255,255,0.3)'}`,
                padding: '3px 10px',
                fontSize: '11px',
                color: '#010611',
                cursor: canSubmitShipment ? 'pointer' : 'default',
                outline: 'none',
                maxWidth: isDesktop ? '150px' : '125px',
                colorScheme: 'light',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div style={styles.mainBody}>
        <div style={styles.leftColumn}>

          {/* Search bar + Scan + Import SO */}
          <div style={styles.searchBarContainer}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={styles.searchIcon}>🔍</span>
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
                <button onClick={() => { setSearchValue(''); fetchProducts(''); }} style={styles.btnClearSearch}>
                  ✕
                </button>
              )}
            </div>

            {/* Scan Button */}
            <button
              onClick={() => setScannerOpen(true)}
              title="Scan QR / Barcode"
              style={{ ...styles.iconButton(COLOR.primary), fontSize: '20px' }}
            >
              <ScanIcon />
            </button>

            {/* Import SO Button */}
            <button
              onClick={() => setImportOpen(true)}
              title="Import dari Sales Order yang sudah Completed"
              style={{ ...styles.iconButton(COLOR.success), fontSize: '18px' }}
            >
              <ImportIcon />
            </button>
          </div>

          {/* Product Grid */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            paddingBottom: (!isDesktop && cart.length > 0) ? '80px' : '14px',
          }}>
            <ProductGrid
              products={products}
              loading={productsLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              fetchMore={loadMore}
              onProductClick={openProductDetail}
              isDesktop={isDesktop}
            />
          </div>
        </div>

        {/* Kolom kanan: Cart Sidebar (Desktop) */}
        {isDesktop && (
          <CartSidebar
            cart={cart}
            onRemove={removeFromCart}
            onQtyChange={updateQty}
            onUomChange={updateUom}
            onClearCart={canSubmitShipment ? clearCart : undefined}
            totalItems={totalItems}
            totalQty={totalQty}
            summaryRight={cartSummaryRight}
            title="🚚 Daftar Pengiriman"
            submitLabel="✅ KIRIM BARANG"
            onSubmitDraft={canSubmitShipment ? handleSubmitDraft : undefined}
            onSubmitComplete={canSubmitShipment ? handleSubmitComplete : undefined}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Mobile Cart FAB & Sheet */}
      {!isDesktop && cart.length > 0 && !cartOpen && (
        <CartFab count={totalItems} label="Daftar Pengiriman" onClick={() => setCartOpen(true)} />
      )}

      {!isDesktop && (
        <CartPanel
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          cart={cart}
          onRemove={removeFromCart}
          onQtyChange={updateQty}
          onUomChange={updateUom}
          onClearCart={canSubmitShipment ? clearCart : undefined}
          totalItems={totalItems}
          totalQty={totalQty}
          summaryRight={cartSummaryRight}
          title="🚚 Daftar Pengiriman"
          submitLabel="✅ KIRIM BARANG"
          onSubmitDraft={canSubmitShipment ? handleSubmitDraft : undefined}
          onSubmitComplete={canSubmitShipment ? handleSubmitComplete : undefined}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Read-Only Banner */}
      {!canSubmitShipment && (
        <div style={styles.readOnlyBanner}>
          ⚠ Role Anda hanya memiliki akses lihat (read-only) untuk Shipment.
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    flex: 1, minHeight: 0, background: COLOR.bg,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    display: 'flex', flexDirection: 'column', position: 'relative',
    overflow: 'hidden',
  },
  headerTitle: {
    color: '#374151',
    fontWeight: 700,
    fontSize: '15px',
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  customerStrip: {
    background: '#f4f6fb',
    padding: '8px 16px',
    fontSize: '12px',
    color: COLOR.textMd,
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
    flexShrink: 0,
    position: 'relative',
  },
  btnReset: {
    background: 'none', border: 'none', color: COLOR.danger,
    fontSize: '11px', cursor: 'pointer', fontWeight: 600, padding: 0,
  },
  customerInputWrapper: { position: 'relative', flex: 1, minWidth: '200px', maxWidth: '360px' },
  customerDropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
    background: COLOR.surface, border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md, boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
    maxHeight: '220px', overflowY: 'auto', zIndex: 200,
  },
  badgeWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '3px',
    padding: '2px 8px 2px 10px',
  },
  badgeLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    whiteSpace: 'nowrap',
  },
  badgeContent: {
    background: 'transparent',
    padding: '3px 10px', fontSize: '11px', color: '#000b22', whiteSpace: 'nowrap',
  },
  mainBody: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
  leftColumn: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  searchBarContainer: {
    padding: '12px 14px', background: COLOR.surface, borderBottom: `1px solid ${COLOR.border}`,
    display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
  },
  searchIcon: { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' },
  btnClearSearch: {
    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: COLOR.textLt,
    fontSize: '16px', padding: '2px',
  },
  iconButton: (bg) => ({
    background: bg, border: 'none', color: '#fff',
    borderRadius: RADIUS.md, padding: '10px 14px', cursor: 'pointer',
    lineHeight: 1, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
  }),
  dropdownItem: { padding: '8px 12px', fontSize: '12px', cursor: 'pointer', color: COLOR.textDk },
  dropdownEmpty: { padding: '10px', fontSize: '12px', color: COLOR.textLt },
  readOnlyBanner: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fef3c7', color: '#92400e', fontSize: '12px',
    padding: '8px 14px', textAlign: 'center', zIndex: 150,
  }
};

export default ShipmentContainer;
