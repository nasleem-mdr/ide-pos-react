// 1. External
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// 2. Feature Hooks
import { useRequisitionSubmit } from '@/features/requisition/hooks/useRequisitionSubmit';

// 3. Feature Component
import { RequisitionSuccessModal } from '@/features/requisition/components';

// 4. Shared Hooks
import { 
  getLoginInfo, 
  getMissingSessionFields, 
  useCart, 
  useProductSearch, 
  useIsDesktop 
} from '@/shared/hooks'; 

// 5. Shared Components
import { 
  Dialog, 
  CartFab, 
  CartPanel, 
  CartSidebar, 
  ProductDetailSheet, 
  BarcodeScanner, 
  RequisitionIcon,
  ScanIcon, 
  ProductGrid 
} from '@/shared/components';

// 6. Utils
import { idempiereApi, fkId } from '@/api/idempiereApi';
import { resolveDocTypeId, DOC_BASE_TYPE } from '@/utils/docTypeResolver';
import { COLOR, RADIUS } from '@/utils/styleTokens';

// 7. Context
import { useAccess } from '@/context/AccessContext';

// 8. Styles
import '@/css/Header.css';

const REQUISITION_CONFIG = {
  DESCRIPTION:  'Purchase Requisition via REST API',
};

const RequisitionContainer = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const isDesktop  = useIsDesktop();
  const searchRef  = useRef(null);
  const [docTypeId, setDocTypeId] = useState(null);
  // ── state ─────────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses]           = useState([]);         // list semua WH
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);   // {id, name}
  const [requesterName, setRequesterName]     = useState('');
  // Description manual — diisi user lewat textarea di CartSidebar/CartPanel,
  // dikirim ke submit() menggantikan REQUISITION_CONFIG.DESCRIPTION yang
  // sebelumnya hardcode. Kosong = fallback ke default di useRequisitionSubmit.
  const [description, setDescription]         = useState('');
  const [cartOpen, setCartOpen]               = useState(false);
  const [scannerOpen, setScannerOpen]         = useState(false);
  const [dialog, setDialog]                   = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData]         = useState(null);
  const [successOpen, setSuccessOpen]         = useState(false);
  const [detailOpen, setDetailOpen]           = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [dateRequired, setDateRequired] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  // ── edit mode state ─────────────────────────────────────────────────────────
  const [editRequisitionId, setEditRequisitionId] = useState(null);
  const [isEditMode, setIsEditMode]               = useState(false);

  const alert = (message, title = 'Perhatian') =>
    setDialog({ isOpen: true, title, message });

  // ── hooks ─────────────────────────────────────────────────────────────────
  const {
    products, loading: productsLoading, loadingMore, hasMore,
    fetchProducts, loadMore, search, searchValue, setSearchValue,
    searchByUPC,
  } = useProductSearch();

  const { cart, addToCart, removeFromCart, updateQty, updateUom, clearCart, setCart, totalQty, totalItems } = useCart();

  const { submit, isSubmitting } = useRequisitionSubmit({
    docTypeId,
    description: REQUISITION_CONFIG.DESCRIPTION,
    dateRequired,
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
      try {
            const dt = await resolveDocTypeId(DOC_BASE_TYPE.PURCHASE_REQUISITION, { orgId: info.orgId });
              setDocTypeId(dt);
            } catch (err) {
              alert(err.message, 'Document Type Tidak Ditemukan');
            }
        // Fetch daftar warehouse aktif untuk org ini
        const whData = await idempiereApi(
          `/models/m_warehouse?$select=M_Warehouse_ID,Name` +
          `&$filter=IsActive eq true and AD_Org_ID eq ${info.orgId}` +
          `&$orderby=Name&$top=50`
        );
        const whList = (whData.records || []).map(w => ({
          id:   w.id ?? fkId(w.M_Warehouse_ID),   // fallback ke PK flat dulu
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

  // ── load draft requisition jika datang dari RequisitionList ────────────────
  useEffect(() => {
    if (warehouses.length === 0) return;

    const editRequisition = location.state?.editRequisition;
    if (!editRequisition) return;

    const incomingId = editRequisition.id ?? editRequisition.M_Requisition_ID;
    if (editRequisitionId === incomingId) return;

    const loadDraftRequisition = async () => {
      try {
        const reqId = editRequisition.id ?? editRequisition.M_Requisition_ID;
        setEditRequisitionId(reqId);
        setIsEditMode(true);

        const whId   = fkId(editRequisition.M_Warehouse_ID);
        const whName = editRequisition.M_Warehouse_ID?.identifier
          || editRequisition.M_Warehouse_ID?.Name;
        const matchedWh = warehouses.find(w => String(w.id) === String(whId));
        const resolvedWh = matchedWh ?? (whId ? { id: whId, name: whName || `Gudang #${whId}` } : null);
        if (resolvedWh) setSelectedWarehouse(resolvedWh);

        // Fetch header requisition (khususnya Description) — editRequisition
        // yang dikirim dari RequisitionList.jsx belum tentu menyertakan
        // Description lengkap, jadi diambil ulang langsung dari server.
        try {
          const headerRes = await idempiereApi(
            `/models/m_requisition/${reqId}?$select=Description,DateRequired`
          );
          setDescription(headerRes.Description || '');
          setDateRequired(
            headerRes.DateRequired
              ? headerRes.DateRequired.split('T')[0]
              : new Date().toISOString().split('T')[0]
          );
        } catch (err) {
          console.error('[RequisitionContainer] gagal ambil Description draft:', err);
          setDescription('');
        }

        // Fetch requisition lines
        const linesRes = await idempiereApi(
          `/models/m_requisitionline?$filter=M_Requisition_ID eq ${reqId}` +
          `&$select=M_RequisitionLine_ID,M_Product_ID,Qty,C_UOM_ID,C_BPartner_ID`
        );
        const lines = Array.isArray(linesRes.records) ? linesRes.records : [];

        const cartItems = lines.map((line) => {
          const productId   = fkId(line.M_Product_ID);
          const productName = line.M_Product_ID?.identifier || line.M_Product_ID?.Name || `Product #${productId}`;
          const uomId        = fkId(line.C_UOM_ID);
          const uomName      = line.C_UOM_ID?.identifier || line.C_UOM_ID?.Name || 'EA';
          const qty          = parseFloat(line.Qty || 1);
          const vendorId     = fkId(line.C_BPartner_ID);
          const vendorName   = line.C_BPartner_ID?.identifier || line.C_BPartner_ID?.Name || null;
          const lineId       = line.id ?? line.M_RequisitionLine_ID;

          const selectedUom = { C_UOM_ID: uomId, Name: uomName, multiplyRate: 1 };

          return {
            M_RequisitionLine_ID: lineId,
            M_Product_ID:         productId,
            Name:                 productName,
            Value:                '',
            VendorId:             vendorId,
            VendorName:           vendorName,
            Qty:                  qty,
            C_UOM_ID:             uomId,
            C_UOM_Name:           uomName,
            uomOptions:           [selectedUom],
            selectedUom,
          };
        });

        setCart(cartItems);
      } catch (err) {
        alert('Gagal memuat draft requisition: ' + err.message, 'Error');
      }
    };

    loadDraftRequisition();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses, location.state]);

  // ── batal edit ───────────────────────────────────────────────────────────
  const cancelEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditRequisitionId(null);
    setDescription('');
    setDateRequired(new Date().toISOString().split('T')[0]);
    clearCart();
    navigate('/requisition', { replace: true, state: {} });
  }, [clearCart, navigate]);

  // ── warehouse change ──────────────────────────────────────────────────────
  const handleWarehouseChange = useCallback((e) => {
    const id   = Number(e.target.value);
    const found = warehouses.find(w => w.id === id) ?? null;
    setSelectedWarehouse(found);
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
  const handleSubmit = async (mode = 'complete') => {
    const result = await submit(
      cart, requesterName, selectedWarehouse?.id,
      editRequisitionId, description, dateRequired, mode
    );
    if (result) {
      setSuccessData({ ...result, warehouseName: selectedWarehouse?.name });
      clearCart();
      setCartOpen(false);
      setSuccessOpen(true);
      setIsEditMode(false);
      setEditRequisitionId(null);
      setDescription('');
      setDateRequired(new Date().toISOString().split('T')[0]);
      navigate('/requisition', { replace: true, state: {} });
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
      <div className='header-requisition'>
       
        <span style={{ 
          color: '#fff', 
          fontWeight: 700, 
          fontSize: '15px', 
          flex: 1,
          display: 'inline-flex', 
          alignItems: 'center',   
          gap: '6px'              
        }}>
          <RequisitionIcon />
          <span>Requisition</span>
        </span>
        {/* ── Date Required + Warehouse ─────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* Date Required */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '20px',
          padding: '3px 10px 3px 12px',
          height: '25px',
        }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'rgba(224,234,255,0.75)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            whiteSpace: 'nowrap',
          }}>
            Date Required:
          </span>
          <input
            type="date"
            value={dateRequired}
            onChange={(e) => setDateRequired(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 0',
              fontSize: '11px',
              fontWeight: 500,
              color: '#fff',
              outline: 'none',
              colorScheme: 'dark',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Warehouse */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '20px',
          padding: '3px 10px 3px 12px',
          height: '25px',
        }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'rgba(224,234,255,0.75)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            whiteSpace: 'nowrap',
          }}>
            Warehouse:
          </span>
          <select
            value={selectedWarehouse?.id ?? ''}
            onChange={handleWarehouseChange}
            disabled={warehouses.length <= 1}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 0',
              fontSize: '11px',
              fontWeight: 500,
              color: '#fff',
              cursor: warehouses.length <= 1 ? 'default' : 'pointer',
              outline: 'none',
              maxWidth: isDesktop ? '160px' : '110px',
              colorScheme: 'dark',
            }}
          >
            {warehouses.length === 0 && (
              <option value="" style={{ background: '#1e3a5f', color: '#e0eaff' }}>
                Memuat...
              </option>
            )}
            {warehouses.map((wh, idx) => (
              <option
                key={wh.id || `wh-null-${idx}`}
                value={wh.id ?? ''}
                style={{ background: '#1e3a5f', color: '#e0eaff' }}
              >
                🏭 {wh.name}
              </option>
            ))}
          </select>
        </div>

        </div>
      </div>

      {/* ── Banner Edit Mode ─────────────────────────────────────────────── */}
      {isEditMode && (
        <div style={{
          backgroundColor: '#fff3e0', borderBottom: '1px solid #f57c00',
          padding: '8px 16px', fontSize: '13px', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '8px',
        }}>
          <span>✏️ <strong>Mode Edit</strong> — Requisition Draft ID: {editRequisitionId}</span>
          <button
            onClick={cancelEditMode}
            style={{
              background: 'none', border: '1px solid #f57c00', color: '#f57c00',
              borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px',
            }}
          >
            Batalkan Edit
          </button>
        </div>
      )}

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
            <ScanIcon />
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
              selectedWarehouse={selectedWarehouse}
            />

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
            title={isEditMode ? '📝 Edit Permintaan' : '📝 Daftar Permintaan'}
            submitLabel={isEditMode ? '💾 SIMPAN PERUBAHAN' : '📤 KIRIM FPB'}
            onSubmitDraft={canSubmitRequisition ? () => handleSubmit('draft') : undefined}
            onSubmitComplete={canSubmitRequisition ? () => handleSubmit('complete') : undefined}
            isSubmitting={isSubmitting}
            description={description}
            onDescriptionChange={canSubmitRequisition ? setDescription : undefined}
          />
        )}
      </div>

      {/* Mobile: FAB + bottom sheet cart */}
      {!isDesktop && cart.length > 0 && !cartOpen && (
        <CartFab count={totalItems} label={isEditMode ? 'Edit Permintaan' : 'Daftar Permintaan'} onClick={() => setCartOpen(true)} />
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
          title={isEditMode ? '📝 Edit Permintaan' : '📝 Daftar Permintaan'}
          submitLabel={isEditMode ? '💾 SIMPAN PERUBAHAN' : '📤 KIRIM FPB'}
          onSubmitDraft={canSubmitRequisition ? () => handleSubmit('draft') : undefined}
          onSubmitComplete={canSubmitRequisition ? () => handleSubmit('complete') : undefined}
          isSubmitting={isSubmitting}
          description={description}
          onDescriptionChange={canSubmitRequisition ? setDescription : undefined}
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
const styles = {
  newBtn:  { backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  badge:   { color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
  editBtn: { color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", transition: "all 0.2s ease" },
  dateFilterRow: { display: "flex", gap: "16px", flexWrap: "wrap", margin: "12px 0 16px" },
  dateField:     { display: "flex", flexDirection: "column", gap: "4px" },
  dateLabel:     { fontSize: "12px", fontWeight: "600", color: "#555" },
  dateInput:      { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" },
};
export default RequisitionContainer;
