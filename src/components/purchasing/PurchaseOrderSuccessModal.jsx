import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COLOR, RADIUS } from '../../utils/styleTokens';

const fmtRp = (n) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseOrderSuccessModal.jsx
// Berbeda dari success modal modul lain: `data` di sini adalah ARRAY (hasil
// dari usePurchaseOrderSubmit.submit, yang bisa mengembalikan >1 PO kalau
// cart berisi lebih dari 1 vendor). Ditampilkan sebagai daftar card per PO.
// ─────────────────────────────────────────────────────────────────────────────
const PurchaseOrderSuccessModal = ({ isOpen, data, onClose }) => {
  const navigate = useNavigate();
  const handleClose = () => { onClose(); navigate('/dashboard'); };
  if (!isOpen || !data || data.length === 0) return null;

  const grandTotal = data.reduce((s, po) => s + po.total, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1500, padding: '16px',
    }}>
      <div style={{
        background: COLOR.surface, borderRadius: RADIUS.xl, padding: '28px 20px',
        maxWidth: '480px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        textAlign: 'center', maxHeight: '90vh', overflowY: 'auto', position: 'relative',
      }}>
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(0,0,0,0.06)', border: 'none', color: COLOR.textMd,
            borderRadius: '50%', width: '30px', height: '30px', fontSize: '16px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >✕</button>

        <div style={{ fontSize: '52px', marginBottom: '8px' }}>🧾✅</div>
        <div style={{ fontSize: '19px', fontWeight: 700, color: COLOR.success, marginBottom: '4px' }}>
          {data.length > 1 ? `${data.length} Purchase Order Berhasil Dibuat!` : 'Purchase Order Berhasil Dibuat!'}
        </div>
        <div style={{ fontSize: '13px', color: COLOR.textMd, marginBottom: '18px' }}>
          {data.length > 1
            ? 'Karena berasal dari vendor berbeda, sistem membuat dokumen terpisah untuk masing-masing vendor.'
            : 'Dokumen telah di-Complete dan menunggu persetujuan (approval) sesuai alur di iDempiere.'}
        </div>

        {data.map((po, i) => (
          <div key={i} style={{
            background: COLOR.successLt, border: '1px solid #bbf7d0',
            borderRadius: RADIUS.md, padding: '14px', marginBottom: '12px', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: COLOR.textDk }}>{po.documentNo}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLOR.textDk }}>{fmtRp(po.total)}</span>
            </div>
            <div style={{ fontSize: '11px', color: COLOR.textLt, marginBottom: '8px' }}>
              🚚 {po.vendorName} · {po.date}
            </div>
            {po.items.map((item, j) => (
              <div key={j} style={{
                display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0',
                borderTop: j > 0 ? '1px solid #d1fae5' : 'none',
              }}>
                <span style={{ color: '#333', flex: 1, marginRight: '8px' }}>{item.Name}</span>
                <span style={{ color: COLOR.textMd, whiteSpace: 'nowrap' }}>
                  {item.Qty} {item.UomName} × {fmtRp(item.Price)}
                </span>
              </div>
            ))}
          </div>
        ))}

        {data.length > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
            background: '#f0f4ff', borderRadius: RADIUS.md, marginBottom: '18px',
          }}>
            <span style={{ fontSize: '13px', color: COLOR.textMd }}>Total Keseluruhan</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: COLOR.textDk }}>{fmtRp(grandTotal)}</span>
          </div>
        )}

        <button onClick={onClose} style={{
          background: COLOR.primary, color: '#fff', border: 'none',
          borderRadius: RADIUS.md, padding: '14px', fontWeight: 700,
          fontSize: '15px', cursor: 'pointer', width: '100%',
        }}>
          Buat PO Baru
        </button>
      </div>
    </div>
  );
};

export default PurchaseOrderSuccessModal;
