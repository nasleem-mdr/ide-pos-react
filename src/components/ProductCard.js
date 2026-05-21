import React from 'react';
import '../css/ProductCard.css';

/**
 * ProductCard
 * Props:
 *   product   { M_Product_ID, Name, Value, PriceActual, ProductCategory: { id, name }, QtyOnHand: number | null }
 *             QtyOnHand: null  = stok masih dimuat (optimistic render)
 *             QtyOnHand: 0     = stok habis
 *             QtyOnHand: > 0   = stok tersedia
 *   onClick   (product) => void  — dipanggil saat card diklik untuk add to cart
 */
const ProductCard = ({ product, onClick }) => {
  const qtyLoading = product.QtyOnHand === null || product.QtyOnHand === undefined;

  return (
    <div
      className="product-card"
      onClick={() => onClick(product)}
    >
      {/* Badge Kategori Produk */}
      {product.ProductCategory?.name && (
        <div className="product-card__category">
          {product.ProductCategory.name}
        </div>
      )}

      <div className="product-card__name">{product.Name}</div>
      <div className="product-card__value">{product.Value}</div>

      {/* Indikator stok — spinner saat null, warna saat sudah ada */}
      <div className={`text-xs mt-1 font-medium ${
          qtyLoading
            ? 'text-gray-400'
            : product.QtyOnHand <= 0
            ? 'text-red-500'
            : product.QtyOnHand <= 5
            ? 'text-yellow-500'
            : 'text-green-600'
      }`}>
        {qtyLoading
          ? 'Stok: ...'
          : `Stok: ${product.QtyOnHand}`
        }
      </div>

      <div className="product-card__price">
        Rp {product.PriceActual?.toLocaleString('id-ID')}
      </div>
    </div>
  );
};

export default ProductCard;