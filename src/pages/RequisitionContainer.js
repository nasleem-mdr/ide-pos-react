import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// KONFIGURASI — hanya yang tidak tersimpan di localStorage saat login
// ─────────────────────────────────────────────────────────────────────────────
const REQUISITION_CONFIG = {
  C_DOCTYPE_ID: 320,                           // C_DocType_ID untuk Purchase Requisition
  DESCRIPTION:  'Purchase Requisition via Web',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Ambil semua field sesi dari localStorage
// ─────────────────────────────────────────────────────────────────────────────
const getLoginInfo = () => ({
  userId:      parseInt(localStorage.getItem('AD_User_ID'))    || null,
  warehouseId: parseInt(localStorage.getItem('M_Warehouse_ID'))|| null,
  orgId:       parseInt(localStorage.getItem('AD_Org_ID'))     || null,
  clientId:    parseInt(localStorage.getItem('AD_Client_ID'))  || null,
  roleId:      parseInt(localStorage.getItem('AD_Role_ID'))    || null,
  userName:    localStorage.getItem('UserName') || localStorage.getItem('Name') || 'User',
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — Styling tokens
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  primary:    '#2563eb',
  primaryDk:  '#1d4ed8',
  success:    '#16a34a',
  successLt:  '#f0fdf4',
  danger:     '#dc2626',
  dangerLt:   '#fff1f1',
  bg:         '#f4f6fb',
  surface:    '#ffffff',
  border:     '#dde3ef',
  textDk:     '#1a2744',
  textMd:     '#4b5563',
  textLt:     '#9ca3af',
  vendor:     '#4a7fbf',
  vendorBg:   '#edf3fc',
};

const RADIUS = { sm: '6px', md: '10px', lg: '14px', xl: '18px' };

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: UoM Selector pill untuk ReqCartItem
// Menampilkan dropdown UoM alternatif dari C_UOM_Conversion
// ─────────────────────────────────────────────────────────────────────────────
const UomSelector = ({ item, onUomChange }) => {
  if (!item.uomOptions || item.uomOptions.length <= 1) {
    return (
      <span style={{ fontSize: '11px', color: COLOR.textLt, marginLeft: '4px' }}>
        {item.selectedUom?.Name || item.C_UOM_Name || 'EA'}
      </span>
    );
  }
  return (
    <select
      value={item.selectedUom?.C_UOM_ID || item.C_UOM_ID}
      onChange={e => {
        const chosen = item.uomOptions.find(u => String(u.C_UOM_ID) === e.target.value);
        if (chosen) onUomChange(item.M_Product_ID, chosen);
      }}
      onClick={e => e.stopPropagation()}
      style={{
        fontSize: '11px',
        color: COLOR.primary,
        background: COLOR.vendorBg,
        border: '1px solid #c5d0e8',
        borderRadius: RADIUS.sm,
        padding: '1px 4px',
        cursor: 'pointer',
        marginLeft: '4px',
        maxWidth: '90px',
      }}
    >
      {item.uomOptions.map(u => (
        <option key={u.C_UOM_ID} value={String(u.C_UOM_ID)}>
          {u.Name}
        </option>
      ))}
    </select>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: ReqProductCard
// ─────────────────────────────────────────────────────────────────────────────
const ReqProductCard = ({ product, onAdd }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={() => onAdd(product)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        border: `1.5px solid ${pressed ? COLOR.primary : COLOR.border}`,
        borderRadius: RADIUS.md,
        padding: '12px 12px 10px',
        cursor: 'pointer',
        background: pressed ? '#f0f5ff' : COLOR.surface,
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.1s, border-color 0.15s, background 0.1s',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        minHeight: '80px',
      }}
    >
      <span style={{
        fontWeight: 700, fontSize: '13px', color: COLOR.textDk,
        lineHeight: '1.35', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {product.Name}
      </span>
      <span style={{ fontSize: '11px', color: COLOR.textLt, letterSpacing: '0.03em' }}>
        {product.Value}
      </span>
      {product.VendorName && (
        <span style={{
          fontSize: '10px', color: COLOR.vendor, background: COLOR.vendorBg,
          borderRadius: '4px', padding: '2px 6px', alignSelf: 'flex-start',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
        }}>
          🏭 {product.VendorName}
        </span>
      )}
      <span style={{
        fontSize: '11px', color: COLOR.textLt,
        background: '#f5f5f5', borderRadius: '4px',
        padding: '1px 5px', alignSelf: 'flex-start',
      }}>
        {product.C_UOM_Name || 'EA'}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: ReqCartItem (mobile-optimised)
// ─────────────────────────────────────────────────────────────────────────────
const ReqCartItem = ({ item, onRemove, onQtyChange, onUomChange }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 10px', background: '#f7f9ff',
    borderRadius: RADIUS.md, marginBottom: '8px',
    border: `1px solid ${COLOR.border}`,
  }}>
    {/* Info */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontWeight: 600, fontSize: '13px', color: COLOR.textDk,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.Name}
      </div>
      <div style={{ fontSize: '11px', color: COLOR.textMd, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
        <span>{item.Value}</span>
        <UomSelector item={item} onUomChange={onUomChange} />
      </div>
    </div>

    {/* Stepper */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
      <button
        onTouchEnd={e => { e.preventDefault(); onQtyChange(item.M_Product_ID, item.Qty - 1); }}
        onClick={() => onQtyChange(item.M_Product_ID, item.Qty - 1)}
        style={stepBtn}
      >−</button>
      <input
        type="number" min="0.01" step="1"
        value={item.Qty}
        onChange={e => onQtyChange(item.M_Product_ID, parseFloat(e.target.value) || 0)}
        style={{
          width: '52px', textAlign: 'center', padding: '5px 2px',
          border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm,
          fontSize: '14px', fontWeight: 700, color: COLOR.textDk,
          MozAppearance: 'textfield',
        }}
      />
      <button
        onTouchEnd={e => { e.preventDefault(); onQtyChange(item.M_Product_ID, item.Qty + 1); }}
        onClick={() => onQtyChange(item.M_Product_ID, item.Qty + 1)}
        style={stepBtn}
      >+</button>
    </div>

    {/* Remove */}
    <button
      onTouchEnd={e => { e.preventDefault(); onRemove(item.M_Product_ID); }}
      onClick={() => onRemove(item.M_Product_ID)}
      style={{
        background: COLOR.dangerLt, border: 'none', cursor: 'pointer',
        color: COLOR.danger, fontSize: '14px', padding: '6px 8px',
        borderRadius: RADIUS.sm, flexShrink: 0, lineHeight: 1,
      }}
    >✕</button>
  </div>
);

const stepBtn = {
  width: '32px', height: '32px', border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.sm, background: COLOR.surface, cursor: 'pointer',
  fontSize: '18px', fontWeight: 700, color: COLOR.primary,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  WebkitTapHighlightColor: 'transparent', flexShrink: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: QR/Barcode Scanner Modal
// Menggunakan BarcodeDetector API (native browser)
// ─────────────────────────────────────────────────────────────────────────────
const BarcodeScanner = ({ isOpen, onDetected, onClose }) => {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const detectorRef = useRef(null);
  const [status, setStatus]         = useState('init');  // init | scanning | error
  const [errorMsg, setErrorMsg]     = useState('');
  const [lastCode, setLastCode]     = useState('');
  const [supported, setSupported]   = useState(true);

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) { stopStream(); setStatus('init'); setLastCode(''); return; }

    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      setStatus('error');
      setErrorMsg('Browser ini tidak mendukung BarcodeDetector API.\nGunakan Chrome 83+ atau Edge 83+ di Android.');
      return;
    }

    setSupported(true);
    setStatus('init');

    // Format yang umum digunakan di gudang/warehouse
    detectorRef.current = new window.BarcodeDetector({
      formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix'],
    });

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('scanning');
          scanLoop();
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(`Kamera tidak bisa diakses:\n${err.message}\n\nPastikan izin kamera sudah diberikan.`);
      }
    };

    const scanLoop = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }
      detectorRef.current.detect(videoRef.current)
        .then(results => {
          if (results.length > 0) {
            const code = results[0].rawValue;
            if (code && code !== lastCode) {
              setLastCode(code);
              // Vibrate feedback (mobile)
              if (navigator.vibrate) navigator.vibrate([60]);
              onDetected(code);
            }
          }
          rafRef.current = requestAnimationFrame(scanLoop);
        })
        .catch(() => {
          rafRef.current = requestAnimationFrame(scanLoop);
        });
    };

    startCamera();
    return () => stopStream();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        background: 'rgba(0,0,0,0.5)',
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>
          📷 Scan QR / Barcode
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', borderRadius: '50%', width: '34px', height: '34px',
            fontSize: '18px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* Viewfinder */}
      {status !== 'error' && (
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', display: 'block', borderRadius: RADIUS.md }}
          />
          {/* Overlay frame */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: '200px', height: '200px',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: RADIUS.md,
              boxShadow: '0 0 0 2000px rgba(0,0,0,0.45)',
              position: 'relative',
            }}>
              {/* Corner markers */}
              {[
                { top: '-2px', left: '-2px', borderTop: '4px solid #22c55e', borderLeft: '4px solid #22c55e' },
                { top: '-2px', right: '-2px', borderTop: '4px solid #22c55e', borderRight: '4px solid #22c55e' },
                { bottom: '-2px', left: '-2px', borderBottom: '4px solid #22c55e', borderLeft: '4px solid #22c55e' },
                { bottom: '-2px', right: '-2px', borderBottom: '4px solid #22c55e', borderRight: '4px solid #22c55e' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: '20px', height: '20px', borderRadius: '2px', ...s }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status / Error */}
      <div style={{
        marginTop: '20px', padding: '12px 24px',
        background: status === 'error' ? 'rgba(220,38,38,0.85)' : 'rgba(255,255,255,0.1)',
        borderRadius: RADIUS.lg, maxWidth: '400px', textAlign: 'center',
      }}>
        {status === 'init'     && <p style={{ color: '#ddd', margin: 0, fontSize: '14px' }}>Menginisialisasi kamera...</p>}
        {status === 'scanning' && <p style={{ color: '#a3e635', margin: 0, fontSize: '13px' }}>🔍 Arahkan kamera ke barcode produk</p>}
        {status === 'error'    && (
          <>
            <p style={{ color: '#fff', margin: '0 0 8px', fontWeight: 700, fontSize: '14px' }}>⚠ Error</p>
            <p style={{ color: '#fca5a5', margin: 0, fontSize: '13px', whiteSpace: 'pre-line' }}>{errorMsg}</p>
            {!supported && (
              <p style={{ color: '#fde68a', margin: '10px 0 0', fontSize: '12px' }}>
                Anda bisa ketik kode produk manual di kolom pencarian.
              </p>
            )}
            <button
              onClick={onClose}
              style={{
                marginTop: '16px', background: COLOR.surface, color: COLOR.danger,
                border: 'none', borderRadius: RADIUS.sm, padding: '8px 20px',
                fontWeight: 700, cursor: 'pointer',
              }}
            >Tutup</button>
          </>
        )}
      </div>

      {/* Last detected */}
      {lastCode && (
        <div style={{
          marginTop: '10px', padding: '8px 20px',
          background: 'rgba(34,197,94,0.2)', borderRadius: RADIUS.md,
          border: '1px solid #22c55e',
        }}>
          <p style={{ color: '#86efac', margin: 0, fontSize: '12px', textAlign: 'center' }}>
            ✓ Terdeteksi: <strong style={{ color: '#fff' }}>{lastCode}</strong>
          </p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Dialog Alert
// ─────────────────────────────────────────────────────────────────────────────
const ReqDialog = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500,
      padding: '16px',
    }}>
      <div style={{
        background: COLOR.surface, borderRadius: RADIUS.lg, padding: '24px 20px',
        maxWidth: '380px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '10px', color: COLOR.textDk }}>
          {title}
        </div>
        <div style={{ fontSize: '14px', color: '#444', marginBottom: '20px', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
          {message}
        </div>
        <button onClick={onClose} style={{
          background: COLOR.primary, color: '#fff', border: 'none',
          borderRadius: RADIUS.sm, padding: '10px 24px', fontWeight: 700,
          fontSize: '14px', cursor: 'pointer', width: '100%',
        }}>Tutup</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT: Success Modal
// ─────────────────────────────────────────────────────────────────────────────
const ReqSuccessModal = ({ isOpen, data, onClose }) => {
  if (!isOpen || !data) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1500, padding: '16px',
    }}>
      <div style={{
        background: COLOR.surface, borderRadius: RADIUS.xl, padding: '28px 20px',
        maxWidth: '440px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        textAlign: 'center', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: '52px', marginBottom: '8px' }}>✅</div>
        <div style={{ fontSize: '19px', fontWeight: 700, color: COLOR.success, marginBottom: '4px' }}>
          Requisition Berhasil!
        </div>
        <div style={{ fontSize: '13px', color: COLOR.textMd, marginBottom: '18px' }}>
          Dokumen telah di-<em>Complete</em> dan diteruskan ke workflow pembelian.
        </div>

        <div style={{
          background: COLOR.successLt, border: `1px solid #bbf7d0`,
          borderRadius: RADIUS.md, padding: '14px', marginBottom: '16px', textAlign: 'left',
        }}>
          {[
            ['Document No', data.documentNo, true],
            ['Tanggal',     data.date,        false],
            ['Requester',   data.requesterName,false],
            ['Total Item',  `${data.items.length} produk`, false],
          ].map(([label, val, bold]) => (
            <div key={label} style={{ marginBottom: '6px' }}>
              <span style={{ color: COLOR.textLt, fontSize: '11px' }}>{label}</span>
              <div style={{ fontSize: bold ? '16px' : '14px', fontWeight: bold ? 700 : 500, color: COLOR.textDk }}>
                {val}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
          <div style={{ fontWeight: 600, fontSize: '12px', color: COLOR.textMd, marginBottom: '6px' }}>
            Detail Permintaan:
          </div>
          {data.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '13px', padding: '5px 0',
              borderBottom: i < data.items.length - 1 ? `1px solid #eee` : 'none',
            }}>
              <span style={{ color: '#333', flex: 1, marginRight: '8px' }}>{item.Name}</span>
              <span style={{ fontWeight: 700, color: COLOR.textDk, whiteSpace: 'nowrap' }}>
                {item.Qty} {item.selectedUom?.Name || item.C_UOM_Name || 'EA'}
              </span>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          background: COLOR.primary, color: '#fff', border: 'none',
          borderRadius: RADIUS.md, padding: '14px', fontWeight: 7 { id, name }
  const [requesterName, setRequesterName] = useState('');

  const [dialog, setDialog]           = useState({ isOpen: false, title: '', message: '' });
  const [successData, setSuccessData] = useState(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const debounceRef = useRef(null);
  const searchRef   = useRef(null);

  const API_BASE = '/api/v1';

  // ─── Ambil konfigurasi dari localStorage (Dinamis) ───────────────────────
  const getLoginInfo = () => {
    const userId      = parseInt(localStorage.getItem('AD_User_ID')) || null;
    const warehouseId = parseInt(localStorage.getItem('M_Warehouse_ID')) || null;
    const orgId       = parseInt(localStorage.getItem('AD_Org_ID')) || 0; // Mengambil Org_ID dari Storage secara dinamis
    const clientType  = parseInt(localStorage.getItem('AD_Client_ID')) || 1000000;
    const userName    = localStorage.getItem('UserName') || localStorage.getItem('Name') || `User #${userId}`;
    return { userId, warehouseId, orgId, clientType, userName };
  };

  // ─── API Helper ──────────────────────────────────────────────────────────
  const customFetch = async (url, options = {}) => {
    const token    = localStorage.getItem('token');
    const fullUrl  = `${API_BASE}${url}`;
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const rawText  = await response.text().catch(() => '');
      let errorData  = {};
      try { errorData = JSON.parse(rawText); } catch (_) {}
      const errMsg =
        errorData.message || errorData.Message || errorData.error ||
        errorData.detail  || rawText           || `HTTP ${response.status}`;
      throw new Error(`[${response.status}] ${errMsg}`);
    }
    return response.json();
  };

  // ─── Alert helper ─────────────────────────────────────────────────────────
  const triggerAlert = (message, title = 'Perhatian') =>
    setDialog({ isOpen: true, title, message });
  const closeDialog = () => setDialog({ isOpen: false, title: '', message: '' });

  // ─── Init: load warehouse name + requester name ───────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { userId, warehouseId } = getLoginInfo();

        if (!userId) {
          triggerAlert('Sesi user tidak ditemukan. Silakan login kembali.', 'Error');
          setLoading(false);
          return;
        }
        if (!warehouseId) {
          triggerAlert(
            'M_Warehouse_ID tidak ditemukan di sesi login.\n\nPastikan sistem menyimpan Warehouse ID ke localStorage setelah login.',
            'Konfigurasi Belum Lengkap'
          );
          setLoading(false);
          return;
        }

        // Ambil nama warehouse untuk ditampilkan di header
        try {
          const whRes = await customFetch(
            `/models/m_warehouse/${warehouseId}?$select=M_Warehouse_ID,Name`
          );
          setWarehouseInfo({ id: warehouseId, name: whRes.Name || `Warehouse #${warehouseId}` });
        } catch {
          setWarehouseInfo({ id: warehouseId, name: `Warehouse #${warehouseId}` });
        }

        // Ambil nama user sebagai Requester
        try {
          const userRes = await customFetch(
            `/models/ad_user/${userId}?$select=AD_User_ID,Name`
          );
          setRequesterName(userRes.Name || getLoginInfo().userName);
        } catch {
          setRequesterName(getLoginInfo().userName);
        }

        // Load produk pertama kali
        await fetchProducts('');

      } catch (err) {
        console.error('Init RequisitionContainer error:', err.message);
        triggerAlert('Gagal inisialisasi halaman: ' + err.message, 'Error');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ─── Fetch Products dari M_ProductPO ─────────────────────────────────────
  const fetchProducts = async (query = '') => {
    try {
      setLoading(true);
      let productPoFilter = 'IsActive eq true and IsCurrentVendor eq true';
      const safeQ = query.toUpperCase().replace(/'/g, "''");

      let productFilter = 'IsPurchased eq true and IsActive eq true';
      if (query) {
        productFilter += ` and (contains(toupper(Name),'${safeQ}') or contains(toupper(Value),'${safeQ}'))`;
      }

      const [productData, productPoData] = await Promise.all([
        customFetch(
          `/models/m_product?$select=M_Product_ID,Name,Value,C_UOM_ID` +
          `&$filter=${productFilter}&$orderby=Name&$top=100`
        ),
        customFetch(
          `/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,PriceList,IsCurrentVendor` +
          `&$filter=${productPoFilter}&$top=500`
        ),
      ]);

      const productRecords = Array.isArray(productData.records) ? productData.records : [];
      const poRecords      = Array.isArray(productPoData.records) ? productPoData.records : [];

      const vendorMap = new Map();
      poRecords.forEach(po => {
        const pid = po.M_Product_ID?.id ?? po.M_Product_ID;
        if (pid && !vendorMap.has(pid)) {
          vendorMap.set(pid, {
            vendorId:   po.C_BPartner_ID?.id ?? po.C_BPartner_ID,
            vendorName: po.C_BPartner_ID?.identifier || po.C_BPartner_ID?.Name || null,
          });
        }
      });

      const finalProducts = productRecords
        .filter(p => {
          const pid = p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id;
          return vendorMap.has(pid);
        })
        .map(p => {
          const pid    = p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id;
          const vendor = vendorMap.get(pid);
          return {
            M_Product_ID: pid,
            Name:         p.Name,
            Value:        p.Value,
            C_UOM_ID:      p.C_UOM_ID?.id ?? p.C_UOM_ID,
            C_UOM_Name:   p.C_UOM_ID?.identifier || p.C_UOM_ID?.Name || 'EA',
            VendorId:     vendor?.vendorId,
            VendorName:   vendor?.vendorName,
          };
        });

      setProducts(finalProducts);
    } catch (err) {
      console.error('fetchProducts (Requisition) error:', err.message);
      triggerAlert('Gagal memuat produk: ' + err.message, 'Error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Search handlers ──────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchValue(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(val), 400);
  };

  const handleSearchEnter = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    clearTimeout(debounceRef.current);
    await fetchProducts(searchValue.trim());
  };

  // ─── Cart handlers (Termasuk C_UOM_Conversion) ────────────────────────────
  const addToCart = async (product) => {
    const idx = cart.findIndex(i => i.M_Product_ID === product.M_Product_ID);
    if (idx >= 0) {
      setCart(prev => prev.map((item, i) => i === idx ? { ...item, Qty: item.Qty + 1 } : item));
      return;
    }

    let availableUoms = [{ C_UOM_ID: product.C_UOM_ID, C_UOM_Name: product.C_UOM_Name, MultiplyRate: 1 }];

    try {
      // Ambil data konversi UoM untuk produk terkait
      const conversionData = await customFetch(
        `/models/c_uom_conversion?$filter=M_Product_ID eq ${product.M_Product_ID} and IsActive eq true`
      );
      
      if (conversionData && Array.isArray(conversionData.records)) {
        conversionData.records.forEach(record => {
          const targetUomId = record.C_UOM_To_ID?.id ?? record.C_UOM_To_ID;
          if (targetUomId && targetUomId !== product.C_UOM_ID) {
            availableUoms.push({
              C_UOM_ID: targetUomId,
              C_UOM_Name: record.C_UOM_To_ID?.identifier || `UOM #${targetUomId}`,
              MultiplyRate: parseFloat(record.MultiplyRate) || 1
            });
          }
        });
      }
    } catch (err) {
      console.warn('Gagal memuat konversi UoM produk:', err.message);
    }

    setCart(prev => [...prev, {
      ...product,
      Qty: 1,
      Base_C_UOM_ID: product.C_UOM_ID,
      Base_C_UOM_Name: product.C_UOM_Name,
      Selected_C_UOM_ID: product.C_UOM_ID,
      Selected_C_UOM_Name: product.C_UOM_Name,
      CurrentMultiplyRate: 1,
      AvailableUoms: availableUoms
    }]);
  };

  const removeFromCart = (productId) =>
    setCart(prev => prev.filter(i => i.M_Product_ID !== productId));

  const updateCartQty = (productId, newQty) => {
    if (newQty <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(i => i.M_Product_ID === productId ? { ...i, Qty: newQty } : i));
  };

  // Handler pergantian UOM dalam cart
  const updateCartUom = (productId, newUomId) => {
    setCart(prev => prev.map(item => {
      if (item.M_Product_ID !== productId) return item;
      
      const targetUom = item.AvailableUoms.find(u => u.C_UOM_ID === newUomId);
      if (!targetUom) return item;

      // Formula konversi Qty baru berdasarkan perubahan MultiplyRate
      const oldRate = item.CurrentMultiplyRate || 1;
      const newRate = targetUom.MultiplyRate || 1;
      const convertedQty = Math.round(((item.Qty * oldRate) / newRate) * 100) / 100;

      return {
        ...item,
        Selected_C_UOM_ID: targetUom.C_UOM_ID,
        Selected_C_UOM_Name: targetUom.C_UOM_Name,
        CurrentMultiplyRate: newRate,
        Qty: convertedQty > 0 ? convertedQty : 1
      };
    }));
  };

  const totalQty = cart.reduce((s, i) => s + i.Qty, 0);

  // ─── Submit Requisition ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (cart.length === 0) {
      triggerAlert('Daftar permintaan masih kosong!', 'Perhatian');
      return;
    }

    const { userId, warehouseId, orgId, clientType } = getLoginInfo();
    if (!userId || !warehouseId) {
      triggerAlert('Data sesi tidak lengkap. Pastikan M_Warehouse_ID tersimpan di sesi login.', 'Error');
      return;
    }

    setIsSubmitting(true);
    try {
      const todayISO = new Date().toISOString().split('T')[0];

      // ── Step 1: Buat header M_Requisition ────────────────────────────────
      const headerPayload = {
        AD_Client_ID:   { id: clientType },
        AD_Org_ID:      { id: orgId },
        C_DocType_ID:   { id: REQUISITION_CONFIG.C_DOCTYPE_ID },
        M_Warehouse_ID: { id: warehouseId },
        AD_User_ID:     { id: userId },
        DateRequired:   todayISO,
        Description:    REQUISITION_CONFIG.DESCRIPTION,
        IsActive:       true,
      };

      console.log('📦 Membuat M_Requisition header:', JSON.stringify(headerPayload));
      const headerRes = await customFetch('/models/m_requisition', {
        method: 'POST',
        body: JSON.stringify(headerPayload),
      });

      const reqId = headerRes.id ?? headerRes.M_Requisition_ID;
      if (!reqId) throw new Error('Gagal mendapatkan M_Requisition_ID dari server.');
      console.log(`✅ M_Requisition dibuat, ID: ${reqId}`);

      // ── Step 2: Insert M_RequisitionLine satu per satu ───────────────────
      for (const item of cart) {
        const linePayload = {
          AD_Org_ID:        { id: orgId },
          M_Requisition_ID: { id: reqId },
          M_Product_ID:     { id: parseInt(item.M_Product_ID) },
          C_UOM_ID:         { id: parseInt(item.Selected_C_UOM_ID) }, // Menggunakan UOM Terpilih
          Qty:              parseFloat(item.Qty),
          ...(item.VendorId
            ? { C_BPartner_ID: { id: parseInt(item.VendorId) } }
            : {}),
        };

        console.log(`  ↳ Line produk [${item.Name}]:`, JSON.stringify(linePayload));
        await customFetch('/models/m_requisitionline', {
          method: 'POST',
          body: JSON.stringify(linePayload),
        });
      }

      console.log('✅ Semua line berhasil dibuat. Menjalankan doc-action CO...');

      // ── Step 3: Complete dokumen (doc-action CO) ──────────────────────────
      const completedRes = await customFetch(`/models/m_requisition/${reqId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });

      const finalDocNo = completedRes.DocumentNo || `REQ-${reqId}`;
      console.log(`✅ Requisition Complete! DocumentNo: ${finalDocNo}`);

      // ── Tampilkan success modal ───────────────────────────────────────────
      setSuccessData({
        documentNo:    finalDocNo,
        date:          new Date().toLocaleString('id-ID'),
        requesterName: requesterName,
        items:         [...cart],
      });
      setCart([]);
      setIsSuccessOpen(true);

    } catch (err) {
      console.error('Submit Requisition Gagal:', err.message);
      triggerAlert('Gagal membuat Requisition:\n\n' + err.message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const { warehouseId, orgId } = getLoginInfo();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0',
      padding: '20px', fontFamily: 'Arial, sans-serif',
      height: '100vh', boxSizing: 'border-box', overflow: 'hidden',
      background: '#f5f7fb',
    }}>

      {/* ─── Dialog ─────────────────────────────────────────────────────── */}
      <ReqDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        onClose={closeDialog}
      />

      {/* ─── Success Modal ───────────────────────────────────────────────── */}
      <ReqSuccessModal
        isOpen={isSuccessOpen}
        data={successData}
        onClose={() => {
          setIsSuccessOpen(false);
          setSuccessData(null);
          fetchProducts('');
          setSearchValue('');
          setTimeout(() => searchRef.current?.focus(), 100);
        }}
      />

      {/* ─── Config / Info Bar ──────────────────────────────────────────── */}
      <div style={{
        background: '#eef2fc',
        padding: '10px 16px',
        borderRadius: '10px',
        border: '1px solid #c5d0e8',
        fontSize: '13px',
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => navigate('/pos')}
          style={{
            background: '#fff',
            border: '1px solid #c5d0e8',
            borderRadius: '7px',
            padding: '5px 14px',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#2563eb',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          ← POS
        </button>

        <span style={{ fontWeight: 700, fontSize: '15px', color: '#1a2744' }}>
          📋 Purchase Requisition
        </span>

        <span style={{ color: '#555' }}>
          <strong>Requester:</strong>{' '}
          <span style={{ color: '#2563eb' }}>{requesterName || '...'}</span>
        </span>

        <span style={{ color: '#555' }}>
          <strong>Warehouse:</strong>{' '}
          <span style={{ color: warehouseInfo ? '#1a6e3c' : '#c62828' }}>
            {warehouseInfo ? warehouseInfo.name : (warehouseId ? `ID #${warehouseId}` : '⚠ Tidak ditemukan')}
          </span>
        </span>

        <span style={{ color: '#555' }}>
          <strong>Org ID:</strong> {orgId || '0 (Dinamis)'}
        </span>

        <span style={{ color: '#555' }}>
          <strong>DocType ID:</strong> {REQUISITION_CONFIG.C_DOCTYPE_ID}
        </span>
      </div>

      {/* ─── Main Layout ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0', flex: 1, overflow: 'hidden' }}>

        {/* ── Kiri: Katalog Produk ──────────────────────────────────────── */}
        <div style={{
          flex: 2, display: 'flex', flexDirection: 'column',
          paddingRight: '20px', overflow: 'hidden',
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1a2744' }}>
            Katalog Produk Pembelian
          </h3>

          <SearchBar
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleSearchEnter}
            inputRef={searchRef}
            placeholder="Cari nama atau kode produk..."
          />

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {loading ? (
              <p style={{ color: '#888', padding: '16px 0' }}>Memuat produk...</p>
            ) : products.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '32px 0' }}>
                Tidak ada produk ditemukan dengan vendor aktif.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '10px',
              }}>
                {products.map((p, idx) => (
                  <ReqProductCard
                    key={`${p.M_Product_ID}-${idx}`}
                    product={p}
                    onClick={addToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Kanan: Daftar Permintaan (Cart) ──────────────────────────── */}
        <div style={{
          flex: 1,
          borderLeft: '1px solid #dde3ef',
          paddingLeft: '20px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: '280px',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1a2744', flexShrink: 0 }}>
            📝 Daftar Permintaan
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: 0 }}>
            {cart.length === 0 ? (
              <p style={{ color: '#bbb', fontSize: '13px' }}>
                Belum ada produk dipilih.
              </p>
            ) : (
              cart.map((item, idx) => (
                <ReqCartItem
                  key={`${item.M_Product_ID}-${idx}`}
                  item={item}
                  onRemove={removeFromCart}
                  onQtyChange={updateCartQty}
                  onUomChange={updateCartUom}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div style={{
              borderTop: '1px solid #dde3ef',
              paddingTop: '12px',
              marginTop: '8px',
              flexShrink: 0,
            }}>
              <div style={{
                background: '#f0f4ff',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#555' }}>Total Jenis Produk:</span>
                  <strong style={{ color: '#1a2744' }}>{cart.length} item</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#555' }}>Total Qty:</span>
                  <strong style={{ color: '#1a2744' }}>{totalQty.toLocaleString('id-ID')} unit</strong>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  background: isSubmitting ? '#aaa' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '14px',
                  width: '100%',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  letterSpacing: '0.02em',
                }}
              >
                {isSubmitting ? 'Memproses...' : '📤 KIRIM REQUISITION'}
              </button>

              <button
                onClick={() => setCart([])}
                disabled={isSubmitting}
                style={{
                  marginTop: '8px',
                  background: 'none',
                  border: '1px solid #e0e5f0',
                  borderRadius: '7px',
                  padding: '7px',
                  width: '100%',
                  color: '#888',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Kosongkan Daftar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequisitionContainer;
