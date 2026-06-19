import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';

// ─────────────────────────────────────────────────────────────────────────────
// KONFIGURASI HARDCODE — Hanya C_DocType_ID yang di-hardcode
// ─────────────────────────────────────────────────────────────────────────────
const REQUISITION_CONFIG = {
  C_DOCTYPE_ID: 320,        // Ganti dengan C_DocType_ID untuk "Purchase Requisition"
  DESCRIPTION:  'Purchase Requisition via Web',
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── ReqProductCard ──────────────────────────────────────────────────────────
const ReqProductCard = ({ product, onClick }) => (
  <div
    onClick={() => onClick(product)}
    style={{
      border: '1px solid #dde3ef',
      borderRadius: '10px',
      padding: '12px 14px',
      cursor: 'pointer',
      background: '#fff',
      transition: 'box-shadow 0.15s, border-color 0.15s',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      userSelect: 'none',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = '0 2px 12px rgba(30,90,200,0.13)';
      e.currentTarget.style.borderColor = '#7aa4e8';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = '#dde3ef';
    }}
  >
    <span style={{ fontWeight: 700, fontSize: '13px', color: '#1a2744', lineHeight: '1.3' }}>
      {product.Name}
    </span>
    <span style={{ fontSize: '11px', color: '#888', letterSpacing: '0.03em' }}>
      {product.Value}
    </span>
    {product.VendorName && (
      <span style={{
        fontSize: '11px',
        color: '#4a7fbf',
        background: '#edf3fc',
        borderRadius: '4px',
        padding: '2px 6px',
        marginTop: '4px',
        alignSelf: 'flex-start',
      }}>
        🏭 {product.VendorName}
      </span>
    )}
    {product.C_UOM_Name && (
      <span style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
        Base UOM: {product.C_UOM_Name}
      </span>
    )}
  </div>
);

// ─── ReqCartItem ─────────────────────────────────────────────────────────────
const ReqCartItem = ({ item, onRemove, onQtyChange, onUomChange }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: '#f7f9ff',
    borderRadius: '8px',
    marginBottom: '8px',
    border: '1px solid #e4eaf5',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a2744', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.Name}
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{item.Value}</div>
      
      {/* Selector UoM Konversi */}
      {item.AvailableUoms && item.AvailableUoms.length > 1 ? (
        <select
          value={item.Selected_C_UOM_ID}
          onChange={(e) => onUomChange(item.M_Product_ID, parseInt(e.target.value))}
          style={{ padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #c8d4ec', color: '#4a7fbf', background: '#fff' }}
        >
          {item.AvailableUoms.map((uom) => (
            <option key={uom.C_UOM_ID} value={uom.C_UOM_ID}>
              {uom.C_UOM_Name} {uom.MultiplyRate !== 1 ? `(x${uom.MultiplyRate})` : ''}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: '11px', color: '#888' }}>{item.Selected_C_UOM_Name || 'EA'}</div>
      )}
    </div>

    {/* Qty stepper */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
      <button
        onClick={() => onQtyChange(item.M_Product_ID, item.Qty - 1)}
        style={btnStepper}
      >−</button>
      <input
        type="number"
        min="0.01"
        step="1"
        value={item.Qty}
        onChange={e => onQtyChange(item.M_Product_ID, parseFloat(e.target.value) || 0)}
        style={{
          width: '56px', textAlign: 'center', padding: '4px 2px',
          border: '1px solid #c8d4ec', borderRadius: '5px', fontSize: '13px',
          fontWeight: 600, color: '#1a2744',
        }}
      />
      <button
        onClick={() => onQtyChange(item.M_Product_ID, item.Qty + 1)}
        style={btnStepper}
      >+</button>
    </div>

    <button
      onClick={() => onRemove(item.M_Product_ID)}
      title="Hapus"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: '16px', padding: '2px 4px', flexShrink: 0 }}
    >✕</button>
  </div>
);

const btnStepper = {
  width: '26px', height: '26px', border: '1px solid #c8d4ec',
  borderRadius: '5px', background: '#fff', cursor: 'pointer',
  fontSize: '15px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontWeight: 700, color: '#4a7fbf', padding: 0,
};

// ─── Dialog / Alert sederhana ─────────────────────────────────────────────────
const ReqDialog = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '28px 32px',
        maxWidth: '420px', width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px', color: '#1a2744' }}>
          {title}
        </div>
        <div style={{ fontSize: '14px', color: '#444', marginBottom: '24px', whiteSpace: 'pre-line', lineHeight: '1.6' }}>
          {message}
        </div>
        <button
          onClick={onClose}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '7px', padding: '9px 24px', fontWeight: 600,
            fontSize: '14px', cursor: 'pointer', float: 'right',
          }}
        >Tutup</button>
      </div>
    </div>
  );
};

// ─── SuccessModal ─────────────────────────────────────────────────────────────
const ReqSuccessModal = ({ isOpen, data, onClose }) => {
  if (!isOpen || !data) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: '14px', padding: '32px 36px',
        maxWidth: '480px', width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a6e3c', marginBottom: '6px' }}>
          Requisition Berhasil Dibuat!
        </div>
        <div style={{ fontSize: '14px', color: '#555', marginBottom: '20px' }}>
          Dokumen telah di-<em>Complete</em> dan diteruskan ke workflow pembelian.
        </div>

        <div style={{
          background: '#f0f9f4', border: '1px solid #b2dfcc',
          borderRadius: '8px', padding: '16px', marginBottom: '24px', textAlign: 'left',
        }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>Document No</span>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#1a2744' }}>{data.documentNo}</div>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>Tanggal</span>
            <div style={{ fontSize: '14px', color: '#333' }}>{data.date}</div>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>Requester</span>
            <div style={{ fontSize: '14px', color: '#333' }}>{data.requesterName}</div>
          </div>
          <div>
            <span style={{ color: '#888', fontSize: '12px' }}>Total Item</span>
            <div style={{ fontSize: '14px', color: '#333' }}>{data.items.length} produk</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#555', marginBottom: '8px' }}>Detail Permintaan:</div>
          {data.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '13px', padding: '5px 0',
              borderBottom: i < data.items.length - 1 ? '1px solid #eee' : 'none',
            }}>
              <span style={{ color: '#333' }}>{item.Name}</span>
              <span style={{ fontWeight: 600, color: '#1a2744' }}>
                {item.Qty} {item.Selected_C_UOM_Name || 'EA'}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '12px 32px', fontWeight: 700,
            fontSize: '15px', cursor: 'pointer', width: '100%',
          }}
        >
          Buat Requisition Baru
        </button>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const RequisitionContainer = () => {
  const navigate = useNavigate();

  // ─── State ───────────────────────────────────────────────────────────────
  const [products, setProducts]       = useState([]);
  const [cart, setCart]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [warehouseInfo, setWarehouseInfo] = useState(null); // { id, name }
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
