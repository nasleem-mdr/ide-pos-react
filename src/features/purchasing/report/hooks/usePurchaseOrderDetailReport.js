// src/features/purchasing/report/hooks/usePurchaseOrderDetailReport.js
// Seluruh query/fetch data + state filter + hasil olahan (pivot) Laporan Detail Purchase Order.
// UI (pages/PurchaseOrderDetailReport.jsx) hanya memakai return value hook ini.
//
// ALUR FETCH:
//   0) M_Product aktif → opsi filter multi-select produk (sekali saat halaman dibuka).
//   1) Header C_Order (IsSOTrx = false) dalam rentang tanggal.
//      C_BPartner_ID sudah berisi { id, identifier } dari bxservice, jadi
//      nama vendor langsung dipakai tanpa fetch tambahan.
//   2) C_OrderLine milik order-order tsb, di-CHUNK per 40 ID lewat filter
//      "C_Order_ID eq X or C_Order_ID eq Y ..." (bxservice tidak punya join
//      Order → OrderLine yang praktis). Tiap chunk dipaging ($top/$skip).
//   3) Join di JS jadi baris detail { order, vendor, produk, qty, harga, total }.
//   4) Filter produk (multi-select) diterapkan di sisi client.
//   5) Pivot per produk + grand total dihitung dari baris yang sudah difilter (useMemo).
import { useState, useEffect, useCallback, useMemo } from "react";
import { idempiereApi } from "@/api/idempiereApi";

const CHUNK_SIZE = 40;  // jumlah C_Order_ID per batch query C_OrderLine
const PAGE_SIZE = 500;  // ukuran permintaan per halaman
const MAX_PAGES = 100;  // pengaman loop (maks 50.000 record per query)

// Ambil SEMUA record dari sebuah query REST dengan paging $top/$skip.
// Berhenti saat halaman kosong atau jumlah terambil >= `row-count` dari server.
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

export const getProductId = (p) => p.id ?? p.M_Product_ID;

export default function usePurchaseOrderDetailReport() {
    const todayStr = new Date().toISOString().split("T")[0];

    // ── Filter tanggal ──────────────────────────────────────────────────
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);

    // ── Data ────────────────────────────────────────────────────────────
    const [detailRows, setDetailRows] = useState([]); // hasil join Order+OrderLine, BELUM difilter produk
    const [productOptions, setProductOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // ── Filter produk ───────────────────────────────────────────────────
    const [selectedProductIds, setSelectedProductIds] = useState([]); // array of number

    // ── FETCH: opsi produk (sekali) ─────────────────────────────────────
    const fetchProductOptions = useCallback(async () => {
        try {
            const products = await fetchAllPages(
                `/models/m_product?$filter=IsActive eq true&$select=Value,Name&$orderby=Name`
            );
            setProductOptions(products);
        } catch (err) {
            console.error("Gagal mengambil daftar produk:", err.message);
        }
    }, []);

    useEffect(() => {
        fetchProductOptions();
    }, [fetchProductOptions]);

    // ── FETCH: Order header → OrderLine → join ──────────────────────────
    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            // Langkah 1: header PO dalam rentang tanggal
            const orderFilter =
                `IsSOTrx eq false` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;

            const orderRecords = await fetchAllPages(
                `/models/c_order?$filter=${orderFilter}` +
                `&$select=DocumentNo,DateOrdered,C_BPartner_ID,DocStatus`
            );

            if (orderRecords.length === 0) {
                setDetailRows([]);
                return;
            }

            const orderMap = new Map();
            orderRecords.forEach((o) => {
                const oid = o.id ?? o.C_Order_ID;
                orderMap.set(oid, {
                    documentNo: o.DocumentNo || `#${oid}`,
                    dateOrdered: o.DateOrdered,
                    vendorName: o.C_BPartner_ID?.identifier || o.C_BPartner_ID?.Name || "-",
                    docStatus: o.DocStatus?.id ?? o.DocStatus,
                });
            });
            const orderIds = Array.from(orderMap.keys());

            // Langkah 2: C_OrderLine di-chunk per CHUNK_SIZE
            const lineRecords = [];
            for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
                const chunk = orderIds.slice(i, i + CHUNK_SIZE);
                const orClause = chunk.map((oid) => `C_Order_ID eq ${oid}`).join(" or ");
                const lines = await fetchAllPages(
                    `/models/c_orderline?$filter=${orClause}` +
                    `&$select=C_Order_ID,M_Product_ID,QtyOrdered,PriceActual,LineNetAmt`
                );
                lineRecords.push(...lines);
            }

            // Langkah 3: join jadi baris detail siap tampil
            const rows = lineRecords.map((line, idx) => {
                const oid = line.C_Order_ID?.id ?? line.C_Order_ID;
                const orderInfo = orderMap.get(oid) || {};
                const productId = line.M_Product_ID?.id ?? line.M_Product_ID ?? null;
                const productName = line.M_Product_ID?.identifier || line.M_Product_ID?.Name || "-";
                const qty = parseFloat(line.QtyOrdered || 0);
                const price = parseFloat(line.PriceActual || 0);
                // Fallback ke Qty*Price kalau LineNetAmt tidak tersedia
                const lineTotal = line.LineNetAmt != null ? parseFloat(line.LineNetAmt) : qty * price;

                return {
                    key: `${oid}-${idx}`,
                    orderId: oid,
                    documentNo: orderInfo.documentNo || `#${oid}`,
                    dateOrdered: orderInfo.dateOrdered,
                    vendorName: orderInfo.vendorName || "-",
                    docStatus: orderInfo.docStatus,
                    productId,
                    productName,
                    qty,
                    price,
                    lineTotal,
                };
            });

            setDetailRows(rows);
        } catch (err) {
            console.error("Gagal mengambil data laporan:", err.message);
            setDetailRows([]);
            setErrorMsg(err.message || "Gagal mengambil data laporan.");
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    // ── Filter produk (client-side) ─────────────────────────────────────
    const filteredRows = useMemo(() => {
        if (selectedProductIds.length === 0) return detailRows;
        return detailRows.filter((r) => selectedProductIds.includes(r.productId));
    }, [detailRows, selectedProductIds]);

    // ── Pivot per produk: tiap produk bawa subtotal + daftar baris ──────
    const groupedByProduct = useMemo(() => {
        const map = new Map();
        filteredRows.forEach((r) => {
            if (!map.has(r.productId)) {
                map.set(r.productId, {
                    productId: r.productId,
                    productName: r.productName,
                    totalQty: 0,
                    totalAmount: 0,
                    rows: [],
                });
            }
            const group = map.get(r.productId);
            group.totalQty += r.qty;
            group.totalAmount += r.lineTotal;
            group.rows.push(r);
        });
        return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [filteredRows]);

    const grandTotal = useMemo(
        () => filteredRows.reduce((sum, r) => sum + r.lineTotal, 0),
        [filteredRows]
    );

    // ── Handler filter ──────────────────────────────────────────────────
    const toggleProduct = useCallback((productId) => {
        setSelectedProductIds((prev) =>
            prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
        );
    }, []);
    const clearProductFilter = useCallback(() => setSelectedProductIds([]), []);

    return {
        // data & status
        loading, errorMsg, refresh: fetchReportData,
        // hasil olahan
        groupedByProduct, grandTotal,
        // filter
        startDate, setStartDate, endDate, setEndDate,
        productOptions, selectedProductIds, toggleProduct, clearProductFilter,
    };
}
