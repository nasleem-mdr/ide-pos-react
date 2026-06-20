import { useState, useCallback, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useCart.js
// Logic keranjang generic — add/remove/update qty/update UoM, plus turunan
// totalQty & totalItems. Diekstrak dari RequisitionContainer karena pola yang
// sama persis dipakai di POSContainer (ide-pos-react) untuk keranjang belanja.
//
// Item cart diharapkan berbentuk:
//   { M_Product_ID, Name, Value, C_UOM_ID, C_UOM_Name, Qty, selectedUom, uomOptions, ... }
//
// Penggunaan:
//   const { cart, addToCart, removeFromCart, updateQty, updateUom, totalQty, totalItems, clearCart } = useCart();
//   addToCart(product, 3, { C_UOM_ID: 105, Name: 'Lusin', multiplyRate: 12 });
// ─────────────────────────────────────────────────────────────────────────────
export function useCart(initialItems = []) {
  const [cart, setCart] = useState(initialItems);

  // qty & uom opsional — kalau tidak diisi, default qty=1 dan UoM dasar produk.
  // Ini memungkinkan dua mode pemakaian:
  //   1) addToCart(product)            → quick-add (mis. dari hasil scan barcode)
  //   2) addToCart(product, qty, uom)  → dari modal detail produk
  const addToCart = useCallback((product, qty = 1, uom = null) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.M_Product_ID === product.M_Product_ID);
      if (idx >= 0) {
        return prev.map((item, i) => i === idx ? { ...item, Qty: item.Qty + qty } : item);
      }
      return [...prev, {
        ...product,
        Qty: qty,
        selectedUom: uom || { C_UOM_ID: product.C_UOM_ID, Name: product.C_UOM_Name, multiplyRate: 1 },
      }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prev => prev.filter(i => i.M_Product_ID !== productId));
  }, []);

  // Qty <= 0 otomatis menghapus item, supaya pemanggil (stepper "−") tidak
  // perlu menangani kasus ini sendiri-sendiri.
  const updateQty = useCallback((productId, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.M_Product_ID !== productId));
      return;
    }
    setCart(prev => prev.map(i => i.M_Product_ID === productId ? { ...i, Qty: newQty } : i));
  }, []);

  const updateUom = useCallback((productId, uom) => {
    setCart(prev => prev.map(i => i.M_Product_ID === productId ? { ...i, selectedUom: uom } : i));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalQty   = useMemo(() => cart.reduce((s, i) => s + i.Qty, 0), [cart]);
  const totalItems = useMemo(() => cart.length, [cart]);

  return {
    cart, setCart,
    addToCart, removeFromCart, updateQty, updateUom, clearCart,
    totalQty, totalItems,
  };
}
