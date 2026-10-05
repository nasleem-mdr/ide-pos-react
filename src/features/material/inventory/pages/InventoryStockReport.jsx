/**
 * StorageStockReport — Laporan Inventory / Ketersediaan Stok
 * ─────────────────────────────────────────────────────────────────────────
 * Menampilkan stok tersedia per produk di tiap gudang (warehouse).
 * Available = OnHand − Reserved.
 *
 * ALUR FETCH:
 *   1) M_Warehouse aktif → opsi filter + pengelompok pivot.
 *   2) M_Locator aktif → map locatorId → warehouseId. (OnHand hanya punya
 *      M_Locator_ID, jadi "join" ke gudang dilakukan di JS lewat map ini.)
 *   3a) OnHand : M_StorageOnHand (QtyOnHand per produk per locator).
 *       Fallback ke model `m_storage` (view kompatibilitas) kalau
 *       `m_storageonhand` ditolak REST.
 *   3b) Reserved: M_StorageReservation (Qty per produk per GUDANG, IsSOTrx=Y).
 *       OJO: tabel ini TIDAK punya M_Locator_ID — kolomnya M_Warehouse_ID.
 *       Fallback ke `m_storage.QtyReserved` (per locator) kalau gagal.
 *       Kalau dua-duanya gagal, laporan tetap tampil dengan Reserved = 0
 *       dan ada peringatan di layar (tidak menggagalkan seluruh laporan).
 *   4) Gabung jadi baris { produk, gudang, onHand, reserved, available }.
 *   5) Filter gudang & pencarian produk di sisi client.
 *   6) Pivot per gudang dihitung dari baris yang sudah difilter (useMemo).
 *
 * PERBAIKAN dari versi sebelumnya:
 *   - Query reserved sebelumnya `m_storage?$select=Qty` — kolom `Qty` tidak
 *     ada di m_storage (itu kolom M_StorageReservation) → query error.
 *   - Reserved sebelumnya di-join lewat M_Locator_ID, padahal M_StorageReservation
 *     per gudang.
 *   - `$top=5000` bisa diabaikan/dipotong server (batas ukuran halaman REST)
 *     sehingga data terpotong diam-diam → sekarang diambil per halaman
 *     ($top + $skip) sampai habis.
 *   - Error sebelumnya hanya ke console, di layar tampil "Tidak ada data".
 *     Sekarang pesan error & peringatan tampil di halaman.
 *
 * Laporan ini SNAPSHOT stok SAAT INI (bukan per periode tanggal).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PageHeader } from "@/shared/components";
import { idempiereApi } from "@/api/idempiereApi";
import { renderPivotListPDF } from "@/utils/pdf/renderPivotListPDF"; // duplikasi khusus laporan grouped/pivot — renderListPDF asli tidak diubah karena dipakai di banyak laporan lain
import { useOrgInfo } from "@/shared/hooks/useOrgInfo";
import * as XLSX from "xlsx"; // npm install xlsx (kalau belum ada di project)
import "@/App.css";

const PAGE_SIZE = 500;     // ukuran permintaan per halaman
const MAX_PAGES = 100;     // pengaman loop (maks 50.000 record per query)

// Ambil SEMUA record dari sebuah query REST dengan paging $top/$skip.
// Berhenti saat halaman kosong atau (kalau server mengirim `row-count`)
// jumlah record terambil sudah mencapai total. Tidak bergantung pada
// "records.length < pageSize" karena server bisa membatasi ukuran halaman
// lebih kecil dari yang diminta.
const fetchAllPages = async (path) => {
    const all = [];
    let skip = 0;
    for (let i = 0; i < MAX_PAGES; i++) {
        const sep = path.includes("?") ? "&" : "?";
        const res = await idempiereApi(`${path}${sep}$top=${PAGE_SIZE}&$skip=${skip}`);
        const recs = Array.isArray(res?.records) ? res.records : [];
        if (recs.length === 0) break;
        all.push(...recs);
        skip += recs.length;
        const total = res["row-count"];
        if (typeof total === "number" && skip >= total) break;
    }
    return all;
};

// Coba beberapa query berurutan; kembalikan hasil pertama yang berhasil.
// Kalau semua gagal, lempar error terakhir.
const fetchWithFallback = async (attempts) => {
    let lastErr = null;
    for (const attempt of attempts) {
        try {
            const records = await fetchAllPages(attempt.path);
            return { records, source: attempt.source };
        } catch (err) {
            console.warn(`Query ${attempt.source} gagal:`, err.message);
            lastErr = err;
        }
    }
    throw lastErr || new Error("Semua percobaan query gagal.");
};

const StorageStockReport = () => {
    const { orgInfo } = useOrgInfo();

    const [stockRows, setStockRows] = useState([]); // hasil join semua gudang, BELUM difilter gudang
    const [loading, setLoading] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);       // error fatal (laporan gagal dimuat)
    const [warningMsg, setWarningMsg] = useState(null);   // peringatan (mis. Reserved tidak terbaca)

    // ─── Multi-select filter gudang ─────────────────────────────────────────
    const [warehouseOptions, setWarehouseOptions] = useState([]);
    const [selectedWarehouseIds, setSelectedWarehouseIds] = useState([]); // array of number
    const [warehouseSearch, setWarehouseSearch] = useState("");
    const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
    const warehouseDropdownRef = useRef(null);

    // Pencarian produk (teks, client-side)
    const [productSearchText, setProductSearchText] = useState("");

    // Tutup dropdown multi-select kalau klik di luar area-nya
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(e.target)) {
                setIsWarehouseDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ─── FETCH: seluruh data stok (gudang → locator → OnHand & Reserved) ───
    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        setWarningMsg(null);
        try {
            // Langkah 1: daftar gudang aktif
            const warehouses = await fetchAllPages(
                `/models/m_warehouse?$filter=IsActive eq true&$select=Value,Name&$orderby=Name`
            );
            setWarehouseOptions(warehouses);

            if (warehouses.length === 0) {
                setStockRows([]);
                setWarningMsg("Tidak ada gudang aktif yang dapat diakses oleh role ini.");
                return;
            }

            const warehouseNameMap = new Map();
            warehouses.forEach((w) => {
                const wid = w.id ?? w.M_Warehouse_ID;
                warehouseNameMap.set(wid, w.Name || `#${wid}`);
            });

            // Langkah 2: semua locator → map locatorId -> warehouseId
            const locators = await fetchAllPages(
                `/models/m_locator?$filter=IsActive eq true&$select=M_Warehouse_ID`
            );
            const locatorMap = new Map();
            locators.forEach((loc) => {
                const locId = loc.id ?? loc.M_Locator_ID;
                const whId = loc.M_Warehouse_ID?.id ?? loc.M_Warehouse_ID;
                if (locId != null && whId != null) locatorMap.set(locId, whId);
            });

            // Langkah 3a: QtyOnHand per produk per locator (hanya yang ≠ 0)
            const onHand = await fetchWithFallback([
                {
                    source: "m_storageonhand",
                    path: `/models/m_storageonhand?$filter=QtyOnHand ne 0&$select=M_Product_ID,M_Locator_ID,QtyOnHand`,
                },
                {
                    source: "m_storage",
                    path: `/models/m_storage?$filter=QtyOnHand ne 0&$select=M_Product_ID,M_Locator_ID,QtyOnHand`,
                },
            ]);

            // Langkah 3b: Reserved (SO). Kegagalan di sini TIDAK menggagalkan laporan.
            let reservedByWarehouse = []; // [{ rec, whId, qty }]
            try {
                const reserved = await fetchWithFallback([
                    {
                        // Per GUDANG (tidak punya M_Locator_ID)
                        source: "m_storagereservation",
                        path: `/models/m_storagereservation?$filter=IsSOTrx eq true and Qty ne 0&$select=M_Product_ID,M_Warehouse_ID,Qty`,
                    },
                    {
                        // View kompatibilitas, per LOCATOR
                        source: "m_storage",
                        path: `/models/m_storage?$filter=QtyReserved ne 0&$select=M_Product_ID,M_Locator_ID,QtyReserved`,
                    },
                ]);
                reservedByWarehouse = reserved.records
                    .map((rec) => {
                        const whId =
                            reserved.source === "m_storagereservation"
                                ? rec.M_Warehouse_ID?.id ?? rec.M_Warehouse_ID
                                : locatorMap.get(rec.M_Locator_ID?.id ?? rec.M_Locator_ID);
                        const qty = parseFloat(
                            reserved.source === "m_storagereservation" ? rec.Qty : rec.QtyReserved
                        ) || 0;
                        return { rec, whId, qty };
                    });
            } catch (err) {
                console.error("Gagal mengambil data Reserved:", err.message);
                setWarningMsg(
                    `Data Reserved tidak dapat dibaca (${err.message}). Kolom Reserved ditampilkan 0, ` +
                    `jadi Available = On Hand. Cek akses role ke tabel M_StorageReservation.`
                );
            }

            // Langkah 4: join jadi baris stok, digabung per (produk × gudang)
            // Kunci gabungan: `${productId}|${warehouseId}` — satu produk bisa
            // punya beberapa locator di gudang yang sama, jadi dijumlah dulu.
            const cellMap = new Map();
            const ensureCell = (productId, productName, warehouseId) => {
                const key = `${productId}|${warehouseId}`;
                if (!cellMap.has(key)) {
                    cellMap.set(key, {
                        productId,
                        productName,
                        warehouseId,
                        warehouseName: warehouseNameMap.get(warehouseId) || `#${warehouseId}`,
                        onHand: 0,
                        reserved: 0,
                    });
                }
                return cellMap.get(key);
            };

            onHand.records.forEach((rec) => {
                const productId = rec.M_Product_ID?.id ?? rec.M_Product_ID;
                const productName = rec.M_Product_ID?.identifier || rec.M_Product_ID?.Name || "-";
                const locId = rec.M_Locator_ID?.id ?? rec.M_Locator_ID;
                const whId = locatorMap.get(locId);
                if (productId == null || whId == null) return; // locator di luar gudang aktif
                ensureCell(productId, productName, whId).onHand += parseFloat(rec.QtyOnHand || 0);
            });

            reservedByWarehouse.forEach(({ rec, whId, qty }) => {
                const productId = rec.M_Product_ID?.id ?? rec.M_Product_ID;
                const productName = rec.M_Product_ID?.identifier || rec.M_Product_ID?.Name || "-";
                if (productId == null || whId == null || !warehouseNameMap.has(whId)) return;
                ensureCell(productId, productName, whId).reserved += qty;
            });

            const rows = Array.from(cellMap.values()).map((c) => ({
                ...c,
                available: c.onHand - c.reserved,
            }));

            setStockRows(rows);
        } catch (err) {
            console.error("Gagal mengambil data stok:", err.message);
            setStockRows([]);
            setErrorMsg(err.message || "Gagal mengambil data stok.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    // ─── Filter gudang (multi-select) + pencarian produk (client-side) ─────
    const filteredRows = useMemo(() => {
        let rows = stockRows;
        if (selectedWarehouseIds.length > 0) {
            rows = rows.filter((r) => selectedWarehouseIds.includes(r.warehouseId));
        }
        if (productSearchText.trim()) {
            const q = productSearchText.trim().toLowerCase();
            rows = rows.filter((r) => (r.productName || "").toLowerCase().includes(q));
        }
        return rows;
    }, [stockRows, selectedWarehouseIds, productSearchText]);

    // ─── Pivot per gudang: tiap gudang bawa daftar produk + subtotal sendiri.
    const groupedByWarehouse = useMemo(() => {
        const map = new Map();
        filteredRows.forEach((r) => {
            if (!map.has(r.warehouseId)) {
                map.set(r.warehouseId, {
                    warehouseId: r.warehouseId,
                    warehouseName: r.warehouseName,
                    totalOnHand: 0,
                    totalReserved: 0,
                    totalAvailable: 0,
                    rows: [],
                });
            }
            const group = map.get(r.warehouseId);
            group.totalOnHand += r.onHand;
            group.totalReserved += r.reserved;
            group.totalAvailable += r.available;
            group.rows.push(r);
        });
        // produk di tiap gudang diurutkan alfabetis supaya mudah dibaca
        const groups = Array.from(map.values());
        groups.forEach((g) => g.rows.sort((a, b) => a.productName.localeCompare(b.productName)));
        groups.sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
        return groups;
    }, [filteredRows]);

    const grandTotal = useMemo(
        () =>
            filteredRows.reduce(
                (acc, r) => ({
                    onHand: acc.onHand + r.onHand,
                    reserved: acc.reserved + r.reserved,
                    available: acc.available + r.available,
                }),
                { onHand: 0, reserved: 0, available: 0 }
            ),
        [filteredRows]
    );

    // ─── Handler multi-select gudang ────────────────────────────────────────
    const getWarehouseId = (w) => w.id ?? w.M_Warehouse_ID;
    const toggleWarehouse = (warehouseId) => {
        setSelectedWarehouseIds((prev) =>
            prev.includes(warehouseId) ? prev.filter((id) => id !== warehouseId) : [...prev, warehouseId]
        );
    };
    const clearWarehouseFilter = () => setSelectedWarehouseIds([]);

    const filteredWarehouseOptions = warehouseOptions.filter((w) =>
        !warehouseSearch || (w.Name || "").toLowerCase().includes(warehouseSearch.toLowerCase())
    );

    const warehouseFilterLabel =
        selectedWarehouseIds.length === 0
            ? "Semua Gudang"
            : `${selectedWarehouseIds.length} gudang dipilih`;

    const nowStr = new Date().toLocaleString("id-ID");

    // ─── Print PDF (pivot per gudang, pola sama dengan laporan Sales Order) ─
    const handlePrintDetail = async () => {
        if (groupedByWarehouse.length === 0) {
            alert("Tidak ada data untuk dicetak.");
            return;
        }
        setPrinting(true);
        try {
            const rows = [];
            let no = 0;
            groupedByWarehouse.forEach((group) => {
                rows.push({
                    no: "",
                    productName: `${group.warehouseName}  (OnHand: ${group.totalOnHand.toLocaleString("id-ID")} | Reserved: ${group.totalReserved.toLocaleString("id-ID")} | Available: ${group.totalAvailable.toLocaleString("id-ID")})`,
                    onHand: "",
                    reserved: "",
                    available: "",
                    _isGroupHeader: true,
                });
                group.rows.forEach((r) => {
                    no += 1;
                    rows.push({
                        no,
                        productName: r.productName,
                        onHand: r.onHand.toLocaleString("id-ID"),
                        reserved: r.reserved.toLocaleString("id-ID"),
                        available: r.available.toLocaleString("id-ID"),
                    });
                });
            });

            await renderPivotListPDF({
                title: "LAPORAN INVENTORY / KETERSEDIAAN STOK",
                logoDataUrl: orgInfo?.logoUrl,
                orgName: orgInfo?.name,
                orgPhone: orgInfo?.phone,
                orgEmail: orgInfo?.email,
                periodLabel: `PER ${nowStr}`,
                columns: [
                    { key: "no", label: "No", width: 25, align: "center" },
                    { key: "productName", label: "Produk / Gudang", width: 205 },
                    { key: "onHand", label: "On Hand", width: 60, align: "right" },
                    { key: "reserved", label: "Reserved", width: 60, align: "right" },
                    { key: "available", label: "Available", width: 60, align: "right" },
                ],
                rows,
                totalLabel: "Grand Total (Available)",
                totalValue: grandTotal.available.toLocaleString("id-ID"),
                filenamePrefix: `INVENTORY-STOCK-${new Date().toISOString().split("T")[0]}`,
            });
        } catch (err) {
            console.error("Gagal generate PDF:", err.message);
            alert("Gagal membuat PDF laporan.");
        } finally {
            setPrinting(false);
        }
    };

    // ─── Export Excel (pivot per gudang, disusun manual sebagai AOA — bukan
    // json_to_sheet — supaya baris ringkasan tiap gudang bisa disisipkan
    // bebas di antara baris detail, persis pola grouping yang sama dengan
    // tampilan di layar & PDF di atas. ───────────────────────────────────────
    const handleExportExcel = () => {
        if (groupedByWarehouse.length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }
        setExportingExcel(true);
        try {
            const aoa = [
                ["LAPORAN INVENTORY / KETERSEDIAAN STOK"],
                [`Per: ${nowStr}`],
                [],
                ["No", "Produk", "On Hand", "Reserved", "Available"],
            ];

            let no = 0;
            groupedByWarehouse.forEach((group) => {
                aoa.push([
                    `📦 ${group.warehouseName}`,
                    "",
                    group.totalOnHand,
                    group.totalReserved,
                    group.totalAvailable,
                ]);
                group.rows.forEach((r) => {
                    no += 1;
                    aoa.push([no, r.productName, r.onHand, r.reserved, r.available]);
                });
            });

            aoa.push([]);
            aoa.push(["", "", "Grand Total OnHand", grandTotal.onHand, ""]);
            aoa.push(["", "", "Grand Total Reserved", grandTotal.reserved, ""]);
            aoa.push(["", "", "Grand Total Available", grandTotal.available, ""]);

            const worksheet = XLSX.utils.aoa_to_sheet(aoa);
            worksheet["!cols"] = [
                { wch: 6 },  // No
                { wch: 40 }, // Produk
                { wch: 14 }, // On Hand
                { wch: 14 }, // Reserved
                { wch: 14 }, // Available
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Stok per Gudang");
            XLSX.writeFile(workbook, `INVENTORY-STOCK-${new Date().toISOString().split("T")[0]}.xlsx`);
        } catch (err) {
            console.error("Gagal export Excel:", err.message);
            alert("Gagal membuat file Excel.");
        } finally {
            setExportingExcel(false);
        }
    };

    return (
        <div className="card-container">
            <PageHeader
                title="📦 Laporan Inventory (Ketersediaan Stok)"
                extraAction={
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={handleExportExcel} disabled={exportingExcel} style={styles.excelBtn}>
                            {exportingExcel ? "⏳ ..." : "📥 Download Excel"}
                        </button>
                        <button onClick={handlePrintDetail} disabled={printing} style={styles.printBtn}>
                            {printing ? "⏳ ..." : "🖨️ Print PDF"}
                        </button>
                    </div>
                }
            />

            {/* ─── Filter bar ─────────────────────────────────────────────── */}
            <div style={styles.filterRow}>
                {/* Multi-select gudang — dropdown custom + checkbox */}
                <div style={{ position: "relative" }} ref={warehouseDropdownRef}>
                    <label style={styles.fieldLabel}>Filter Gudang</label>
                    <button
                        type="button"
                        onClick={() => setIsWarehouseDropdownOpen((v) => !v)}
                        style={styles.warehouseDropdownBtn}
                    >
                        {warehouseFilterLabel} ▾
                    </button>

                    {isWarehouseDropdownOpen && (
                        <div style={styles.warehouseDropdownPanel}>
                            <input
                                type="text"
                                placeholder="Cari gudang..."
                                value={warehouseSearch}
                                onChange={(e) => setWarehouseSearch(e.target.value)}
                                style={styles.warehouseSearchInput}
                            />
                            <div style={styles.warehouseOptionList}>
                                {filteredWarehouseOptions.length === 0 && (
                                    <div style={{ padding: "8px", color: "#888" }}>Tidak ada gudang.</div>
                                )}
                                {filteredWarehouseOptions.map((w) => {
                                    const wid = getWarehouseId(w);
                                    return (
                                        <label key={wid} style={styles.warehouseOptionRow}>
                                            <input
                                                type="checkbox"
                                                checked={selectedWarehouseIds.includes(wid)}
                                                onChange={() => toggleWarehouse(wid)}
                                            />
                                            {w.Name}
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedWarehouseIds.length > 0 && (
                                <button type="button" onClick={clearWarehouseFilter} style={styles.clearFilterBtn}>
                                    Hapus semua pilihan
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Pencarian produk — teks bebas, filter client-side */}
                <div style={styles.dateField}>
                    <label style={styles.fieldLabel}>Cari Produk</label>
                    <input
                        type="text"
                        placeholder="Ketik nama produk..."
                        value={productSearchText}
                        onChange={(e) => setProductSearchText(e.target.value)}
                        style={styles.textInput}
                    />
                </div>

                <div style={styles.dateField}>
                    <label style={styles.fieldLabel}>&nbsp;</label>
                    <button onClick={fetchReportData} disabled={loading} style={styles.refreshBtn}>
                        {loading ? "⏳ Memuat..." : "🔄 Refresh"}
                    </button>
                </div>
            </div>

            {/* ─── Pesan error / peringatan ───────────────────────────────── */}
            {errorMsg && (
                <div style={styles.errorBox}>
                    ❌ <strong>Gagal memuat laporan:</strong> {errorMsg}
                </div>
            )}
            {warningMsg && !errorMsg && (
                <div style={styles.warningBox}>⚠ {warningMsg}</div>
            )}

            {/* ─── Ketersediaan Stok per Gudang — ala pivot ───────────────── */}
            <div className="detail-section">
                <h3>Ketersediaan Stok per Gudang</h3>
                {loading ? (
                    <p>Memuat data...</p>
                ) : errorMsg ? null : groupedByWarehouse.length === 0 ? (
                    <p style={{ color: "#777" }}>Tidak ada data untuk filter ini.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Produk</th>
                                    <th style={{ textAlign: "right" }}>On Hand</th>
                                    <th style={{ textAlign: "right" }}>Reserved</th>
                                    <th style={{ textAlign: "right" }}>Available</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedByWarehouse.map((group) => (
                                    <React.Fragment key={group.warehouseId ?? group.warehouseName}>
                                        <tr style={styles.groupHeaderRow}>
                                            <td colSpan={4}>
                                                <div style={styles.groupHeaderContent}>
                                                    <span style={styles.groupHeaderName}>🏭 {group.warehouseName}</span>
                                                    <span style={styles.groupHeaderStats}>
                                                        OnHand: <strong>{group.totalOnHand.toLocaleString("id-ID")}</strong>
                                                        &nbsp;&nbsp;|&nbsp;&nbsp;
                                                        Reserved: <strong>{group.totalReserved.toLocaleString("id-ID")}</strong>
                                                        &nbsp;&nbsp;|&nbsp;&nbsp;
                                                        Available: <strong>{group.totalAvailable.toLocaleString("id-ID")}</strong>
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {group.rows.map((r) => (
                                            <tr key={`${r.productId}-${r.warehouseId}`}>
                                                <td>{r.productName}</td>
                                                <td style={{ textAlign: "right" }}>{r.onHand.toLocaleString("id-ID")}</td>
                                                <td style={{ textAlign: "right" }}>{r.reserved.toLocaleString("id-ID")}</td>
                                                <td
                                                    style={{
                                                        textAlign: "right",
                                                        fontWeight: r.available <= 0 ? "bold" : "normal",
                                                        color: r.available <= 0 ? "#c62828" : "inherit",
                                                    }}
                                                >
                                                    {r.available.toLocaleString("id-ID")}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={{ fontWeight: "bold" }}>Grand Total</td>
                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>{grandTotal.onHand.toLocaleString("id-ID")}</td>
                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>{grandTotal.reserved.toLocaleString("id-ID")}</td>
                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>{grandTotal.available.toLocaleString("id-ID")}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
                <p style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
                    On Hand = stok fisik di locator &nbsp;•&nbsp; Reserved = stok yang sudah
                    dialokasikan/dipesan (SO) &nbsp;•&nbsp; Available = On Hand − Reserved
                </p>
            </div>
        </div>
    );
};

const styles = {
    printBtn: { backgroundColor: "#546e7a", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    excelBtn: { backgroundColor: "#1e7e34", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    refreshBtn: { backgroundColor: "#1565c0", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
    filterRow: { display: "flex", gap: "16px", flexWrap: "wrap", margin: "12px 0 20px", alignItems: "flex-end" },
    dateField: { display: "flex", flexDirection: "column", gap: "4px" },
    fieldLabel: { fontSize: "12px", fontWeight: "600", color: "#555" },
    textInput: { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", minWidth: "200px" },
    warehouseDropdownBtn: { padding: "8px 14px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "13px", minWidth: "160px", textAlign: "left" },
    warehouseDropdownPanel: { position: "absolute", top: "100%", left: 0, marginTop: "4px", background: "#fff", border: "1px solid #ddd", borderRadius: "6px", width: "260px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 20, padding: "8px" },
    warehouseSearchInput: { width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "8px", boxSizing: "border-box" },
    warehouseOptionList: { maxHeight: "220px", overflowY: "auto" },
    warehouseOptionRow: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px", cursor: "pointer", fontSize: "13px" },
    clearFilterBtn: { marginTop: "8px", width: "100%", padding: "6px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
    errorBox: { background: "#ffebee", border: "1px solid #ef9a9a", color: "#b71c1c", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px", whiteSpace: "pre-line" },
    warningBox: { background: "#fff8e1", border: "1px solid #ffe082", color: "#8d6e00", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px" },
    // Baris header ringkasan per grup gudang (ala pivot table)
    groupHeaderRow: { backgroundColor: "#eef7ee", borderTop: "2px solid #a5d6a7", borderBottom: "1px solid #a5d6a7" },
    groupHeaderContent: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "8px 4px" },
    groupHeaderName: { fontWeight: "700", color: "#1b5e20", fontSize: "13.5px" },
    groupHeaderStats: { fontSize: "12.5px", color: "#2e7d32" },
};

export default StorageStockReport;
