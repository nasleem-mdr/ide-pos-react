import { useState, useCallback, useMemo } from 'react';
import { lineKey } from '@/shared/hooks/usePOCart';

/**
 * Cart for Sales Invoice lines, grouped by customer (C_BPartner_ID) —
 * mirrors `useInvoiceCart` (vendor-grouped) on the AP side.
 *
 * Item shape matches exactly what POLineDetailSheet.jsx's handleConfirm()
 * emits: { C_OrderLine_ID, C_Order_ID, M_Product_ID, Name, C_UOM_ID,
 * UomName, Qty, Price, C_BPartner_ID, VendorName, CustomerName,
 * C_BPartner_Location_ID, OrderDocumentNo } — so POCartSidebar/POCartPanel/
 * POCartItem can render Sales cart items unchanged.
 *
 * ⚠️ NOT VERIFIED: removeItem/updateQty/updatePrice below assume
 * POCartItem's onRemove/onQtyChange/onPriceChange callbacks are called with
 * `lineKey(item)` as the first argument (matching how POCartSidebar keys
 * the list: `key={lineKey(item)}`). This mirrors the pattern but I don't
 * have usePOCart.js or POCartItem.jsx to confirm the exact callback
 * signature — please check against the real usePOCart implementation
 * before wiring this up, or share those two files so I can align exactly.
 */
export function useSalesInvoiceCart() {
  const [cart, setCart] = useState([]);

  const addItems = useCallback((chosenLines) => {
    setCart((prev) => {
      const next = [...prev];
      for (const line of chosenLines) {
        const key = lineKey(line);
        const idx = next.findIndex((l) => lineKey(l) === key);
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...line };
        } else {
          next.push(line);
        }
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((key) => {
    setCart((prev) => prev.filter((l) => lineKey(l) !== key));
  }, []);

  const updateQty = useCallback((key, qty) => {
    setCart((prev) => prev.map((l) => (lineKey(l) === key ? { ...l, Qty: qty } : l)));
  }, []);

  const updatePrice = useCallback((key, price) => {
    setCart((prev) => prev.map((l) => (lineKey(l) === key ? { ...l, Price: price } : l)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalItems = cart.length;

  const totalAmount = useMemo(
    () => cart.reduce((sum, l) => sum + (Number(l.Qty) || 0) * (Number(l.Price) || 0), 0),
    [cart]
  );

  // Named `customerGroups` here (vs `vendorGroups` on the AP side) — map it
  // to POCartSidebar/POCartPanel's `vendorGroups` prop at the JSX call site,
  // e.g. <POCartSidebar vendorGroups={customerGroups} .../>. No component
  // changes needed for this — it's just a prop name at the call site.
  const customerGroups = useMemo(() => {
    const groups = {};
    for (const item of cart) {
      const key = item.C_BPartner_ID ?? 'unassigned';
      if (!groups[key]) {
        groups[key] = {
          C_BPartner_ID: item.C_BPartner_ID,
          VendorName: item.VendorName,
          CustomerName: item.CustomerName,
          items: [],
          subtotal: 0,
        };
      }
      groups[key].items.push(item);
      groups[key].subtotal += (Number(item.Qty) || 0) * (Number(item.Price) || 0);
    }
    return Object.values(groups);
  }, [cart]);

  return {
    cart,
    addItems,
    removeItem,
    updateQty,
    updatePrice,
    clearCart,
    totalItems,
    totalAmount,
    customerGroups,
  };
}
