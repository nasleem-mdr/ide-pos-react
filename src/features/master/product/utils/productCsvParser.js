/**
 * productCsvParser.js
 * ─────────────────────────────────────────────────────────────────────────
 * Parser CSV mandiri (tanpa library tambahan) untuk fitur Import Produk.
 *
 * Fitur:
 *   - Auto-deteksi delimiter: koma (,) vs titik koma (;) — file CSV buatan
 *     Excel Indonesia umumnya pakai ";" karena locale desimalnya koma.
 *   - Quoted field: mendukung "..." dengan delimiter/newline di dalamnya,
 *     serta escape quote ganda ("") → ".
 *   - CRLF / LF / baris kosong di akhir file ditangani.
 *
 * Return: { headers, rows, delimiter } — rows = array array string mentah
 * (belum di-mapping ke kolom). Mapping ke kolom dilakukan buildColumnMap()
 * + rowsToObjects() di bawah, dengan alias header Indonesia/Inggris.
 */

export function parseCsvText(text) {
    // Buang BOM UTF-8 (sering ada di CSV hasil export Excel)
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (!text.trim()) return { headers: [], rows: [], delimiter: "," };

    // Deteksi delimiter dari baris header
    const firstNl = text.indexOf("\n");
    const headerLine = firstNl === -1 ? text : text.slice(0, firstNl);
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ";" : ",";

    // State machine parsing
    const rows = [];
    let field = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } // escape ""
                else inQuotes = false;
            } else {
                field += ch; // delimiter & newline di dalam quotes = literal
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delimiter) {
            row.push(field); field = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            row.push(field); field = "";
            rows.push(row); row = [];
        } else {
            field += ch;
        }
    }
    // Field/baris terakung tanpa newline di ujung file
    if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
    // Buang baris kosong di akhir
    while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();

    if (rows.length === 0) return { headers: [], rows: [], delimiter };
    const headers = rows[0].map((h) => h.trim());
    return { headers, rows: rows.slice(1), delimiter };
}

// ─── Mapping header → kolom ────────────────────────────────────────────────
// Alias dibuat longgar (case/spasi di-normalize) supaya file dari user
// "liar" tetap terbaca. Kunci = nama kolom internal.
const HEADER_ALIASES = {
    value:              ["value", "search_key", "kode", "kode_produk", "sku"],
    name:               ["name", "nama", "nama_produk"],
    description:        ["description", "deskripsi", "desc"],
    product_category:   ["product_category", "kategori", "kategori_produk", "category"],
    uom:                ["uom", "satuan", "unit"],
    is_purchased:       ["is_purchased", "purchased", "dibeli"],
    is_sold:            ["is_sold", "sold", "dijual"],
    is_stocked:         ["is_stocked", "stocked", "distok"],
    is_bom:             ["is_bom", "bom"],
    markup_percent:     ["markup_percent", "markup", "mark_up"],
    rounding_type:      ["rounding_type", "rounding"],
    vendor:             ["vendor", "vendor_name", "nama_vendor"],
    vendor_product_no:  ["vendor_product_no", "vendor_product"],
    vendor_price_list:  ["vendor_price_list", "price_list_vendor"],
    vendor_price_last_po: ["vendor_price_last_po", "price_last_po"],
    price_list_version: ["price_list_version", "plv", "versi_price_list"],
    sales_price_list:   ["sales_price_list", "price_list"],
    sales_price_std:    ["sales_price_std", "price_std", "harga_jual"],
    sales_price_limit:  ["sales_price_limit", "price_limit"],
};

const normalizeHeader = (h) =>
    h.replace(/^\uFEFF/, "").toLowerCase().trim().replace(/[\s\-]+/g, "_");

// Kolom yang WAJIB ada di header — sama seperti validasi di ProductDetail.jsx
export const REQUIRED_COLUMNS = ["value", "name", "product_category", "uom"];

// Kembalikan { namaKolomInternal: indexKolomDiCsv } atau lempar Error yang
// isinya daftar kolom wajib yang tidak ketemu.
export function buildColumnMap(headers) {
    const normalized = headers.map(normalizeHeader);
    const map = {};
    const used = new Set();
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        const idx = normalized.findIndex((h, i) => !used.has(i) && aliases.includes(h));
        if (idx !== -1) { map[key] = idx; used.add(idx); }
    }
    const missing = REQUIRED_COLUMNS.filter((k) => map[k] === undefined);
    if (missing.length > 0) {
        throw new Error(
            "Kolom wajib tidak ditemukan di CSV: " + missing.join(", ") +
            ".\nHeader yang dikenali: " + Object.keys(HEADER_ALIASES).join(", ") +
            "\nHeader di file Anda: " + headers.join(" | ")
        );
    }
    return map;
}

// Ubah baris mentah CSV jadi array objek per baris, dengan _row = nomor
// baris di file (baris 1 = header). Baris yang seluruhnya kosong dibuang.
export function rowsToObjects({ rows }, colMap) {
    const out = [];
    rows.forEach((cells, i) => {
        const obj = { _row: i + 2 };
        let hasAny = false;
        for (const [key, idx] of Object.entries(colMap)) {
            const v = (cells[idx] ?? "").trim();
            obj[key] = v;
            if (v) hasAny = true;
        }
        if (hasAny) out.push(obj);
    });
    return out;
}
