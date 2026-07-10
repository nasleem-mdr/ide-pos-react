import React from 'react';
import QtyStepper from '../common/QtyStepper';
import { COLOR, RADIUS } from '../../utils/styleTokens';

const fmtRp = (n) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

// ─────────────────────────────────────────────────────────────────────────────
// POCartItem.jsx
// Padanan CartItem.jsx untuk modul Purchasing — ditambah 2 kontrol yang tidak
// ada di modul lain: badge vendor (klik untuk ganti) dan input harga satuan.
// Line Amount dihitung langsung di render (Qty × Price), tidak disimpan
// terpisah supaya tidak pernah stale saat qty/harga diubah.
// ─────────────────────────────────────────────────────────────────────────────
const POCartItem = ({ item, itemKey, onRemove, onQtyChange, onPriceChange, onVendorClick }) => {
  const lineAmount = item.Qty * (item.Price || 0);
  const hasVendor = !!item.C_BPartner_ID;

  return (
    <div style={{
      background: '#f7f9ff', border: `1px solid ${COLOR.border}`,
      borderRadius: RADIUS.md, padding: '10px', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: '13px', color: COLOR.textDk,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{item.Name}</div>
          <div style={{ fontSize: '11px', color: COLOR.textLt }}>{item.UomName || item.C_UOM_Name}</div>
        </div>
        <button
          onClick={() => onRemove(itemKey)}
          style={{
            background: COLOR.dangerLt, border: 'none', cursor: 'pointer',
            color: COLOR.danger, fontSize: '13px', padding: '5px 8px',
            borderRadius: RADIUS.sm, flexShrink: 0, lineHeight: 1, height: 'fit-content',
          }}
        >✕</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onVendorClick(item, itemKey)}
          style={{
            background: hasVendor ? COLOR.vendorBg : COLOR.dangerLt,
            color: hasVendor ? COLOR.vendor : COLOR.danger,
            border: 'none', borderRadius: RADIUS.sm, padding: '5px 9px',
            fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          🚚 {hasVendor ? item.VendorName : 'Pilih Vendor'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ fontSize: '11px', color: COLOR.textLt }}>Rp</span>
          <input
            type="number"
            min="0"
            value={item.Price}
            onChange={e => onPriceChange(itemKey, parseFloat(e.target.value) || 0)}
            style={{
              width: '90px', padding: '5px 6px', border: `1px solid ${COLOR.border}`,
              borderRadius: RADIUS.sm, fontSize: '12px', fontWeight: 600, color: COLOR.textDk,
            }}
          />
        </div>

        <QtyStepper value={item.Qty} onChange={q => onQtyChange(itemKey, q)} size="sm" />
      </div>

      <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '12px', fontWeight: 700, color: COLOR.textDk }}>
        = {fmtRp(lineAmount)}
      </div>
    </div>
  );
};

export default POCartItem;
