import { useState, useCallback } from "react";

/**
 * useProductDetailSubmit
 * ─────────────────────────────────────────────────────────────────────────
 * REVISI: sebelumnya hook ini expose fungsi terpisah per tabel
 * (createProduct/saveProduct/saveVendorLine/addVendorLine/dst) dan
 * komponen yang memanggilnya satu-satu — user harus klik "Simpan" di
 * M_Product dulu, baru bisa klik simpan lagi di tiap baris Vendor
 * Pricing / Sales Price. Sekarang semua digabung jadi SATU fungsi
 * `saveProductWithLines`:
 *   1) create (mode baru) atau update (mode edit) M_Product
 *   2) pakai M_Product_ID hasil langkah 1 untuk insert baris Vendor
 *      Pricing & Sales Price yang baru ditambahkan di form — tanpa user
 *      perlu melakukan aksi simpan tambahan
 *   3) update baris yang ditandai `_dirty`, hapus baris yang masuk daftar
 *      `deletedVendorIds` / `deletedPriceIds`
 *
 * Komponen (ProductDetail.js) cuma menyusun state lokal (vendorLines,
 * priceLines, deletedVendorIds, deletedPriceIds) dan memanggil fungsi ini
 * SEKALI saat tombol "Simpan" / "Buat Produk" diklik.
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

// Helper lokal (bukan yang di ProductDetail.js) — cuma dipakai untuk baca
// ID hasil create M_Product, yang bentuknya bisa { id: { id: N } }, { id: N },
// atau { M_Product_ID: N } tergantung versi REST API.
function extractCreatedId(created) {
    if (created?.id?.id !== undefined) return created.id.id;
    if (created?.id !== undefined) return created.id;
    if (created?.M_Product_ID !== undefined) return created.M_Product_ID;
    return undefined;
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

    /**
     * saveProductWithLines
     * ────────────────────────────────────────────────────────────────────
     * @param {boolean} isNew
     * @param {number|string|null} productId - null/undefined kalau isNew
     * @param {object} productPayload - payload M_Product siap kirim
     * @param {Array} vendorLines - [{ id, C_BPartner_ID, VendorProductNo, PriceList, PriceLastPO, _dirty }]
     *   `id` null/undefined -> baris baru (di-POST, dikaitkan ke M_Product_ID hasil langkah 1)
     *   `id` ada & `_dirty` true -> di-PUT
     *   `id` ada & `_dirty` false -> dilewati (tidak ada perubahan)
     * @param {Array<number>} deletedVendorIds - id baris Vendor Pricing yang dihapus user di form
     * @param {Array} priceLines - [{ id, M_PriceList_Version_ID, PriceList, PriceStd, PriceLimit, _dirty }]
     * @param {Array<number>} deletedPriceIds - id baris Sales Price yang dihapus user di form
     * @returns {Promise<number>} M_Product_ID (baru atau existing)
     */
    const saveProductWithLines = useCallback(
        ({
            isNew,
            productId,
            productPayload,
            vendorLines = [],
            deletedVendorIds = [],
            priceLines = [],
            deletedPriceIds = [],
        }) =>
            run(async () => {
                // ── Step 1: M_Product ────────────────────────────────────
                let finalProductId = productId;
                if (isNew) {
                    const created = await idempiereApi(`/models/m_product`, {
                        method: "POST",
                        body: JSON.stringify(productPayload),
                    });
                    finalProductId = extractCreatedId(created);
                    if (!finalProductId) {
                        throw new Error("Response tidak berisi ID produk baru.");
                    }
                } else {
                    await idempiereApi(`/models/m_product/${productId}`, {
                        method: "PUT",
                        body: JSON.stringify(productPayload),
                    });
                }

                // ── Step 2: Vendor Pricing — pakai finalProductId di sini,
                // langsung, tanpa user perlu klik simpan lagi ──────────────
                for (const line of vendorLines) {
                    const payload = {
                        VendorProductNo: line.VendorProductNo || "",
                        PriceList: parseFloat(line.PriceList) || 0,
                        PriceLastPO: parseFloat(line.PriceLastPO) || 0,
                    };
                    if (line.id) {
                        if (line._dirty) {
                            await idempiereApi(`/models/${VENDOR_PRICING_TABLE}/${line.id}`, {
                                method: "PUT",
                                body: JSON.stringify(payload),
                            });
                        }
                    } else {
                        await idempiereApi(`/models/${VENDOR_PRICING_TABLE}`, {
                            method: "POST",
                            body: JSON.stringify({
                                ...payload,
                                M_Product_ID: { id: parseInt(finalProductId, 10) },
                                C_BPartner_ID: { id: parseInt(line.C_BPartner_ID, 10) },
                            }),
                        });
                    }
                }
                for (const delId of deletedVendorIds) {
                    await idempiereApi(`/models/${VENDOR_PRICING_TABLE}/${delId}`, { method: "DELETE" });
                }

                // ── Step 3: Sales Price — pola sama seperti Vendor Pricing ─
                for (const line of priceLines) {
                    const payload = {
                        PriceList: parseFloat(line.PriceList) || 0,
                        PriceStd: parseFloat(line.PriceStd) || 0,
                        PriceLimit: parseFloat(line.PriceLimit) || 0,
                    };
                    if (line.id) {
                        if (line._dirty) {
                            await idempiereApi(`/models/m_productprice/${line.id}`, {
                                method: "PUT",
                                body: JSON.stringify(payload),
                            });
                        }
                    } else {
                        await idempiereApi(`/models/m_productprice`, {
                            method: "POST",
                            body: JSON.stringify({
                                ...payload,
                                M_Product_ID: { id: parseInt(finalProductId, 10) },
                                M_PriceList_Version_ID: { id: parseInt(line.M_PriceList_Version_ID, 10) },
                            }),
                        });
                    }
                }
                for (const delId of deletedPriceIds) {
                    await idempiereApi(`/models/m_productprice/${delId}`, { method: "DELETE" });
                }

                return finalProductId;
            }),
        [idempiereApi, run]
    );

    return {
        isSaving,
        error,
        saveProductWithLines,
    };
}
