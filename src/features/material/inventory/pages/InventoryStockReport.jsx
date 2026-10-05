/**
 * InventoryStockReport — Laporan Inventory / Ketersediaan Stok
 * ─────────────────────────────────────────────────────────────────────────
 * Menampilkan stok tersedia per produk di tiap gudang (warehouse),
 * berbasis M_StorageOnHand (QtyOnHand) dan M_StorageReservation
 * (QtyReserved). Available = OnHand - Reserved.
 *
 * ALUR FETCH (penting untuk dipahami kalau mau modifikasi):
 *   1) Ambil daftar gudang aktif (M_Warehouse) untuk opsi multi-select
 *      filter gudang + dipakai sebagai pengelompok pivot.
 *   2) Ambil semua M_Locator, lalu buat map locatorId -> warehouseId.
 *      M_StorageOnHand tidak langsung punya kolom M_Warehouse_ID, jadi
 *      harus lewat locator dulu (inilah "join"-nya, dilakukan di JS).
 *   3) Ambil M_StorageOnHand (QtyOnHand per produk per locator) dan
 *      M_StorageReservation (QtyReserved) — masing-masing bisa satu query
 *      saja karena tidak ada filter OR panjang seperti laporan Sales Order.
 *   4) Gabungkan (join di JS) jadi baris stok siap tampil:
 *      { product, warehouse, onHand, reserved, available }.
 *   5) Filter multi-select gudang diterapkan DI SISI CLIENT terhadap hasil
 *      langkah 4 — bukan query ulang ke server.
 *   6) Pivot per gudang (subtotal OnHand/Reserved/Available tiap gudang +
 *      Grand Total) dihitung dari baris yang SUDAH difilter, via useMemo.
 *
 * ⚠️ ASUMSI yang perlu kamu cek/sesuaikan:
 *   - Path import "@/features/inventory/report/..." untuk file ini sendiri —
 *     sesuaikan dengan struktur folder project-mu.
 *   - $top=5000 untuk M_StorageOnHand/Reservation. Kalau stok produk×lokasi
 *     di instance-mu lebih banyak, naikkan angkanya atau tambahkan chunking
 *     seperti pola CHUNK_SIZE di SalesOrderDetailReport.
 *   - Kolom lookup (M_Product_ID, M_Locator_ID, M_Warehouse_ID) diasumsikan
 *     otomatis berisi { id, identifier } dari bxservice — sama seperti
 *     C_BPartner_ID di laporan Sales Order.
 *   - Laporan ini SNAPSHOT stok SAAT INI (bukan per periode tanggal).
 *     iDempiere tidak menyimpan histori OnHand per tanggal lewat REST
 *     standar, jadi filter tanggal sengaja TIDAK disediakan.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PageHeader } from "@/shared/components";
import { idempiereApi } from "@/api/idempiereApi";
import { renderPivotListPDF } from "@/utils/pdf/renderPivotListPDF"; // duplikasi khusus laporan grouped/pivot — renderListPDF asli tidak diubah karena dipakai di banyak laporan lain
import { useOrgInfo } from "@/shared/hooks/useOrgInfo";
import * as XLSX from "xlsx"; // npm install xlsx (kalau belum ada di project)
import "@/App.css";

const StorageStockReport = () => {
    const { orgInfo } = useOrgInfo();

    const [stockRows, setStockRows] = useState([]); // hasil join semua gudang, BELUM difilter gudang
    const [loading, setLoading] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);

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
        try {
            // Langkah 1: daftar gudang aktif
            const whRes = await idempiereApi(
                `/models/m_warehouse?$filter=IsActive eq true&$select=Value,Name&$orderby=Name&$top=200`
            );
            const warehouses = Array.isArray(whRes.records) ? whRes.records : [];
            setWarehouseOptions(warehouses);

            if (warehouses.length === 0) {
                setStockRows([]);
                return;
            }

            const warehouseNameMap = new Map();
            warehouses.forEach((w) => {
                warehouseNameMap.set(w.id ?? w.M_Warehouse_ID, w.Name || `#${w.id}`);
            });

            // Langkah 2: semua locator → map locatorId -> warehouseId
            const locRes = await idempiereApi(
                `/models/m_locator?$filter=IsActive eq true&$select=M_Warehouse_ID&$top=2000`
            );
            const locatorMap = new Map();
            (Array.isArray(locRes.records) ? locRes.records : []).forEach((loc) => {
                const locId = loc.id ?? loc.M_Locator_ID;
                const whId = loc.M_Warehouse_ID?.id ?? loc.M_Warehouse_ID;
                if (locId != null && whId != null) locatorMap.set(locId, whId);
            });

            // Langkah 3a: QtyOnHand per produk per locator
            const onHandRes = await idempiereApi(
                `/models/m_storage?$select=M_Product_ID,M_Locator_ID,QtyOnHand&$top=5000`
            );
            const onHandRecords = Array.isArray(onHandRes.records) ? onHandRes.records : [];

            // Langkah 3b: QtyReserved per produk per locator (reservasi SO/draft)
            const reservedRes = await idempiereApi(
                `/models/m_storage?$select=M_Product_ID,M_Locator_ID,Qty&$top=5000`
            );
            const reservedRecords = Array.isArray(reservedRes.records) ? reservedRes.records : [];

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

            onHandRecords.forEach((rec) => {
                const productId = rec.M_Product_ID?.id ?? rec.M_Product_ID;
                const productName = rec.M_Product_ID?.identifier || rec.M_Product_ID?.Name || "-";
                const locId = rec.M_Locator_ID?.id ?? rec.M_Locator_ID;
                const whId = locatorMap.get(locId);
                if (productId == null || whId == null) return; // locator di luar gudang aktif
                ensureCell(productId, productName, whId).onHand += parseFloat(rec.QtyOnHand || 0);
            });

            reservedRecords.forEach((rec) => {
                const productId = rec.M_Product_ID?.id ?? rec.M_Product_ID;
                const productName = rec.M_Product_ID?.identifier || rec.M_Product_ID?.Name || "-";
                const locId = rec.M_Locator_ID?.id ?? rec.M_Locator_ID;
                const whId = locatorMap.get(locId);
                if (productId == null || whId == null) return;
                ensureCell(productId, productName, whId).reserved += parseFloat(rec.Qty || 0);
            });

            const rows = Array.from(cellMap.values()).map((c) => ({
                ...c,
                available: c.onHand - c.reserved,
            }));

            setStockRows(rows);
        } catch (err) {
            console.error("Gagal mengambil data stok:", err.message);
            setStockRows([]);
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
    // Sama persis dengan pola groupedByProduct di SalesOrderDetailReport,
    // hanya "produk" diganti "gudang" sebagai grup pivot-nya.
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
                {/* Multi-select gudang — dropdown custom + checkbox, pola sama
                    persis dengan filter produk di SalesOrderDetailReport. */}
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

            {/* ─── Ketersediaan Stok per Gudang — ala pivot: dikelompokkan per
                Gudang, tiap grup punya baris header ringkasan (OnHand,
                Reserved, Available) sendiri. Pola sama dengan tabel pivot
                per produk di SalesOrderDetailReport. ─────────────────────── */}
            <div className="detail-section">
                <h3>Ketersediaan Stok per Gudang</h3>
                {loading ? (
                    <p>Memuat data...</p>
                ) : groupedByWarehouse.length === 0 ? (
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
                                        {/* Baris header ringkasan gudang — sticky secara visual lewat
                                            warna latar & border, bukan CSS sticky posisi (tabel ini
                                            tidak pakai scroll container tetap). */}
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
    // Baris header ringkasan per grup gudang (ala pivot table)
    groupHeaderRow: { backgroundColor: "#eef7ee", borderTop: "2px solid #a5d6a7", borderBottom: "1px solid #a5d6a7" },
    groupHeaderContent: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "8px 4px" },
    groupHeaderName: { fontWeight: "700", color: "#1b5e20", fontSize: "13.5px" },
    groupHeaderStats: { fontSize: "12.5px", color: "#2e7d32" },
};

export default StorageStockReport;
