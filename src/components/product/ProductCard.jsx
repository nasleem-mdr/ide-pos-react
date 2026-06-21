import React, { useState } from 'react';
import { COLOR, RADIUS } from '../../utils/styleTokens';

// ─────────────────────────────────────────────────────────────────────────────
// ProductCard.jsx
// Tambahan: thumbnail ImageURL kalau tersedia (ditampilkan di atas nama
// produk). Kalau ImageURL kosong, kartu tetap render seperti sebelumnya
// tanpa area gambar kosong yang janggal.
// ─────────────────────────────────────────────────────────────────────────────
const ProductCard = ({ product, onClick }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={() => onClick(product)}
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

export default ProductCard;
