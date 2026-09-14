import { useState, useCallback } from "react";
import { fkId } from "@/api/idempiereApi";

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

// FIX: sebelumnya di sini ada helper lokal `extractCreatedId` yang logikanya
// beda dari `fkId` (util bersama, dipakai konsisten di seluruh codebase-mu —
// lihat useCashPurchaseSubmit.jsx: `fkId(poRes.id) ?? poRes.id ?? poRes.C_Order_ID`).
// Kalau response create M_Product ternyata bentuknya beda dari asumsi helper
// lokal itu, `finalProductId` bisa jadi objek atau undefined — akibatnya
// M_Product_ID yang dikirim ke baris Vendor Pricing/Sales Price di Step 2 & 3
// jadi salah/kosong. Sekarang pakai `fkId` dengan urutan fallback yang sama
// persis seperti pola PO/Receipt/Invoice di useCashPurchaseSubmit.jsx.
const extractProductId = (created) => fkId(created?.id) ?? created?.id ?? created?.M_Product_ID;

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
     *
     * Kalau gagal di tengah jalan, error yang dilempar dibekali `err.step`
     * (tahap yang gagal) dan `err.partial` (apa saja yang SUDAH berhasil,
     * termasuk `productId` kalau M_Product-nya sendiri sudah kepalang
     * terbuat) — pola yang sama seperti penanganan error di
     * useCashPurchaseSubmit.jsx, supaya M_Product yang sudah tercipta tidak
     * "hilang tanpa jejak" walau baris Vendor Pricing/Sales Price-nya gagal.
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
                let currentStep = "product";
                const partial = {
                    productId: null,
                    vendorLinesCreated: 0,
                    vendorLinesUpdated: 0,
                    vendorLinesDeleted: 0,
                    priceLinesCreated: 0,
                    priceLinesUpdated: 0,
                    priceLinesDeleted: 0,
                };

                try {
                    // ── Step 1: M_Product ────────────────────────────────
                    let finalProductId = productId;
                    if (isNew) {
                        const created = await idempiereApi(`/models/m_product`, {
                            method: "POST",
                            body: JSON.stringify(productPayload),
                        });
                        finalProductId = extractProductId(created);
                        if (!finalProductId) {
                            throw new Error("Gagal mendapatkan M_Product_ID dari response create produk.");
                        }
                    } else {
                        await idempiereApi(`/models/m_product/${productId}`, {
                            method: "PUT",
                            body: JSON.stringify(productPayload),
                        });
                    }
                    partial.productId = finalProductId;

                    // ── Step 2: Vendor Pricing — pakai finalProductId di
                    // sini, langsung, tanpa user perlu klik simpan lagi ────
                    currentStep = "vendor-lines";
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
                                partial.vendorLinesUpdated++;
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
                            partial.vendorLinesCreated++;
                        }
                    }
                    currentStep = "vendor-lines-delete";
                    for (const delId of deletedVendorIds) {
                        await idempiereApi(`/models/${VENDOR_PRICING_TABLE}/${delId}`, { method: "DELETE" });
                        partial.vendorLinesDeleted++;
                    }

                    // ── Step 3: Sales Price — pola sama seperti Vendor
                    // Pricing ───────────────────────────────────────────
                    currentStep = "price-lines";
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
                                partial.priceLinesUpdated++;
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
                            partial.priceLinesCreated++;
                        }
                    }
                    currentStep = "price-lines-delete";
                    for (const delId of deletedPriceIds) {
                        await idempiereApi(`/models/m_productprice/${delId}`, { method: "DELETE" });
                        partial.priceLinesDeleted++;
                    }

                    return finalProductId;
                } catch (err) {
                    // Bekali error dengan tahap yang gagal + apa saja yang
                    // sudah sempat berhasil, supaya pemanggil (ProductDetail.js)
                    // bisa kasih tahu user M_Product_ID mana yang sudah
                    // terbentuk walau prosesnya berhenti di tengah.
                    err.step = currentStep;
                    err.partial = partial;
                    throw err;
                }
            }),
        [idempiereApi, run]
    );

    return {
        isSaving,
        error,
        saveProductWithLines,
    };
}
