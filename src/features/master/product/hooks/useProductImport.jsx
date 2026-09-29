import { useState, useCallback } from "react";
import { idempiereApi, fkId } from "@/api/idempiereApi";
// Reuse konstanta & parser error yang sudah ada supaya perilaku import
// konsisten dengan halaman ProductDetail (nama tabel vendor pricing,
// pesan error mandatory yang ramah, dll).
import { VENDOR_PRICING_TABLE, parseIdempiereError } from "./useProductDetailSubmit";

/**
 * useProductImport
 * ─────────────────────────────────────────────────────────────────────────
 * Hook untuk fitur Import Produk CSV:
 *   validateRows(rows)  → cek mandatory, duplikat (file & server), resolve
 *                         kategori/UOM/vendor/price-list-version by name.
 *                         Tiap row jadi row._status = "valid" | "invalid"
 *                         + row._errors + row._resolved (id-id hasil resolve).
 *   startImport(rows)   → POST m_product per baris valid, lalu (opsional)
 *                         Vendor Pricing (VENDOR_PRICING_TABLE) & Sales Price
 *                         (m_productprice). Tiap row jadi "success"|"failed".
 *
 * CATATAN: BOM (IsBOM + komponen) SENGAJA tidak diimpor dari CSV — struktur
 * multi-baris komponen tidak natural di format flat CSV. Produk dengan
 * is_bom=y tetap bisa diimpor (flag-nya terset), komponen diisi lewat
 * halaman edit ProductDetail.
 */

// ⚠️ Mirror ROUNDING_TYPE_OPTIONS di ProductDetail.jsx — sesuaikan kalau
// AD_Ref_List RoundingType di instance-mu berbeda.
const ROUNDING_ALLOWED = [0, 50, 100, 500, 1000, 5000, 10000];

const parseBool = (v) =>
    ["y", "yes", "true", "1", "t"].includes(String(v ?? "").trim().toLowerCase());

// Angka toleran format Indonesia: "1500,50", "1.500.000", "1.500.000,50".
const parseNumber = (v) => {
    if (v === "" || v == null) return null;
    let s = String(v).trim().replace(/\s/g, "");
    if (s.includes(",") && s.includes(".")) {
        s = s.replace(/\./g, "").replace(",", ".");      // 1.500.000,50
    } else if (s.includes(",")) {
        const parts = s.split(",");
        s = parts.length > 1 && parts[parts.length - 1].length === 3
            ? s.replace(/,/g, "")                          // 1,500 → 1500
            : s.replace(",", ".");                         // 1500,50 → 1500.50
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
};

// OData escape untuk string yang masuk ke $filter
const odataEscape = (s) => String(s).replace(/'/g, "''");

const addError = (row, msg) => { (row._errors = row._errors || []).push(msg); };

function buildProductPayload(row) {
    return {
        Value: row.value,
        Name: row.name,
        Description: row.description || "",
        IsPurchased: parseBool(row.is_purchased),
        IsSold: parseBool(row.is_sold),
        // Default IsStocked = true, sama seperti default kolom di iDempiere.
        IsStocked: row.is_stocked ? parseBool(row.is_stocked) : true,
        IsBOM: parseBool(row.is_bom),
        // Phantom & BOM Price Override tidak diimpor — default false,
        // sama seperti payload ProductDetail.jsx.
        IsPhantom: false,
        IsBOMPriceOverride: false,
        MarkupPercent: row.markup_percent ? parseNumber(row.markup_percent) : 0,
        RoundingType: row.rounding_type ? parseNumber(row.rounding_type) : 0,
        M_Product_Category_ID: { id: parseInt(row._resolved.categoryId, 10) },
        C_UOM_ID: { id: parseInt(row._resolved.uomId, 10) },
    };
}

export default function useProductImport() {
    // idle → validating → ready → importing → done
    const [phase, setPhase] = useState("idle");
    const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
    const [summary, setSummary] = useState(null); // { success, failed }

    // ─── VALIDASI ─────────────────────────────────────────────────────────
    const validateRows = useCallback(async (rows) => {
        setPhase("validating");
        setSummary(null);

        // 1) Cache referensi: kategori produk, UOM, price list version
        let cats = [], uoms = [], plvs = [];
        try {
            const [catRes, uomRes, plvRes] = await Promise.all([
                idempiereApi(`/models/m_product_category?$filter=IsActive eq true&$select=Name`),
                idempiereApi(`/models/c_uom?$filter=IsActive eq true&$select=Name`),
                idempiereApi(`/models/m_pricelist_version?$filter=IsActive eq true&$select=Name`),
            ]);
            cats = catRes.records || [];
            uoms = uomRes.records || [];
            plvs = plvRes.records || [];
        } catch (err) {
            rows.forEach((r) => { r._status = "invalid"; r._errors = ["Gagal memuat data referensi (kategori/UOM/price list): " + err.message]; });
            setPhase("ready");
            return rows;
        }
        const findByName = (list, name) =>
            list.find((x) => (x.Name || "").trim().toLowerCase() === name.toLowerCase());

        // 2) Duplikat Search Key di dalam file
        const seen = new Map();
        rows.forEach((r) => {
            const k = (r.value || "").toLowerCase();
            if (!k) return;
            if (seen.has(k)) seen.get(k).push(r); else seen.set(k, [r]);
        });
        seen.forEach((group) => {
            if (group.length > 1) {
                const lines = group.map((g) => g._row).join(", ");
                group.forEach((r) => addError(r, `Search Key "${r.value}" duplikat di dalam file (baris ${lines})`));
            }
        });

        // 3) Duplikat Search Key ke SERVER (per unique value, pakai contains
        //    + exact match client-side — pola yang terbukti jalan di ProductDetail)
        const uniqueValues = [...new Set(rows.map((r) => r.value).filter(Boolean))];
        const existingValues = new Set();
        for (const v of uniqueValues) {
            try {
                const res = await idempiereApi(
                    `/models/m_product?$filter=contains(toupper(Value),toupper('${odataEscape(v)}'))&$select=Value&$top=50`
                );
                if ((res.records || []).some((r) => (r.Value || "").toLowerCase() === v.toLowerCase())) {
                    existingValues.add(v.toLowerCase());
                }
            } catch (_) { /* gagal cek → biarkan server yang menolak saat import */ }
        }
        rows.forEach((r) => {
            if (r.value && existingValues.has(r.value.toLowerCase())) {
                addError(r, `Search Key "${r.value}" sudah ada di iDempiere`);
            }
        });

        // 4) Resolve vendor per unique nama (hanya kalau ada yang pakai)
        const vendorCache = new Map();
        const vendorNames = [...new Set(rows.map((r) => r.vendor).filter(Boolean))];
        for (const name of vendorNames) {
            try {
                const res = await idempiereApi(
                    `/models/c_bpartner?$filter=IsVendor eq true and contains(toupper(Name),toupper('${odataEscape(name)}'))&$select=Name&$top=50`
                );
                const hit = (res.records || []).find((r) => (r.Name || "").trim().toLowerCase() === name.toLowerCase());
                vendorCache.set(name.toLowerCase(), hit ? (hit.id ?? hit.C_BPartner_ID) : null);
            } catch (_) {
                vendorCache.set(name.toLowerCase(), null);
            }
        }

        // 5) Validasi per baris
        const isId = (s) => /^\d+$/.test(s);
        rows.forEach((r) => {
            r._errors = r._errors || [];
            r._resolved = {};

            if (!r.value) addError(r, "Search Key (kolom value) wajib diisi");
            if (!r.name) addError(r, "Name (kolom name) wajib diisi");

            // Product Category: boleh nama ATAU angka ID
            if (!r.product_category) {
                addError(r, "Product Category wajib diisi");
            } else if (isId(r.product_category)) {
                r._resolved.categoryId = parseInt(r.product_category, 10);
            } else {
                const cat = findByName(cats, r.product_category);
                if (!cat) addError(r, `Kategori "${r.product_category}" tidak ditemukan di iDempiere`);
                else r._resolved.categoryId = cat.id ?? cat.M_Product_Category_ID;
            }

            // UOM: boleh nama ATAU angka ID
            if (!r.uom) {
                addError(r, "UOM wajib diisi");
            } else if (isId(r.uom)) {
                r._resolved.uomId = parseInt(r.uom, 10);
            } else {
                const u = findByName(uoms, r.uom);
                if (!u) addError(r, `UOM "${r.uom}" tidak ditemukan di iDempiere`);
                else r._resolved.uomId = u.id ?? u.C_UOM_ID;
            }

            // Angka: markup & rounding
            if (r.markup_percent && Number.isNaN(parseNumber(r.markup_percent))) {
                addError(r, `Markup "${r.markup_percent}" bukan angka valid`);
            }
            const rounding = r.rounding_type ? parseNumber(r.rounding_type) : 0;
            if (!ROUNDING_ALLOWED.includes(rounding)) {
                addError(r, `Rounding Type harus salah satu dari: ${ROUNDING_ALLOWED.join(", ")}`);
            }

            // Vendor (opsional tapi harus valid kalau diisi)
            if (r.vendor) {
                const vid = vendorCache.get(r.vendor.toLowerCase());
                if (!vid) addError(r, `Vendor "${r.vendor}" tidak ditemukan (cek IsVendor & ejaan)`);
                else r._resolved.vendorId = vid;
            }

            // Price List Version + harga jual
            const hasSalesPrice = [r.sales_price_list, r.sales_price_std, r.sales_price_limit].some(Boolean);
            if (r.price_list_version) {
                const plv = findByName(plvs, r.price_list_version);
                if (!plv) addError(r, `Price List Version "${r.price_list_version}" tidak ditemukan`);
                else r._resolved.plvId = plv.id ?? plv.M_PriceList_Version_ID;
            } else if (hasSalesPrice) {
                addError(r, "Kolom price_list_version wajib diisi kalau ada harga jual");
            }

            // Kolom angka harga harus numerik kalau diisi
            ["vendor_price_list", "vendor_price_last_po", "sales_price_list", "sales_price_std", "sales_price_limit"]
                .forEach((col) => {
                    if (r[col] && Number.isNaN(parseNumber(r[col]))) {
                        addError(r, `Kolom ${col}: "${r[col]}" bukan angka valid`);
                    }
                });

            r._status = r._errors.length > 0 ? "invalid" : "valid";
        });

        setPhase("ready");
        return rows;
    }, []);

    // ─── IMPORT ───────────────────────────────────────────────────────────
    // rowsToImport: array row ber-_status "valid" (atau "failed" utk retry).
    // Mutasi row._status/_error/_productId langsung di objek row, jadi
    // pemanggil cukup setRows([...rows]) untuk re-render hasil.
    const startImport = useCallback(async (rowsToImport) => {
        setPhase("importing");
        setSummary(null);
        setProgress({ done: 0, total: rowsToImport.length, current: "" });
        const result = { success: 0, failed: 0 };

        for (let i = 0; i < rowsToImport.length; i++) {
            const row = rowsToImport[i];
            try {
                // 1) M_Product
                const created = await idempiereApi(`/models/m_product`, {
                    method: "POST",
                    body: JSON.stringify(buildProductPayload(row)),
                });
                const pid = fkId(created?.id) ?? created?.id ?? created?.M_Product_ID;
                if (!pid) throw new Error("Server tidak mengembalikan M_Product_ID — cek manual apakah produk tercreate.");
                row._productId = pid;

                // 2) Vendor Pricing (opsional)
                if (row._resolved.vendorId) {
                    await idempiereApi(`/models/${VENDOR_PRICING_TABLE}`, {
                        method: "POST",
                        body: JSON.stringify({
                            M_Product_ID: { id: parseInt(pid, 10) },
                            C_BPartner_ID: { id: parseInt(row._resolved.vendorId, 10) },
                            VendorProductNo: row.vendor_product_no || row.name,
                            PriceList: parseNumber(row.vendor_price_list) || 0,
                            PriceLastPO: parseNumber(row.vendor_price_last_po) || 0,
                        }),
                    });
                }

                // 3) Sales Price (opsional)
                if (row._resolved.plvId) {
                    await idempiereApi(`/models/m_productprice`, {
                        method: "POST",
                        body: JSON.stringify({
                            M_Product_ID: { id: parseInt(pid, 10) },
                            M_PriceList_Version_ID: { id: parseInt(row._resolved.plvId, 10) },
                            PriceList: parseNumber(row.sales_price_list) || 0,
                            PriceStd: parseNumber(row.sales_price_std) || 0,
                            PriceLimit: parseNumber(row.sales_price_limit) || 0,
                        }),
                    });
                }

                row._status = "success";
                row._error = null;
                result.success++;
            } catch (err) {
                row._status = "failed";
                row._error = parseIdempiereError(err);
                result.failed++;
            }
            setProgress({ done: i + 1, total: rowsToImport.length, current: row.value });
        }

        setPhase("done");
        setSummary(result);
        return result;
    }, []);

    return { phase, progress, summary, validateRows, startImport };
}
