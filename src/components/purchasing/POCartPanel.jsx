import React from 'react';
import POCartItem from './POCartItem';
import { lineKey } from '../../hooks/usePOCart';
import { COLOR, RADIUS } from '../../utils/styleTokens';

const fmtRp = (n) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

// Padanan CartPanel.jsx untuk Purchasing — konten sama dengan POCartSidebar
// (grouped-by-vendor), tapi dibungkus sebagai bottom-sheet mobile.
const POCartPanel = ({
  isOpen, onClose,
  vendorGroups, onRemove, onQtyChange, onPriceChange, onVendorClick, onClearCart,
  totalItems, totalAmount, summaryRight,
  title = '🧾 Daftar Purchase Order',
  onSubmit, isSubmitting = false,
  emptyLabel = 'Belum ada produk dipilih.',
}) => {
  if (!isOpen) return null;
  const vendorCount = vendorGroups.length;
  const hasIncompleteVendor = vendorGroups.some(g => !g.C_BPartner_ID);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.35)' }}
    >
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: COLOR.surface, borderRadius: `${RADIUS.xl} ${RADIUS.xl} 0 0`,
        maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div onClick={onClose} style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#d1d5db', cursor: 'pointer' }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px 6px', borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0,
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {totalItems > 0 && onClearCart && (
              <button
                onClick={() => { onClearCart(); onClose(); }}
                style={{
                  background: COLOR.dangerLt, border: 'none', color: COLOR.danger,
                  borderRadius: RADIUS.sm, padding: '5px 10px', fontSize: '12px',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >Kosongkan</button>
            )}
            <button
              onClick={onClose}
              style={{
                background: '#f3f4f6', border: 'none', borderRadius: '50%',
                width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR.textMd,
              }}
            >✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: 0 }}>
          {totalItems === 0 ? (
            <p style={{ color: COLOR.textLt, fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>{emptyLabel}</p>
          ) : (
            vendorGroups.map(group => (
              <div key={group.C_BPartner_ID ?? 'unassigned'} style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '12px', fontWeight: 700,
                  color: group.C_BPartner_ID ? COLOR.vendor : COLOR.danger,
                  marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px dashed ${COLOR.border}`,
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

        {totalItems > 0 && onSubmit && (
          <div style={{
            borderTop: `1px solid ${COLOR.border}`, padding: '12px 14px', flexShrink: 0,
            paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
          }}>
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
                ⚠ Masih ada item tanpa vendor. Ketuk badge 🚚 pada item untuk memilih vendor.
              </div>
            )}

            <button
              onClick={onSubmit}
              disabled={isSubmitting || hasIncompleteVendor}
              style={{
                background: (isSubmitting || hasIncompleteVendor) ? '#9ca3af' : COLOR.primary,
                color: '#fff', border: 'none', padding: '14px', width: '100%',
                borderRadius: RADIUS.md, fontWeight: 700, fontSize: '14px',
                cursor: (isSubmitting || hasIncompleteVendor) ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting
                ? '⏳ Memproses...'
                : `✅ BUAT ${vendorCount} PURCHASE ORDER${vendorCount > 1 ? ' (terpisah)' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default POCartPanel;
