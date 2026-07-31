import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COLOR, RADIUS } from '@/utils/styleTokens';
import { formatCurrency } from '@/utils/currency';

// const fmtRp = (n) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

// ─────────────────────────────────────────────────────────────────────────────
// VendorInvoiceSuccessModal.jsx
// Berbeda dari PurchaseOrderSuccessModal: `data` di sini SELALU 1 objek
// (bukan array) — submit AP Invoice selalu menghasilkan 1 dokumen per PO
// yang ditagih, tidak ada skenario split-per-vendor seperti Purchasing.
//
// Bentuk `data` yang diharapkan (sesuaikan kalau hasil hook submit beda):
// {
//   documentNo: string,       // DocumentNo invoice yang baru dibuat
//   vendorName: string,
//   date: string,
//   total: number,            // GrandTotal invoice
//   sourceOrderDocumentNo: string,  // DocumentNo PO asal (referensi)
//   items: [{ ProductName, UomName, qtyInvoiced, PriceEntered }]
// }
// ─────────────────────────────────────────────────────────────────────────────
const VendorInvoiceSuccessModal = ({ isOpen, data, onClose }) => {
  const navigate = useNavigate();
  const handleClose = () => { onClose(); navigate('/dashboard'); };
  if (!isOpen || !data) return null;

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

        <div style={{ fontSize: '52px', marginBottom: '8px' }}>📄✅</div>
        <div style={{ fontSize: '19px', fontWeight: 700, color: COLOR.success, marginBottom: '4px' }}>
          Invoice Vendor Berhasil Dibuat!
        </div>
        <div style={{ fontSize: '13px', color: COLOR.textMd, marginBottom: '18px' }}>
          Dokumen telah di-Complete dan menunggu proses pembayaran sesuai alur di iDempiere.
        </div>

        <div style={{
          background: COLOR.successLt, border: '1px solid #bbf7d0',
          borderRadius: RADIUS.md, padding: '14px', marginBottom: '14px', textAlign: 'left',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: COLOR.textDk }}>{data.documentNo}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLOR.textDk }}>{formatCurrency(data.total)}</span>
          </div>
          <div style={{ fontSize: '11px', color: COLOR.textLt, marginBottom: '8px' }}>
            🚚 {data.vendorName} · {data.date}
          </div>

          {data.sourceOrderDocumentNo && (
            <div style={{
              fontSize: '11px', color: COLOR.textMd, background: '#eef2ff',
              borderRadius: RADIUS.sm, padding: '6px 8px', marginBottom: '8px',
            }}>
              📎 Ditagih dari PO: <strong>{data.sourceOrderDocumentNo}</strong>
            </div>
          )}

          {(data.items || []).map((item, j) => (
            <div key={j} style={{
              display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0',
              borderTop: j > 0 ? '1px solid #d1fae5' : 'none',
            }}>
              <span style={{ color: '#333', flex: 1, marginRight: '8px' }}>{item.ProductName}</span>
              <span style={{ color: COLOR.textMd, whiteSpace: 'nowrap' }}>
                {item.qtyInvoiced} {item.UomName} × {formatCurrency(item.PriceEntered)}
              </span>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          background: COLOR.primary, color: '#fff', border: 'none',
          borderRadius: RADIUS.md, padding: '14px', fontWeight: 700,
          fontSize: '15px', cursor: 'pointer', width: '100%',
        }}>
          Buat Invoice Baru
        </button>
      </div>
    </div>
  );
};

export default VendorInvoiceSuccessModal;