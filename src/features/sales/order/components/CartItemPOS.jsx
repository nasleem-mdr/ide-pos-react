import React from 'react';
import QtyStepper from '@/shared/components/common/QtyStepper';
import UomSelector from '@/features/sales/order/components/UomSelectorPOS';
import { COLOR, RADIUS } from '@/utils/styleTokens';

const CartItemPOS = ({ item, onRemove, onQtyChange, onUomChange, onPriceChange }) => {
  const subtotal = (item.PriceEntered ?? 0) * (item.Qty ?? 0);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '6px',
      padding: '10px 12px',
      background: item.isService ? '#fff7ed' : '#f0fdf4',  // beda warna: Service vs Barang, contoh
      borderRadius: RADIUS.md, marginBottom: '8px',
      border: `1px solid ${item.isService ? '#fed7aa' : '#bbf7d0'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: '13px', color: COLOR.textDk,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.Name}
            {item.isService && (
              <span style={{
                marginLeft: '6px', fontSize: '10px', fontWeight: 700,
                color: '#c2410c', background: '#fed7aa',
                borderRadius: '4px', padding: '1px 6px',
              }}>JASA</span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: COLOR.textMd, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
            <span>{item.Value}</span>
            <UomSelector item={item} onUomChange={onUomChange} />
          </div>
        </div>

        <QtyStepper value={item.Qty} onChange={q => onQtyChange(item.M_Product_ID, q)} size="sm" />

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

      {/* Baris harga — khusus POS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: COLOR.textMd }}>
          <span>Rp</span>
          <input
            type="number"
            min={0}
            value={item.PriceEntered ?? 0}
            onChange={e => onPriceChange(item.M_Product_ID, parseFloat(e.target.value) || 0)}
            style={{
              width: '90px', padding: '4px 6px',
              border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm,
              fontSize: '12px', color: COLOR.textDk,
            }}
          />
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: COLOR.textDk }}>
          Rp {subtotal.toLocaleString('id-ID')}
        </div>
      </div>
    </div>
  );
};

export default CartItemPOS;