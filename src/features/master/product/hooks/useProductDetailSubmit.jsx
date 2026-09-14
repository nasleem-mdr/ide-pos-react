import { useState, useCallback } from "react";

/**
 * useProductDetailSubmit
 * ─────────────────────────────────────────────────────────────────────────
 * Semua operasi PENYIMPANAN (create/update/delete) untuk halaman Product
 * Detail ditaruh di sini — komponen cuma perlu panggil fungsi yang relevan
 * dan baca `isSaving` / `error`. Fetch/read data TETAP di komponen (tidak
 * dipindah), karena yang diminta cuma "operasi penyimpanan".
 */
export default function useProductDetailSubmit(idempiereApi) {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const run = useCallback(async (fn) => {
        setIsSaving(true);
        setError(null);
        try {
            return await fn();
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, []);

    // ─── M_Product (field utama + MarkupPercent + RoundingType) ────────────
    const saveProduct = useCallback((productId, payload) => run(() =>
        idempiereApi(`/models/m_product/${productId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    // ─── M_BPartnerProduct (Vendor Pricing) ─────────────────────────────────
    const saveVendorLine = useCallback((lineId, payload) => run(() =>
        idempiereApi(`/models/m_bpartnerproduct/${lineId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    const addVendorLine = useCallback((payload) => run(() =>
        idempiereApi(`/models/m_bpartnerproduct`, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    const deleteVendorLine = useCallback((lineId) => run(() =>
        idempiereApi(`/models/m_bpartnerproduct/${lineId}`, { method: "DELETE" })
    ), [idempiereApi, run]);

    // ─── M_ProductPrice (Sales Price) ───────────────────────────────────────
    const savePriceLine = useCallback((lineId, payload) => run(() =>
        idempiereApi(`/models/m_productprice/${lineId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    const addPriceLine = useCallback((payload) => run(() =>
        idempiereApi(`/models/m_productprice`, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    const deletePriceLine = useCallback((lineId) => run(() =>
        idempiereApi(`/models/m_productprice/${lineId}`, { method: "DELETE" })
    ), [idempiereApi, run]);

    return {
        isSaving,
        error,
        saveProduct,
        saveVendorLine,
        addVendorLine,
        deleteVendorLine,
        savePriceLine,
        addPriceLine,
        deletePriceLine,
    };
}
