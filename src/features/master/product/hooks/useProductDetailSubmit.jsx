import { useState, useCallback } from "react";

/**
 * useProductDetailSubmit
 * ─────────────────────────────────────────────────────────────────────────
 * Semua operasi PENYIMPANAN (create/update/delete) untuk halaman Product
 * Detail ditaruh di sini — komponen cuma perlu panggil fungsi yang relevan
 * dan baca `isSaving` / `error`. Fetch/read data TETAP di komponen (tidak
 * dipindah), karena yang diminta cuma "operasi penyimpanan".
 */

// ─── Nama tabel Vendor Pricing ──────────────────────────────────────────
// Beberapa instance iDempiere masih pakai nama tabel lama "M_Product_PO",
// yang lain sudah di-rename ke "M_BPartnerProduct". REST API akan balas
// 404 "No match found for table name" kalau nama yang dipakai di sini
// tidak cocok dengan yang terdaftar di instance-mu.
// -> Ganti SATU baris ini saja kalau instance-mu beda; dipakai bersama
//    oleh hook ini maupun ProductDetail.jsx (fetch list-nya).
export const VENDOR_PRICING_TABLE = "m_product_po"; // alternatif: "m_bpartnerproduct"

// ─── Label field per tabel, dipakai untuk menerjemahkan error mandatory ────
// dari Postgres ("null value in column ... of relation ...") jadi pesan
// yang enak dibaca user, bukan dump baris database.
const FIELD_LABELS = {
    m_product: {
        value: "Search Key",
        name: "Name",
        m_product_category_id: "Product Category",
        c_uom_id: "UOM",
        c_taxcategory_id: "Tax Category",
    },
    m_bpartnerproduct: {
        c_bpartner_id: "Vendor",
        m_product_id: "Product",
    },
    m_product_po: {
        c_bpartner_id: "Vendor",
        m_product_id: "Product",
    },
    m_productprice: {
        m_pricelist_version_id: "Price List Version",
        m_product_id: "Product",
        pricelist: "Price List",
        pricestd: "Price Std (Jual)",
        pricelimit: "Price Limit",
    },
};

/**
 * parseIdempiereError
 * ─────────────────────────────────────────────────────────────────────────
 * Ubah error mentah dari REST API iDempiere (termasuk dump constraint
 * Postgres seperti "null value in column \"name\" of relation \"m_product\"
 * violates not-null constraint") jadi satu kalimat singkat yang bisa
 * langsung ditampilkan ke user lewat alert/toast.
 */
export function parseIdempiereError(err) {
    const raw = err?.message || String(err ?? "");

    // Kasus paling umum: mandatory field kosong sampai lolos ke DB.
    const nullValueMatch = raw.match(/null value in column "([^"]+)" of relation "([^"]+)"/i);
    if (nullValueMatch) {
        const [, column, table] = nullValueMatch;
        const label = FIELD_LABELS[table.toLowerCase()]?.[column.toLowerCase()] || column;
        return `Field "${label}" wajib diisi (tidak boleh kosong).`;
    }

    // Nama tabel tidak dikenali oleh REST API (mis. beda instance iDempiere
    // pakai nama tabel lama/baru — lihat VENDOR_PRICING_TABLE di atas).
    const noTableMatch = raw.match(/No match found for table name:\s*(\S+)/i);
    if (noTableMatch) {
        return `Tabel "${noTableMatch[1]}" tidak dikenali oleh server iDempiere-mu. Instance-mu kemungkinan pakai nama tabel yang berbeda — cek konstanta VENDOR_PRICING_TABLE.`;
    }

    // Kasus umum lain: duplicate key / unique constraint.
    const duplicateMatch = raw.match(/duplicate key value violates unique constraint/i);
    if (duplicateMatch) {
        return "Data ini sudah ada (melanggar aturan unik), cek Search Key / kombinasi datanya.";
    }

    // Fallback: ambil bagian pesan setelah "Database Error." kalau ada,
    // supaya minimal tidak menampilkan seluruh dump baris tabel.
    const dbErrorMatch = raw.match(/Database Error\.?:?\s*([^\n]+)/i);
    if (dbErrorMatch) return dbErrorMatch[1].trim();

    return raw || "Terjadi kesalahan yang tidak diketahui.";
}

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
    const createProduct = useCallback((payload) => run(() =>
        idempiereApi(`/models/m_product`, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    const saveProduct = useCallback((productId, payload) => run(() =>
        idempiereApi(`/models/m_product/${productId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    // ─── M_BPartnerProduct (Vendor Pricing) ─────────────────────────────────
    const saveVendorLine = useCallback((lineId, payload) => run(() =>
        idempiereApi(`/models/${VENDOR_PRICING_TABLE}/${lineId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    const addVendorLine = useCallback((payload) => run(() =>
        idempiereApi(`/models/${VENDOR_PRICING_TABLE}`, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    ), [idempiereApi, run]);

    const deleteVendorLine = useCallback((lineId) => run(() =>
        idempiereApi(`/models/${VENDOR_PRICING_TABLE}/${lineId}`, { method: "DELETE" })
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
        createProduct,
        saveProduct,
        saveVendorLine,
        addVendorLine,
        deleteVendorLine,
        savePriceLine,
        addPriceLine,
        deletePriceLine,
    };
}