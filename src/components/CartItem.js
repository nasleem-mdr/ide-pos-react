import React from 'react';
import UOMSelect from './UOMSelect';
import '../css/CartItem.css';

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

  return (
    <div className="cart-item">
      {/* Product name */}
      <div className="ci-product" title={item.Name}>
        {item.Name}
        {!hasUOMOptions && item.selectedUOM?.name && (
          <span className="ci-uom-badge">{item.selectedUOM.name}</span>
        )}
      </div>

      {/* UOM combobox — hanya muncul jika ada konversi */}
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
          onClick={() => onQtyChange(item.M_Product_ID, item.QtyOrdered - 1)}
          disabled={item.QtyOrdered <= 1}
        >−</button>
        <input
          className="ci-qty-input"
          type="number"
          min="1"
          value={item.QtyOrdered}
          onChange={e => onQtyChange(item.M_Product_ID, e.target.value)}
        />
        <button
          className="ci-qty-btn"
          onClick={() => onQtyChange(item.M_Product_ID, item.QtyOrdered + 1)}
        >+</button>
      </div>

      {/* Price */}
      <div className="ci-price">
        <input
          className="ci-price-input"
          type="number"
          min="0"
          value={item.PriceActual}
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