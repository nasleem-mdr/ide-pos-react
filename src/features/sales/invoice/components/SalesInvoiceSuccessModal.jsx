import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COLOR, RADIUS } from '@/utils/styleTokens';
import { formatCurrency } from '@/utils/currency';
import { ShoppingCartIcon } from '@/shared/components'; // ⬅️ ganti icon kalau ada icon invoice/receipt tersendiri

// ─────────────────────────────────────────────────────────────────────────────
// SalesInvoiceSuccessModal.jsx
// Padanan PurchaseOrderSuccessModal.jsx untuk Sales Invoice. `data` array
// disiapkan sama seperti versi PO (biar konsisten kalau nanti mau dukung
// submit multi-customer sekaligus), tapi untuk alur normal isinya cuma 1
// elemen — hasil dari useSalesInvoiceSubmit.jsx.
//
// Tiap elemen data: { documentNo, status, grandTotal, customerName, date, items }
// (nama field grandTotal di sini dipetakan dari `total` supaya konsisten
// dengan properti balikan hook — sesuaikan kalau kamu rename di container).
// ─────────────────────────────────────────────────────────────────────────────
const SalesInvoiceSuccessModal = ({ isOpen, data, onClose }) => {
  const navigate = useNavigate();
  const handleClose = () => { onClose(); navigate('/dashboard'); };
  if (!isOpen || !data || data.length === 0) return null;

  const grandTotal = data.reduce((s, inv) => s + (inv.grandTotal ?? inv.total ?? 0), 0);
  const isAllDraft = data.every(inv => inv.status === 'Draft');

  const headerTitle = isAllDraft
    ? (data.length > 1 ? `${data.length} Draft Invoice Berhasil Dibuat!` : 'Draft Invoice Berhasil Dibuat!')
    : (data.length > 1 ? `${data.length} Sales Invoice Berhasil Dibuat!` : 'Sales Invoice Berhasil Dibuat!');

  const headerSubtitle = isAllDraft
    ? 'Invoice masih Draft — periksa & tekan Complete dari iDempiere kalau sudah siap.'
    : 'Dokumen telah di-Complete.';

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

        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: isAllDraft ? '#f3f4f6' : COLOR.successLt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 8px',
        }}>
          {isAllDraft
            ? <ShoppingCartIcon size={30} color={COLOR.danger} />
            : <ShoppingCartIcon size={30} color={COLOR.success} />
          }
        </div>

        <div style={{ fontSize: '19px', fontWeight: 700, color: COLOR.success, marginBottom: '4px' }}>
          {headerTitle}
        </div>
        <div style={{ fontSize: '13px', color: COLOR.textMd, marginBottom: '18px' }}>
          {headerSubtitle}
        </div>

        {data.map((inv, i) => (
          <div key={i} style={{
            background: COLOR.successLt, border: '1px solid #bbf7d0',
            borderRadius: RADIUS.md, padding: '14px', marginBottom: '12px', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: COLOR.textDk }}>{inv.documentNo}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: COLOR.textDk }}>{formatCurrency(inv.grandTotal ?? inv.total)}</span>
            </div>
            <div style={{ fontSize: '11px', color: COLOR.textLt, marginBottom: '8px' }}>
              👤 {inv.customerName} · {inv.date}
            </div>
            {inv.items.map((item, j) => (
              <div key={j} style={{
                display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0',
                borderTop: j > 0 ? '1px solid #d1fae5' : 'none',
              }}>
                <span style={{ color: '#333', flex: 1, marginRight: '8px' }}>{item.Name}</span>
                <span style={{ color: COLOR.textMd, whiteSpace: 'nowrap' }}>
                  {item.Qty} {item.UomName} × {formatCurrency(item.Price)}
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
            <span style={{ fontSize: '14px', fontWeight: 700, color: COLOR.textDk }}>{formatCurrency(grandTotal)}</span>
          </div>
        )}

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

export default SalesInvoiceSuccessModal;