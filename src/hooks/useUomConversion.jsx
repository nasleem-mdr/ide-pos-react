import { useCallback } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useUomConversion.jsx
// M_InventoryLine TIDAK punya kolom C_UOM_ID (dikonfirmasi langsung dari
// struktur tabel iDempiere Anda) — field qty di tabel itu (QtyBook, QtyCount,
// QtyInternalUse) SELALU dalam UOM DASAR produk (C_UOM_ID di M_Product),
// tidak ada tempat menyimpan "qty dientry dalam UOM apa".
//
// Supaya user tetap bisa entry qty dalam UOM yang familiar (mis. "Dus"),
// aplikasi tetap tampilkan pilihan UOM di UI (pakai UomSelector.jsx yang
// sudah ada), tapi konversi ke UOM dasar dilakukan di FRONTEND sebelum
// dikirim ke API:
//
//     QtyInternalUse = QtyEntered × multiplyRate
//
// multiplyRate didapat dari C_UOM_Conversion (M_Product_ID + C_UOM_ID entry
// + C_UOM_To_ID = UOM dasar produk). Kalau tidak ada baris konversi untuk
// kombinasi itu, satu-satunya opsi yang valid adalah UOM dasar produk itu
// sendiri (multiplyRate = 1).
// ─────────────────────────────────────────────────────────────────────────────
export function useUomConversion() {
  // baseUomId/baseUomName = UOM dasar produk (M_Product.C_UOM_ID) — SELALU
  // jadi opsi pertama & fallback, multiplyRate = 1 karena tidak perlu konversi.
  const fetchUomOptions = useCallback(async (productId, baseUomId, baseUomName) => {
    const base = { C_UOM_ID: baseUomId, Name: baseUomName || 'EA', multiplyRate: 1 };
    if (!productId || !baseUomId) return [base];

    try {
      const res = await idempiereApi(
        `/models/c_uom_conversion?$filter=M_Product_ID eq ${productId} and C_UOM_To_ID eq ${baseUomId} and IsActive eq true` +
        `&$select=C_UOM_ID,MultiplyRate`
      );
      const records = Array.isArray(res.records) ? res.records : [];
      const extra = records
        .map(r => ({
          C_UOM_ID: fkId(r.C_UOM_ID),
          Name: fkLabel(r.C_UOM_ID),
          multiplyRate: parseFloat(r.MultiplyRate || 1),
        }))
        .filter(u => u.C_UOM_ID && u.C_UOM_ID !== baseUomId);

      return [base, ...extra];
    } catch (err) {
      console.error(`[useUomConversion] gagal fetch konversi UOM produk #${productId}:`, err);
      return [base]; // fail-safe: tetap bisa input, cuma dalam UOM dasar
    }
  }, []);

  // Helper konversi — dipakai saat submit untuk hitung QtyInternalUse.
  const toBaseQty = useCallback((qtyEntered, selectedUom) => {
    return parseFloat(qtyEntered || 0) * (selectedUom?.multiplyRate ?? 1);
  }, []);

  return { fetchUomOptions, toBaseQty };
}
