import React from 'react';
import '../css/ProductCard.css';

/**
 * ProductCard
 * Props:
 *   product   { M_Product_ID, Name, Value, Price }
 *   onClick   (product) => void  — dipanggil saat card diklik untuk add to cart
 */
const ProductCard = ({ product, onClick }) => {
  return (
    <div
      className="product-card"
      onClick={() => onClick(product)}
    >
      <div className="product-card__name">{product.Name}</div>
      <div className="product-card__value">{product.Value}</div>
      <div className="product-card__price">
        Rp {product.PriceActual?.toLocaleString('id-ID')}
      </div>
    </div>
  );
};

export default ProductCard;
