import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOMServer from "react-dom/server";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { LogoSMAMerahHitam } from "../components/Icons";
import { idempiereApi } from "../utils/idempiereApi";
import "../App.css";

// ─────────────────────────────────────────────────────────────────────────────
// PurchasingList.jsx
// GET /api/v1/models/ad_table?$select=AD_Table_ID&$filter=TableName eq 'C_Order'
// ─────────────────────────────────────────────────────────────────────────────
const C_ORDER_AD_TABLE_ID = 259; // ← GANTI kalau berbeda di instance Anda

const PurchasingList = () => {
    const todayStr = new Date().toISOString().split("T")[0];

    const [orders, setOrders]             = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalAmountAll, setTotalAmountAll] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [startDate, setStartDate]       = useState(todayStr);
    const [endDate, setEndDate]           = useState(todayStr);
    const pageSize                        = 10;
    const navigate                        = useNavigate();

    // const API_BASE    = "/api/v1";
    // const customFetch = async (url, options = {}) => {
    //     const token    = localStorage.getItem("token");
    //     const response = await fetch(`${API_BASE}${url}`, {
    //         ...options,
    //         headers: {
    //             ...options.headers,
    //             Authorization:  `Bearer ${token}`,
    //             "Content-Type": "application/json",
    //         },
    //     });
    //     if (!response.ok) {
    //         const text = await response.text().catch(() => "");
    //         throw new Error(`[${response.status}] ${text}`);
    //     }
    //     return response.json();
    // };

    const getStatusLabel = (status) => {
        const map = { DR: "Draft", IP: "In Progress", CO: "Completed", CL: "Closed", VO: "Voided", RE: "Reversed", NA: "Ditolak" };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = { DR: "#f57c00", CO: "#2e7d32", CL: "#37474f", VO: "#c62828", IP: "#1565c0", NA: "#c62828" };
        return map[status] || "#555";
    };

    // Purchasing bersifat sentral (tidak scoped ke 1 gudang), tapi tetap
    // hanya menampilkan PO yang dibuat oleh user yang sedang login — sama
    // seperti perilaku RequisitionList.jsx untuk FPB.
    const fetchOrders = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setLoading(true);
        try {
            let filterClause =
                ` IsSOTrx eq false` + // sisi pembelian saja (bukan Sales Order)
                ` and CreatedBy eq ${loginUserId}` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            const res = await idempiereApi(
                `/models/c_order` +
                `?$filter=${filterClause}` +
                `&$select=C_Order_ID,DocumentNo,DateOrdered,C_BPartner_ID,GrandTotal,DocStatus,C_DocType_ID,M_Warehouse_ID` +
                `&$orderby=DocumentNo desc` +
                `&$top=${pageSize}` +
                `&$skip=${offset}`
            );

            setOrders(Array.isArray(res.records) ? res.records : []);
            setTotalRecords(res["row-count"] || res.totalRecords || 0);
        } catch (err) {
            console.error("Gagal fetch purchase orders:", err.message);
        } finally {
            setLoading(false);
        }
    }, [offset, search, startDate, endDate]);

    const svgToPngDataUrl = (svgString, width, height) => {
        return new Promise((resolve, reject) => {
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = width * 2;  // 2x untuk hasil lebih tajam di PDF
                canvas.height = height * 2;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = reject;
            img.src = url;
        });
    };

    // Fetch total GrandTotal seluruh halaman (bukan cuma TotalLines seperti
    // di Requisition) — hanya dipicu saat filter berubah, bukan saat ganti halaman.
    const fetchTotalAmount = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setTotalAmountAll(null); // reset saat filter berubah
        try {
            let filterClause =
                ` IsSOTrx eq false` +
                ` and CreatedBy eq ${loginUserId}` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            const res = await idempiereApi(
                `/models/c_order` +
                `?$filter=${filterClause}` +
                `&$select=GrandTotal`
            );

            const records = Array.isArray(res.records) ? res.records : [];
            const total   = records.reduce((sum, r) => sum + parseFloat(r.GrandTotal || 0), 0);
            setTotalAmountAll(total);
        } catch (err) {
            console.error("Gagal fetch total grand total:", err.message);
            setTotalAmountAll(0);
        }
    }, [search, startDate, endDate]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useEffect(() => {
        fetchTotalAmount();
    }, [fetchTotalAmount]);

    const handleEdit = (order) => {
        // Gunakan _raw (data asli sebelum di-overwrite tableData) agar field
        // seperti C_BPartner_ID tetap berupa object {id, identifier}, bukan string.
        const raw = order._raw ?? order;
        let cleanOrder;
        try {
            cleanOrder = JSON.parse(JSON.stringify(raw));
        } catch {
            cleanOrder = raw;
        }
        // ⚠️ PurchasingContainer.jsx saat ini belum mengonsumsi state.editOrder
        // ini (belum ada mode edit draft PO) — navigasi tetap disiapkan di
        // sini supaya UI konsisten dengan RequisitionList.jsx, tapi perlu
        // ditambahkan handling-nya di PurchasingContainer kalau fitur edit
        // draft PO memang dibutuhkan.
        navigate("/purchasing", { state: { editOrder: cleanOrder } });
    };

    const fmtRp = (n) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;

    // Format total seluruh halaman dari state (null = sedang loading)
    const totalAmountFormatted = totalAmountAll === null
        ? "Menghitung..."
        : fmtRp(totalAmountAll);

    const columns = [
        { key: "DocumentNo", label: "No. Dokumen" },
        { key: "DateOrdered", label: "Tanggal" },
        { key: "C_BPartner_ID", label: "Vendor" },
        { key: "GrandTotal", label: "Total", align: "right" },
        { key: "DocStatus", label: "Status", align: "center" },
    ];

    const generateOrderPDF = async (orderId, documentNo, token) => {
        // const API_BASE = "/api/v1";
        // const customFetch = async (url) => {
        //     const res = await fetch(`${API_BASE}${url}`, {
        //         headers: { Authorization: `Bearer ${token}` },
        //     });
        //     return res.json();
        // };

        // 1. Fetch header data
        const header = await idempiereApi(
            `/models/c_order/${orderId}` +
            `?$select=DocumentNo,DateOrdered,Description,DocStatus,AD_Org_ID,CreatedBy,C_BPartner_ID,M_Warehouse_ID,GrandTotal,C_Order_UU`
        );

        // 2. Fetch line items
        const linesRes = await idempiereApi(
            `/models/c_orderline` +
            `?$filter=C_Order_ID eq ${orderId}` +
            `&$select=Line,M_Product_ID,QtyOrdered,C_UOM_ID,PriceActual,LineNetAmt,Description` +
            `&$orderby=Line`
        );
        const lines = linesRes.records || [];

        // 3. Fetch workflow history (AD_Table_ID C_Order)
        const historyRes = await idempiereApi(
            `/models/ad_wf_eventaudit` +
            `?$filter=AD_Table_ID eq ${C_ORDER_AD_TABLE_ID} and Record_ID eq ${orderId}` +
            `&$select=AD_WF_Node_ID,AD_User_ID,Updated` +
            `&$orderby=Updated asc`
        );

        // Filter node "(Start)" di client-side, case-insensitive
        const history = (historyRes.records || []).filter((h) => {
            const nodeName = (h.AD_WF_Node_ID?.identifier || "").toLowerCase();

            return nodeName !== "(start)" &&
                   nodeName !== "(docauto)" &&
                   nodeName !== "(completedocument)";
        });

        // 4. Generate QR code as data URL
        // ⚠️ Endpoint verifikasi PO ini mengasumsikan ada servlet verifikasi
        // serupa VerifyRequisitionServlet (mis. VerifyOrderServlet) yang
        // menerima UUID di path ini. Sesuaikan/bangun endpoint-nya kalau
        // belum ada di sisi backend Anda.
        const qrUrl = `https://192.168.0.126:8432/view/order/${header.uid}`;
        const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 200 });

        // 5. Status label mapping
        const statusMap = { DR: "Draft", IP: "Dalam Proses Approval", CO: "Selesai / Disetujui", CL: "Ditutup", VO: "Dibatalkan", RE: "Ditolak" };
        const statusCode = header.DocStatus?.id ?? header.DocStatus;

        // 6. Logo
        const logoSvgString = ReactDOMServer.renderToStaticMarkup(<LogoSMAMerahHitam />);
        const logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);
        // 7. Build PDF
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.addImage(logoDataUrl, "PNG", 20, 5, 70, 42);
        doc.setFontSize(14).setFont(undefined, "bold");
        doc.text("PURCHASE ORDER (PO)", pageWidth / 2, 30, { align: "center" });
        doc.setFontSize(9).setFont(undefined, "italic");
        doc.text("Dokumen ini sah dengan histori approval terlampir", pageWidth / 2, 44, { align: "center" });
        doc.line(20, 55, pageWidth - 20, 55);

        // Info fields
        doc.setFont(undefined, "normal").setFontSize(9);
        let y = 75;
        const infoLeft = [
            ["No. Dokumen", ": "+header.DocumentNo],
            ["Vendor", ": "+(header.C_BPartner_ID?.identifier || "-")],
            ["Gudang Tujuan", ": "+(header.M_Warehouse_ID?.identifier || "-")],
            ["Keterangan", ": "+(header.Description || "-")],
        ];
        const infoRight = [
            ["Tanggal", ": "+new Date(header.DateOrdered).toLocaleDateString("id-ID")],
            ["Departemen", ": "+(header.AD_Org_ID?.identifier || "-")],
            ["Status", ": "+(statusMap[statusCode] || statusCode)],
            ["Grand Total", ": "+fmtRp(header.GrandTotal)],
        ];
        infoLeft.forEach(([label, val], i) => {
            doc.text(label, 20, y + i * 16);
            doc.text(String(val), 100, y + i * 16);
        });
        infoRight.forEach(([label, val], i) => {
            doc.text(label, 320, y + i * 16);
            doc.text(String(val), 400, y + i * 16);
        });

        // Table item
        autoTable(doc, {
            startY: y + infoLeft.length * 16 + 20,
            head: [["No", "Nama Barang", "Qty", "UOM", "Harga", "Line Amount"]],
            body: lines.map((l, idx) => [
                idx + 1,
                l.M_Product_ID?.identifier || "-",
                l.QtyOrdered,
                l.C_UOM_ID?.identifier || "-",
                fmtRp(l.PriceActual),
                fmtRp(l.LineNetAmt),
            ]),
            theme: "grid",
            styles: { fontSize: 8 },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontStyle: "bold",
            },
            margin: { left: 20, right: 20 },
            tableWidth: pageWidth - 40,
        });

        // Histori Approval - horizontal layout (kiri ke kanan)
        let finalY = doc.lastAutoTable.finalY + 20;
        doc.setFont(undefined, "bold").setFontSize(10);
        doc.text("Histori Approval / Workflow", 20, finalY);
        doc.line(20, finalY + 6, pageWidth - 20, finalY + 6);

        finalY += 20;

        const marginLeft = 20;
        const marginRight = 20;
        const usableWidth = pageWidth - marginLeft - marginRight;
        const colCount = 5;
        const colWidth = usableWidth / colCount;
        const rowHeight = 65;

        history.forEach((h, idx) => {
            const col = idx % colCount;
            const row = Math.floor(idx / colCount);
            const x = marginLeft + col * colWidth;
            const y = finalY + row * rowHeight;

            if (row > 0 && col === 0) {
                doc.setLineDashPattern([2, 2], 0);
                doc.setDrawColor(150, 150, 150);
                doc.line(20, y - 10, pageWidth - 20, y - 10);
                doc.setLineDashPattern([], 0);
                doc.setDrawColor(0, 0, 0);
            }

            const maxTextWidth = colWidth - 5;

            doc.setFont(undefined, "bold").setFontSize(7.5);
            const nodeName = `${h.AD_WF_Node_ID?.identifier || "-"}`;
            const splitNode = doc.splitTextToSize(nodeName, maxTextWidth);
            doc.text(splitNode, x, y);

            const nodeHeightOffset = (splitNode.length - 1) * 9;

            doc.setFont(undefined, "normal").setFontSize(7.5);
            const userName = h.AD_User_ID?.identifier || "-";
            const splitUser = doc.splitTextToSize(userName, maxTextWidth);

            const userY = y + 22 + nodeHeightOffset;
            doc.text(splitUser, x, userY);

            const textWidth = doc.getTextWidth(splitUser[0] || "");
            doc.line(x, userY + 2, x + Math.min(textWidth, maxTextWidth), userY + 2);

            const userHeightOffset = (splitUser.length - 1) * 9;
            doc.text(new Date(h.Updated).toLocaleDateString("id-ID"), x, userY + 15 + userHeightOffset);
        });

        const totalRows = Math.ceil(history.length / colCount);
        finalY += totalRows * rowHeight + 20;

        // QR Code
        finalY += 20;
        doc.setFont(undefined, "bold").setFontSize(9);
        doc.text("Verifikasi Dokumen Digital", pageWidth / 2, finalY, { align: "center" });
        doc.addImage(qrDataUrl, "PNG", pageWidth / 2 - 30, finalY + 10, 60, 60);
        doc.setFont(undefined, "normal").setFontSize(6.5);
        doc.text(
            `Scan untuk verifikasi keaslian & status approval dokumen ${header.DocumentNo}`,
            pageWidth / 2, finalY + 80, { align: "center" }
        );

        // Footer
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont(undefined, "italic").setFontSize(7);
        doc.text(
            `Dokumen ini dicetak otomatis dari sistem dan sah tanpa tanda tangan basah selama status approval di atas terverifikasi pada sistem - dicetak ${new Date().toLocaleDateString("id-ID")}`,
            pageWidth / 2, pageHeight - 20, { align: "center" }
        );

        doc.save(`PO-${documentNo}.pdf`);
    };

    const handleDownload = async (order) => {
        const orderId = order._orderId ?? order.id;
        setDownloadingId(orderId);
        try {
            const token = localStorage.getItem("token");
            await generateOrderPDF(orderId, order.DocumentNo, token);
        } catch (err) {
            console.error("Gagal generate PDF:", err.message);
            alert("Gagal membuat dokumen PDF.");
        } finally {
            setDownloadingId(null);
        }
    };

    const tableData = orders.map((order) => {
        const orderId = order.id ?? order.C_Order_ID;
        const status  = order.DocStatus?.id ?? order.DocStatus ?? "DR";

        return {
            ...order,
            _raw:      order,
            _orderId:  orderId,
            _status:   status,
            DocumentNo: order.DocumentNo || `#${orderId}`,
            DateOrdered: order.DateOrdered
                ? new Date(order.DateOrdered).toLocaleDateString("id-ID")
                : "-",
            "C_BPartner_ID": order.C_BPartner_ID?.identifier
                || order.C_BPartner_ID?.Name
                || "-",
            GrandTotal: fmtRp(order.GrandTotal),
            DocStatus: (
                <span style={{
                    ...styles.badge,
                    backgroundColor: getStatusColor(status),
                }}>
                    {getStatusLabel(status)}
                </span>
            ),
        };
    });

    const actionRenderer = (item) => {
        const isEditDisabled = !["DR", "NA"].includes(item._status);
        const editTitle = item._status === "NA"
            ? "Revisi & ajukan ulang untuk approval"
            : "Edit Dokumen";
        const isDownloading = downloadingId === item._orderId;
        const isDownloadDisabled = item._status !== "CO" || isDownloading; // ⬅️ hanya aktif saat Completed

        return (
            <div style={{ display: "flex", gap: "6px" }}>
                <button
                    onClick={() => !isEditDisabled ? handleEdit(item) : null}
                    disabled={isEditDisabled}
                    style={{
                        ...styles.editBtn,
                        backgroundColor: !isEditDisabled ? (item._status === "NA" ? "#c62828" : "#f57c00") : "#ccc",
                        cursor:          !isEditDisabled ? "pointer"  : "not-allowed",
                        opacity:         !isEditDisabled ? 1          : 0.6,
                    }}
                    title={isEditDisabled ? `Status ${getStatusLabel(item._status)} tidak dapat diubah` : editTitle}
                >
                    {item._status === "NA" ? "🔁 Revisi" : "✏️ Edit"}
                </button>

                <button
                    onClick={() => !isDownloadDisabled ? handleDownload(item) : null}
                    disabled={isDownloadDisabled}
                    style={{
                        ...styles.editBtn,
                        backgroundColor: isDownloadDisabled ? "#ccc" : "#546e7a",
                        cursor:          isDownloadDisabled ? "not-allowed" : "pointer",
                        opacity:         isDownloadDisabled ? 0.6 : 1,
                    }}
                    title={
                        item._status !== "CO"
                            ? `Download hanya tersedia untuk dokumen dengan status Completed`
                            : "Download Dokumen"
                    }
                >
                    {isDownloading ? "⏳ ..." : "⬇️ Download"}
                </button>
            </div>
        );
    };

    const handleStartDateChange = (val) => {
        setStartDate(val);
        setOffset(0);
    };

    const handleEndDateChange = (val) => {
        setEndDate(val);
        setOffset(0);
    };

    return (
        <div className="card-container">

            <PageHeader
                title="Purchasing"
                onSearch={(val) => { setSearch(val); setOffset(0); }}
                extraAction={
                    <button
                        onClick={() => navigate("/purchasing")}
                        style={styles.newBtn}
                    >
                        + Transaksi Baru
                    </button>
                }
            />

            <div style={styles.dateFilterRow}>
                <div style={styles.dateField}>
                    <label style={styles.dateLabel}>Dari Tanggal</label>
                    <input
                        type="date"
                        value={startDate}
                        max={endDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        style={styles.dateInput}
                    />
                </div>
                <div style={styles.dateField}>
                    <label style={styles.dateLabel}>Sampai Tanggal</label>
                    <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        style={styles.dateInput}
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={tableData}
                loading={loading}
                offset={offset}
                pageSize={pageSize}
                totalRecords={totalRecords}
                onPageChange={(newOffset) => setOffset(newOffset)}
                renderActions={actionRenderer}
                summaryRow={{ columnKey: "GrandTotal", value: totalAmountFormatted, label: "Total Semua" }}
            />
        </div>
    );
};

const styles = {
    newBtn:  { backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    badge:   { color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
    editBtn: { color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", transition: "all 0.2s ease" },
    dateFilterRow: { display: "flex", gap: "16px", flexWrap: "wrap", margin: "12px 0 16px" },
    dateField:     { display: "flex", flexDirection: "column", gap: "4px" },
    dateLabel:     { fontSize: "12px", fontWeight: "600", color: "#555" },
    dateInput:      { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" },
};

export default PurchasingList;
