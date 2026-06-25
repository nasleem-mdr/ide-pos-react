import { useState } from 'react';
import { COLOR } from '../../utils/styleTokens';
import '../../css/ProductCard.css';

const truncateText = (text, maxLength = 12) => {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

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
      className={`product-card ${pressed ? 'pressed' : ''}`}
    >
      {/* Nama Produk */}
      <span className="prod-name" style={{ color: COLOR.textDk }}>
        {truncateText(product.Name, 12)}
      </span>

      {/* Kode/Value Produk */}
      <span className="prod-value" style={{ color: COLOR.textLt }}>
        {product.Value}
      </span>

      {/* Vendor */}
      {product.VendorName && (
        <span
          className="prod-vendor"
          style={{ color: COLOR.vendor, background: COLOR.vendorBg }}
        >
          🏭 {truncateText(product.VendorName, 12)}
        </span>
      )}

      {/* Spacer */}
      <div className="prod-spacer" />

      {/* Satuan / UOM */}
      <span className="prod-uom" style={{ color: COLOR.textLt }}>
        {product.C_UOM_Name || 'EA'}
      </span>
    </div>
  );
};

export default ProductCard;