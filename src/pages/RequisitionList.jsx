import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOMServer from "react-dom/server";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { LogoSMAMerahHitam } from "../components/Icons";
import "../App.css";

const RequisitionList = () => {
    const todayStr = new Date().toISOString().split("T")[0];

    const [requisitions, setRequisitions]             = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalLinesAll, setTotalLinesAll] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [startDate, setStartDate]       = useState(todayStr);
    const [endDate, setEndDate]           = useState(todayStr);
    const pageSize                        = 10;
    const navigate                        = useNavigate();

    const API_BASE    = "/api/v1";
    const customFetch = async (url, options = {}) => {
        const token    = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers: {
                ...options.headers,
                Authorization:  `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`[${response.status}] ${text}`);
        }
        return response.json();
    };

    const getStatusLabel = (status) => {
        const map = { DR: "Draft", IP: "In Progress", CO: "Completed", VO: "Voided", RE: "Reversed", NA: "Ditolak" };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = { DR: "#f57c00", CO: "#2e7d32", VO: "#c62828", IP: "#1565c0", NA: "#c62828" };
        return map[status] || "#555";
    };

    const fetchRequisitions = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setLoading(true);
        try {
            let filterClause =
                ` CreatedBy eq ${loginUserId}` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            const res = await customFetch(
                `/models/m_requisition` +
                `?$filter=${filterClause}` +
                `&$select=M_Requisition_ID,DocumentNo,DateDoc,M_Warehouse_ID,TotalLines,DocStatus,M_PriceList_ID,C_DocType_ID` +
                `&$orderby=DocumentNo desc` +
                `&$top=${pageSize}` +
                `&$skip=${offset}`
            );

            setRequisitions(Array.isArray(res.records) ? res.records : []);
            setTotalRecords(res["row-count"] || res.totalRecords || 0);
        } catch (err) {
            console.error("Gagal fetch requisitions:", err.message);
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
    // Fetch total GrandTotal seluruh halaman — hanya dipicu saat filter berubah (bukan saat ganti halaman)
    const fetchTotalLines = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setTotalLinesAll(null); // reset saat filter berubah
        try {
            let filterClause =
                ` CreatedBy eq ${loginUserId}` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            // Ambil hanya kolom GrandTotal tanpa pagination untuk dijumlahkan
            const res = await customFetch(
                `/models/m_requisition` +
                `?$filter=${filterClause}` +
                `&$select=TotalLines`
            );

            const records = Array.isArray(res.records) ? res.records : [];
            const total   = records.reduce((sum, r) => sum + parseFloat(r.TotalLines || 0), 0);
            setTotalLinesAll(total);
        } catch (err) {
            console.error("Gagal fetch total lines:", err.message);
            setTotalLinesAll(0);
        }
    }, [search, startDate, endDate]); // search + date range

    useEffect(() => {
        fetchRequisitions();
    }, [fetchRequisitions]);

    useEffect(() => {
        fetchTotalLines();
    }, [fetchTotalLines]);

    const handleEdit = (requisition) => {
        // Gunakan _raw (data asli sebelum di-overwrite tableData) agar field
        // seperti M_Warehouse_ID tetap berupa object {id, identifier}, bukan string.
        // Di-bersihkan via JSON round-trip karena history.pushState (dipakai navigate)
        // memerlukan structured-clone-safe object — record API kadang menyertakan
        // referensi/getter yang tidak bisa di-clone langsung.
        const raw = requisition._raw ?? requisition;
        let cleanRequisition;
        try {
            cleanRequisition = JSON.parse(JSON.stringify(raw));
        } catch {
            cleanRequisition = raw;
        }
        navigate("/requisition", { state: { editRequisition: cleanRequisition } });
    };

    // Format total seluruh halaman dari state (null = sedang loading)
    const totalLinesFormatted = totalLinesAll === null
        ? "Menghitung..."
        : ` ${totalLinesAll.toLocaleString("id-ID")}`;

    const columns = [
        { key: "DocumentNo",    label: "No. Dokumen" },
        { key: "DateDoc",   label: "Tanggal" },
        { key: "M_Warehouse_ID", label: "Gudang" },
        //{ key: "TotalLines",    label: "Total Lines", align: "right" },
        { key: "DocStatus",     label: "Status", align: "center" },
    ];
    

    const generateRequisitionPDF = async (requisitionId, documentNo, token) => {
        const API_BASE = "/api/v1";
        const customFetch = async (url) => {
            const res = await fetch(`${API_BASE}${url}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return res.json();
        };
    
        // 1. Fetch header data
        const header = await customFetch(
            `/models/m_requisition/${requisitionId}` +
            `?$select=DocumentNo,DateDoc,Description,DocStatus,AD_Org_ID,CreatedBy,M_Warehouse_ID,M_Requisition_UU`
        );
        
        // 2. Fetch line items
        const linesRes = await customFetch(
            `/models/m_requisitionline` +
            `?$filter=M_Requisition_ID eq ${requisitionId}` +
            `&$select=Line,M_Product_ID,Qty,C_UOM_ID,Description` +
            `&$orderby=Line`
        );
        const lines = linesRes.records || [];
    
        // 3. Fetch workflow history (AD_Table_ID 702 = M_Requisition)
        const historyRes = await customFetch(
            `/models/ad_wf_eventaudit` +
            `?$filter=AD_Table_ID eq 702 and Record_ID eq ${requisitionId}` +
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
        const qrUrl = `https://192.168.0.126:8432/view/requisition/${header.uid}`;
        const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 200 });
    
        // 5. Status label mapping (sama seperti di RequisitionList.jsx)
        const statusMap = { DR: "Draft", IP: "Dalam Proses Approval", CO: "Selesai / Disetujui", CL: "Ditutup", VO: "Dibatalkan", RE: "Ditolak" };
        const statusCode = header.DocStatus?.id ?? header.DocStatus;
    
        // 6. Logo
        const logoSvgString = ReactDOMServer.renderToStaticMarkup(<LogoSMAMerahHitam />);
        const logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);// width, height dalam pt
        // 7. Build PDF
        const doc = new jsPDF({ unit: "pt", format: "a4" }); // 595 x 842 pt, sama seperti jrxml
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Header
        doc.addImage(logoDataUrl, "PNG", 20, 5, 70, 42);
        doc.setFontSize(14).setFont(undefined, "bold");
        doc.text("FORMULIR PERMINTAAN BARANG (FPB)", pageWidth / 2, 30, { align: "center" });
        doc.setFontSize(9).setFont(undefined, "italic");
        doc.text("Purchase Requisition - Dokumen ini sah dengan histori approval terlampir", pageWidth / 2, 44, { align: "center" });
        doc.line(20, 55, pageWidth - 20, 55);
    
        // Info fields
        doc.setFont(undefined, "normal").setFontSize(9);
        let y = 75;
        const infoLeft = [
            ["No. Dokumen", ": "+header.DocumentNo],
            ["Pemohon", ": "+header.CreatedBy?.identifier || "-"],
            ["Gudang Tujuan", ": "+header.M_Warehouse_ID?.identifier || "-"],
            ["Keterangan", ": "+header.Description || "-"],
        ];
        const infoRight = [
            ["Tanggal", ": "+new Date(header.DateDoc).toLocaleDateString("id-ID")],
            ["Departemen", ": "+header.AD_Org_ID?.identifier || "-"],
            ["Status", ": "+statusMap[statusCode] || statusCode],
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
            head: [["No", "Nama Barang", "Qty", "UOM", "Keterangan"]],
            body: lines.map((l, idx) => [
                idx + 1,
                l.M_Product_ID?.identifier || "-",
                l.Qty,
                l.C_UOM_ID?.identifier || "-",
                l.Description || "",
            ]),
            theme: "grid",
            styles: { fontSize: 8 },
            headStyles: {
                fillColor: [0, 0, 0],   //hitam
                textColor: [255, 255, 255], //putih
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
        const rowHeight = 65; // tinggi tiap baris histori

        history.forEach((h, idx) => {
            const col = idx % colCount;
            const row = Math.floor(idx / colCount);
            const x = marginLeft + col * colWidth;
            const y = finalY + row * rowHeight;
        
            // --- TAMBAHAN: Garis Dotted Pembatas Antar Baris ---
            // Jika data sudah masuk ke baris 2, 3, dst (row > 0) dan berada di awal kolom (col === 0)
            if (row > 0 && col === 0) {
                // [jarak_garis, jarak_spasi] -> [2, 2] artiinya garis pendek 2 unit, spasi 2 unit
                doc.setLineDashPattern([2, 2], 0); 
                doc.setDrawColor(150, 150, 150); // Set warna abu-abu agar tidak terlalu mencolok
                
                // Gambar garis sedikit di atas teks baris baru (misal: y - 10)
                doc.line(20, y - 10, pageWidth - 20, y - 10);
                
                // RESET kembali ke mode garis normal (solid) agar garis di bawah nama user tidak ikut putus-putus
                doc.setLineDashPattern([], 0);
                doc.setDrawColor(0, 0, 0); // Kembalikan ke warna hitam default
            }
            // ---------------------------------------------------
        
            // Jaga-jaga batas aman agar teks panjang tidak menabrak kolom sebelah (beri padding 5 unit)
            const maxTextWidth = colWidth - 5; 
        
            // 1. Nama Node / Status
            doc.setFont(undefined, "bold").setFontSize(7.5);
            const nodeName = `${h.AD_WF_Node_ID?.identifier || "-"}`;
            const splitNode = doc.splitTextToSize(nodeName, maxTextWidth);
            doc.text(splitNode, x, y);
        
            // Hitung offset dinamis jika statusnya ternyata membungkus ke 2 baris
            const nodeHeightOffset = (splitNode.length - 1) * 9;
        
            // 2. Nama User
            doc.setFont(undefined, "normal").setFontSize(7.5);
            const userName = h.AD_User_ID?.identifier || "-";
            const splitUser = doc.splitTextToSize(userName, maxTextWidth);
            
            const userY = y + 22 + nodeHeightOffset;
            doc.text(splitUser, x, userY);
            
            // Garis bawah nama user (menggunakan garis solid karena dash pattern sudah di-reset)
            const textWidth = doc.getTextWidth(splitUser[0] || "");
            doc.line(x, userY + 2, x + Math.min(textWidth, maxTextWidth), userY + 2); 
        
            // 3. Tanggal
            const userHeightOffset = (splitUser.length - 1) * 9;
            doc.text(new Date(h.Updated).toLocaleDateString("id-ID"), x, userY + 15 + userHeightOffset);
        });
        
        // Update posisi Y setelah histori (untuk QR code, dsb) - hitung berapa baris dipakai
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
    
        doc.save(`Requisition-${documentNo}.pdf`);
    };

    const handleDownload = async (requisition) => {
        const requisitionId = requisition._requisitionId ?? requisition.id;
        setDownloadingId(requisitionId);
        try {
            const token = localStorage.getItem("token");
            await generateRequisitionPDF(requisitionId, requisition.DocumentNo, token);
        } catch (err) {
            console.error("Gagal generate PDF:", err.message);
            alert("Gagal membuat dokumen PDF.");
        } finally {
            setDownloadingId(null);
        }
    };
    const tableData = requisitions.map((requisition) => {
        const requisitionId = requisition.id ?? requisition.M_Requisition_ID;
        const status  = requisition.DocStatus?.id ?? requisition.DocStatus ?? "DR";

        return {
            ...requisition,
            _raw:        requisition, 
            _requisitionId:    requisitionId,
            _status:     status,
            DocumentNo:  requisition.DocumentNo || `#${requisitionId}`,
            DateDoc: requisition.DateDoc
                ? new Date(requisition.DateDoc).toLocaleDateString("id-ID")
                : "-",
            "M_Warehouse_ID": requisition.M_Warehouse_ID?.identifier
                || requisition.M_Warehouse_ID?.Name
                || "-",
            TotalLines: ` ${parseFloat(requisition.TotalLines || 0).toLocaleString("id-ID")}`,
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
        const isDownloading = downloadingId === item._requisitionId;
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
                
                title="📋 Requisition"
                onSearch={(val) => { setSearch(val); setOffset(0); }}
                extraAction={
                    <button
                        onClick={() => navigate("/requisition")}
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
                summaryRow={{ columnKey: "TotalLines", value: totalLinesFormatted, label: "Total Semua" }}
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

export default RequisitionList;