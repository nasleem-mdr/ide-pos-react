import React from 'react';
import UOMSelect from '@/shared/components/setup/UOMSelect';
import '@/css/CartItem.css';

/**
 * CartItem — single-row layout:
 *   | Product | UOM | [−] QtyOrdered [+] | PriceActual | [✕] |
 *
 * Props:
 *   item            { M_Product_ID, Name, PriceActual, QtyOrdered, uomOptions, selectedUOM }
 *   onRemove        (id) => void
 *   onQtyChange     (id, value) => void
 *   onPriceChange   (id, value) => void
 *   onUOMChange     (id, uomOption) => void
 */

  const CartItem = ({ item, onRemove, onQtyChange, onPriceChange, onUOMChange }) => {
  const hasUOMOptions = item.uomOptions && item.uomOptions.length > 1;
  const qty   = Number.isFinite(item.QtyEntered)   ? item.QtyEntered   : 1;
  const price = Number.isFinite(item.PriceEntered) ? item.PriceEntered : 0;

  return (
    <div className={`cart-item${hasUOMOptions ? ' has-uom' : ''}`}>
      {/* Product name — kolom ini yang flex mengisi sisa */}
      <div className="ci-product" title={item.Name}>
        {item.Name}
        {!hasUOMOptions && item.selectedUOM?.name && (
          <span className="ci-uom-badge">{item.selectedUOM.name}</span>
        )}
      </div>

      {/* UOM — hanya render jika ada opsi */}
      {hasUOMOptions && (
        <div className="ci-uom">
          <UOMSelect
            uomOptions={item.uomOptions}
            selectedId={item.selectedUOM?.id}
            onChange={(uomOption) => onUOMChange(item.M_Product_ID, uomOption)}
          />
        </div>
      )}
      {/* Qty stepper */}
      <div className="ci-qty">
        <button
          className="ci-qty-btn"
          onClick={() => onQtyChange(item.M_Product_ID, qty - 1)}
          disabled={qty <= 1}
        >−</button>
        <input
          className="ci-qty-input"
          type="number"
          min="1"
          value={qty}
          onChange={e => onQtyChange(item.M_Product_ID, e.target.value)}
        />
        <button
          className="ci-qty-btn"
          onClick={() => onQtyChange(item.M_Product_ID, qty + 1)}
        >+</button>
      </div>

      {/* Price */}
      <div className="ci-price">
        <input
          className="ci-price-input"
          type="number"
          min="0"
          value={price}
          onChange={e => onPriceChange(item.M_Product_ID, e.target.value)}
        />
      </div>

      {/* Delete */}
      <button
        className="ci-delete"
        onClick={() => onRemove(item.M_Product_ID)}
        title="Hapus item"
      >✕</button>
    </div>
  );
};

export default CartItem;