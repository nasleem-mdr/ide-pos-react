import React, { useState } from 'react';
import { COLOR, RADIUS } from '../../utils/styleTokens';

// Fungsi pembantu untuk memotong teks jika melebihi batas karakter
const truncateText = (text, maxLength = 12) => {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

const ProductCard = ({ product, onClick }) => {
  const [pressed, setPressed] = useState(false);

  return (
    <>
      {/* 1. CSS Murni untuk menangani Responsif (Media Query) */}
      <style>{`
        .responsive-card {
          padding: 12px 12px 10px;
          min-height: 80px;
          font-size-name: 13px;
          font-size-value: 11px;
        }

        /* Saat layar mobile (< 768px), otomatis ubah padding & min-height */
        @media (max-width: 767px) {
          .responsive-card {
            padding: 10px 8px !important;
            min-height: 70px !important;
          }
          .responsive-card .prod-name {
            font-size: 12px !important;
          }
          .responsive-card .prod-value {
            font-size: 10px !important;
          }
        }
      `}</style>

      {/* 2. Elemen Card Utama */}
      <div
        onClick={() => onClick(product)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        className="responsive-card" /* Kelas CSS baru dimasukkan di sini */
        style={{
          border: `1.5px solid ${pressed ? COLOR.primary : COLOR.border}`,
          borderRadius: RADIUS.md,
          cursor: 'pointer',
          background: pressed ? '#f0f5ff' : COLOR.surface,
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 0.1s, border-color 0.15s, background 0.1s',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          height: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* Nama Produk */}
        <span 
          className="prod-name"
          style={{
            fontWeight: 700, 
            fontSize: '13px', // Default desktop, di-override CSS di atas saat mobile
            color: COLOR.textDk,
            lineHeight: '1.3', 
            display: '-webkit-box',
            WebkitLineClamp: 2, 
            WebkitBoxOrient: 'vertical', 
            overflow: 'hidden',
          }}
        >
          {truncateText(product.Name, 12)}
        </span>

        {/* Kode/Value Produk */}
        <span 
          className="prod-value"
          style={{ 
            fontSize: '11px', // Default desktop, di-override CSS di atas saat mobile
            color: COLOR.textLt, 
            letterSpacing: '0.03em' 
          }}
        >
          {product.Value}
        </span>

        {/* Vendor */}
        {product.VendorName && (
          <span style={{
            fontSize: '10px', color: COLOR.vendor, background: COLOR.vendorBg,
            borderRadius: '4px', padding: '2px 6px', alignSelf: 'flex-start',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
            maxWidth: '100%',
          }}>
            🏭 {truncateText(product.VendorName, 12)}
          </span>
        )}

        {/* Spacer Push */}
        <div style={{ flexGrow: 1 }} />

        {/* Satuan / UOM */}
        <span style={{
          fontSize: '10px', color: COLOR.textLt,
          background: '#f5f5f5', borderRadius: '4px',
          padding: '1px 5px', alignSelf: 'flex-start',
        }}>
          {product.C_UOM_Name || 'EA'}
        </span>
      </div>
    </>
  );
};

export default ProductCard;