import React from 'react';
import POCartItem from './POCartItem';
import { lineKey } from '../../hooks/usePOCart';
import { COLOR, RADIUS } from '../../utils/styleTokens';

const fmtRp = (n) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

// ─────────────────────────────────────────────────────────────────────────────
// POCartSidebar.jsx
// Padanan CartSidebar.jsx untuk Purchasing. Perbedaan utama: baris di-render
// per KELOMPOK VENDOR (bukan list datar), dengan subtotal per grup — supaya
// user bisa lihat langsung "kalau saya submit sekarang, akan jadi berapa PO
// dan masing-masing senilai berapa" SEBELUM benar-benar submit.
//
// Field Description ditempatkan di bawah header (sebelum daftar item) —
// kalau dikosongkan user, PurchasingContainer akan fallback ke
// PURCHASING_CONFIG.DESCRIPTION saat submit (lihat descriptionPlaceholder).
// ─────────────────────────────────────────────────────────────────────────────
const POCartSidebar = ({
  vendorGroups, onRemove, onQtyChange, onPriceChange, onVendorClick,
  onClearCart, totalItems, totalAmount, summaryRight,
  title = '🧾 Daftar Purchase Order',
  onSubmitDraft, onSubmitComplete, 
  isSubmitting = false,
  emptyLabel = 'Belum ada produk dipilih.',
  width = '380px',
  description = '',
  onDescriptionChange,
  descriptionPlaceholder = 'Keterangan Purchase Order...',
}) => {
  const vendorCount = vendorGroups.length;
  const hasIncompleteVendor = vendorGroups.some(g => !g.C_BPartner_ID);

  return (
    <div style={{
      width, flexShrink: 0, background: COLOR.surface,
      borderLeft: `1px solid ${COLOR.border}`,
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: '15px', color: COLOR.textDk }}>
          {title}
          {totalItems > 0 && (
            <span style={{
              marginLeft: '8px', background: COLOR.primary, color: '#fff',
              borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{totalItems}</span>
          )}
        </span>
        {totalItems > 0 && onClearCart && (
          <button
            onClick={onClearCart}
            style={{
              background: COLOR.dangerLt, border: 'none', color: COLOR.danger,
              borderRadius: RADIUS.sm, padding: '5px 10px', fontSize: '12px',
              cursor: 'pointer', fontWeight: 600,
            }}
          >Kosongkan</button>
        )}
      </div>

      {onDescriptionChange && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: COLOR.textMd, marginBottom: '4px' }}>
            Keterangan
          </label>
          <input
            type="text"
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder={descriptionPlaceholder}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px',
              border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.sm,
              fontSize: '13px', color: COLOR.textDk, outline: 'none',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', minHeight: 0 }}>
        {totalItems === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: COLOR.textLt }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
            <p style={{ fontSize: '13px', margin: 0 }}>{emptyLabel}</p>
          </div>
        ) : (
          vendorGroups.map(group => (
            <div key={group.C_BPartner_ID ?? 'unassigned'} style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '12px', fontWeight: 700,
                color: group.C_BPartner_ID ? COLOR.vendor : COLOR.danger,
                marginBottom: '6px', paddingBottom: '4px',
                borderBottom: `1px dashed ${COLOR.border}`,
              }}>
                <span>🚚 {group.VendorName}</span>
                <span>{fmtRp(group.subtotal)}</span>
              </div>
              {group.items.map(item => (
                <POCartItem
                  key={lineKey(item)}
                  item={item}
                  itemKey={lineKey(item)}
                  onRemove={onRemove}
                  onQtyChange={onQtyChange}
                  onPriceChange={onPriceChange}
                  onVendorClick={onVendorClick}
                />
              ))}
            </div>
          ))
        )}
      </div>
      {totalItems > 0 && (onSubmitDraft || onSubmitComplete ) && (
        <div style={{ borderTop: `1px solid ${COLOR.border}`, padding: '14px 16px', flexShrink: 0 }}>
          <div style={{
            background: '#f0f4ff', borderRadius: RADIUS.md, padding: '10px 14px',
            marginBottom: '10px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: '6px',
          }}>
            <div style={{ fontSize: '13px', color: COLOR.textMd }}>
              <strong style={{ color: COLOR.textDk }}>{totalItems}</strong> item ·{' '}
              <strong style={{ color: COLOR.textDk }}>{vendorCount}</strong> vendor
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: COLOR.textDk }}>{fmtRp(totalAmount)}</div>
          </div>
          {summaryRight && (
            <div style={{ fontSize: '11px', color: COLOR.textLt, marginBottom: '10px' }}>{summaryRight}</div>
          )}

          {hasIncompleteVendor && (
            <div style={{
              fontSize: '11px', color: COLOR.danger, background: COLOR.dangerLt,
              borderRadius: RADIUS.sm, padding: '8px 10px', marginBottom: '10px',
            }}>
              ⚠ Masih ada item tanpa vendor. Klik badge 🚚 pada item untuk memilih vendor sebelum submit.
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onSubmitDraft}
            disabled={isSubmitting || hasIncompleteVendor}
            style={{
              background: (isSubmitting || hasIncompleteVendor) ? '#9ca3af' : COLOR.border,
              color: '#0423ce', border: 'none', padding: '14px', width: '100%',
              borderRadius: RADIUS.md, fontWeight: 700, fontSize: '14px',
              cursor: (isSubmitting || hasIncompleteVendor) ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            {isSubmitting
              ? '⏳ Memproses...'
              : `✅ DRAFT ${vendorCount} PO${vendorCount > 1 ? ' (terpisah)' : ''}`}
          </button>
          <button
            onClick={onSubmitComplete}
            disabled={isSubmitting || hasIncompleteVendor}
            style={{
              background: (isSubmitting || hasIncompleteVendor) ? '#9ca3af' : COLOR.primary,
              color: '#fff', border: 'none', padding: '14px', width: '100%',
              borderRadius: RADIUS.md, fontWeight: 700, fontSize: '14px',
              cursor: (isSubmitting || hasIncompleteVendor) ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            {isSubmitting
              ? '⏳ Memproses...'
              : `✅ COMPLETE ${vendorCount} PO${vendorCount > 1 ? ' (terpisah)' : ''}`}
          </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POCartSidebar;