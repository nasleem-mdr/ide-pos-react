import React, { useState, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import QtyStepper from '../common/QtyStepper';
import { COLOR, RADIUS } from '../../utils/styleTokens';

// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailSheet.jsx
// Modal detail produk: vendor, UoM, qty, tombol konfirmasi. Dipakai saat user
// klik kartu produk (alur "review dulu sebelum masuk cart"). Generic — tidak
// menyebut "Requisition" sama sekali, sehingga bisa dipakai untuk PO Create,
// Sales Order line entry, atau modul lain dengan pola yang sama.
//
// onConfirm dipanggil dengan (product, qty, uom) — pemanggil yang menentukan
// mau diapakan (addToCart, addToOrderLine, dll), bukan komponen ini.
//
// Penggunaan:
//   <ProductDetailSheet
//     isOpen={detailOpen} product={selectedProduct}
//     onClose={closeDetail}
//     onConfirm={(product, qty, uom) => addToCart(product, qty, uom)}
//     confirmLabel="Tambah ke Keranjang"
//   />
// ─────────────────────────────────────────────────────────────────────────────
const ProductDetailSheet = ({ isOpen, product, onClose, onConfirm, confirmLabel = 'Tambah ke Keranjang' }) => {
  const [qty, setQty] = useState(1);
  const [uom, setUom] = useState(null);

  useEffect(() => {
    if (product) {
      setQty(1);
      setUom({ C_UOM_ID: product.C_UOM_ID, Name: product.C_UOM_Name, multiplyRate: 1 });
    }
  }, [product]);

  if (!product) return null;

  const hasMultiUom = product.uomOptions && product.uomOptions.length > 1;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="90dvh">
      <div style={{ padding: '12px 18px max(18px, env(safe-area-inset-bottom))' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ flex: 1, marginRight: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: '17px', color: COLOR.textDk, lineHeight: 1.35 }}>
              {product.Name}
            </div>
            <div style={{ fontSize: '12px', color: COLOR.textLt, marginTop: '4px', letterSpacing: '0.03em' }}>
              {product.Value}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLOR.textMd, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
            }}
          >✕</button>
        </div>

        {/* Vendor */}
        {product.VendorName && (
          <div style={{
            fontSize: '12px', color: COLOR.vendor, background: COLOR.vendorBg,
            borderRadius: RADIUS.sm, padding: '8px 12px', marginBottom: '14px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            🏭 <span><strong>Vendor:</strong> {product.VendorName}</span>
          </div>
        )}

        {/* UoM */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: COLOR.textMd, marginBottom: '6px' }}>
            Satuan (UoM)
          </div>
          {hasMultiUom ? (
            <select
              value={uom?.C_UOM_ID}
              onChange={e => {
                const chosen = product.uomOptions.find(u => String(u.C_UOM_ID) === e.target.value);
                if (chosen) setUom(chosen);
              }}
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: '14px',
                color: COLOR.textDk, background: COLOR.bg,
                border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.md,
                padding: '10px 12px', outline: 'none',
              }}
            >
              {product.uomOptions.map(u => (
                <option key={u.C_UOM_ID} value={String(u.C_UOM_ID)}>{u.Name}</option>
              ))}
            </select>
          ) : (
            <div style={{
              fontSize: '14px', color: COLOR.textDk, background: COLOR.bg,
              border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: '10px 12px',
            }}>
              {product.C_UOM_Name || 'EA'}
            </div>
          )}
        </div>

        {/* Qty */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: COLOR.textMd, marginBottom: '6px' }}>
            Jumlah
          </div>
          <QtyStepper value={qty} onChange={setQty} size="lg" />
        </div>

        {/* Confirm */}
        <button
          onClick={() => { if (qty > 0) onConfirm(product, qty, uom); }}
          style={{
            background: COLOR.primary, color: '#fff', border: 'none',
            padding: '14px', width: '100%', borderRadius: RADIUS.md,
            fontWeight: 700, fontSize: '15px', cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ➕ {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
};

export default ProductDetailSheet;
