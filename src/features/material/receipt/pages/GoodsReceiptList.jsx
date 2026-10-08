import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { 
    PageHeader, 
    DataTable, 
    WorkflowProgressButton,
} from "@/shared/components";
import {
    STATUS_FILTERS, 
    StatusBadge, 
    normalizeStatus,
    buildStatusCondition, 
} from "@/utils/docStatus";

import { useOrgInfo } from "@/shared/hooks/useOrgInfo";
import { idempiereApi } from "@/api/idempiereApi";
import{ generateGoodsReceiptPDF } from "@/features/material/receipt/utils/generateGoodsReceiptPDF"
import "@/App.css";

const GoodsReceiptList = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const { orgInfo } = useOrgInfo();
    const [goodsreceipts, setGoodsReceipts]      = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [chargeAmtAll, setChargeAmtAll] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [startDate, setStartDate]       = useState(todayStr);
    const [endDate, setEndDate]           = useState(todayStr);
    const [showAllOption, setShowAllOption] = useState('N');
    const pageSize                        = 10;
    const navigate                        = useNavigate();

    // Buat fungsi filter clause yang konsisten (meniru PurchasingList)
    const buildFilterClause = useCallback((loginUserId) => {
        const conditions = [
            `Created ge ${startDate}T00:00:00Z`,
            `Created le ${endDate}T23:59:59Z`
        ];

        // Hanya tambahkan CreatedBy jika showAllOption BUKAN 'Y'
        if (showAllOption !== 'Y' && loginUserId) {
            conditions.unshift(`CreatedBy eq ${loginUserId}`);
        }

        // Filter Search (berdasarkan DocumentNo)
        if (search) {
            conditions.push(`contains(tolower(DocumentNo),'${search.toLowerCase()}')`);
        }

        // Filter Status menggunakan utilitas buildStatusCondition
        if (statusFilter && statusFilter !== "ALL") {
            conditions.push(`DocStatus eq '${statusFilter}'`);
        }
        const statusCond = buildStatusCondition(statusFilter);
        if (statusCond) conditions.push(statusCond);

        return conditions.join(' and ');
    }, [search, startDate, endDate, statusFilter, showAllOption]);

    const fetchGoodsReceipts = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (showAllOption !== 'Y' && !loginUserId) return;

        setLoading(true);
        try {
            const filterClause = buildFilterClause(loginUserId);
            
            const res = await idempiereApi(
                `/models/m_inout` +
                `?$filter=${filterClause}` +
                `&$select=M_InOut_ID,DocumentNo,MovementDate,M_Warehouse_ID,ChargeAmt,DocStatus,C_DocType_ID` +
                `&$orderby=DocumentNo desc` +
                `&$top=${pageSize}` +
                `&$skip=${offset}`
            );

            setGoodsReceipts(Array.isArray(res.records) ? res.records : []);
            setTotalRecords(res["row-count"] || res.totalRecords || 0);
        } catch (err) {
            console.error("Gagal fetch Goods receipt:", err.message);
        } finally {
            setLoading(false);
        }
    }, [offset, buildFilterClause, showAllOption]);

    const svgToPngDataUrl = (svgString, width, height) => {
        return new Promise((resolve, reject) => {
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = width * 2;  
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

    const fetchChargeAmts = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (showAllOption !== 'Y' && !loginUserId) return;

        setChargeAmtAll(null); 
        try {
            const filterClause = buildFilterClause(loginUserId);
            const res = await idempiereApi(
                `/models/m_inout` +
                `?$filter=${filterClause}` +
                `&$select=ChargeAmt`
            );

            const records = Array.isArray(res.records) ? res.records : [];
            const total   = records.reduce((sum, r) => sum + parseFloat(r.ChargeAmt || 0), 0);
            setChargeAmtAll(total);
        } catch (err) {
            console.error("Gagal fetch total lines:", err.message);
            setChargeAmtAll(0);
        }
    }, [buildFilterClause, showAllOption]);

    useEffect(() => {
        fetchGoodsReceipts();
    }, [fetchGoodsReceipts]);

    useEffect(() => {
        fetchChargeAmts();
    }, [fetchChargeAmts]);

    const handleEdit = (goodsreceipt) => {
        const raw = goodsreceipt._raw ?? goodsreceipt;
        let cleanGoodsReceipt;
        try {
            cleanGoodsReceipt = JSON.parse(JSON.stringify(raw));
        } catch {
            cleanGoodsReceipt = raw;
        }
        navigate("/goods-receipt", { state: { editGoodsReceipt: cleanGoodsReceipt } });
    };

    const chargeAmtFormatted = chargeAmtAll === null
        ? "Menghitung..."
        : `${chargeAmtAll.toLocaleString("id-ID")}`;

    const columns = [
        { key: "DocumentNo",    label: "No. Dokumen" },
        { key: "MovementDate",   label: "Tanggal" },
        { key: "M_Warehouse_ID", label: "Gudang" },
        { key: "TotalLines",    label: "Total Lines", align: "right" },
        { key: "DocStatus",     label: "Status", align: "center" },
    ];
    
    // const generateGoodsReceiptPDF = async (goodsReceiptId, documentNo, token) => {
    //     const header = await idempiereApi(
    //         `/models/m_inout/${goodsReceiptId}` +
    //         `?$select=DocumentNo,MovementDate,Description,DocStatus,AD_Org_ID,CreatedBy,M_Warehouse_ID,M_InOut_UU`
    //     );
        
    //     const linesRes = await idempiereApi(
    //         `/models/m_inoutline` +
    //         `?$filter=M_InOut_ID eq ${goodsReceiptId}` +
    //         `&$select=Line,M_Product_ID,MovementQty,C_UOM_ID,Description` +
    //         `&$orderby=Line`
    //     );
    //     const lines = linesRes.records || [];
    
    //     const historyRes = await idempiereApi(
    //         `/models/ad_wf_eventaudit` +
    //         `?$filter=AD_Table_ID eq 319 and Record_ID eq ${goodsReceiptId}` +
    //         `&$select=AD_WF_Node_ID,AD_User_ID,Updated` +
    //         `&$orderby=Updated asc`
    //     );
        
    //     const history = (historyRes.records || []).filter((h) => {
    //         const nodeName = (h.AD_WF_Node_ID?.identifier || "").toLowerCase();
    //         return nodeName !== "(start)" && 
    //                nodeName !== "(docauto)" &&
    //                nodeName !== "(completedocument)";
    //     });
    
    //     const qrUrl = `https://192.168.0.126:8432/view/goodsreceipt/${header.uid}`;
    //     const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 200 });
    
    //     const statusMap = { DR: "Draft", IP: "Dalam Proses Approval", CO: "Selesai / Disetujui", CL: "Ditutup", VO: "Dibatalkan", RE: "Ditolak" };
    //     const statusCode = header.DocStatus?.id ?? header.DocStatus;
    
    //     const logoSvgString = ReactDOMServer.renderToStaticMarkup(<LogoSMAMerahHitam />);
    //     const logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);

    //     const doc = new jsPDF({ unit: "pt", format: "a4" });
    //     const pageWidth = doc.internal.pageSize.getWidth();
        
    //     doc.addImage(logoDataUrl, "PNG", 20, 5, 70, 42);
    //     doc.setFontSize(14).setFont(undefined, "bold");
    //     doc.text("FORMULIR PENERIMAAN BARANG DI GUDANG", pageWidth / 2, 30, { align: "center" });
    //     doc.setFontSize(9).setFont(undefined, "italic");
    //     doc.text("Penerimaan Barang - Dokumen ini sah dengan histori approval terlampir", pageWidth / 2, 44, { align: "center" });
    //     doc.line(20, 55, pageWidth - 20, 55);
    
    //     doc.setFont(undefined, "normal").setFontSize(9);
    //     let y = 75;
    //     const infoLeft = [
    //         ["No. Dokumen", ": "+header.DocumentNo],
    //         ["Pemohon", ": "+header.CreatedBy?.identifier || "-"],
    //         ["Gudang Tujuan", ": "+header.M_Warehouse_ID?.identifier || "-"],
    //         ["Keterangan", ": "+header.Description || "-"],
    //     ];
    //     const infoRight = [
    //         ["Tanggal", ": "+new Date(header.MovementDate).toLocaleDateString("id-ID")],
    //         ["Departemen", ": "+header.AD_Org_ID?.identifier || "-"],
    //         ["Status", ": "+statusMap[statusCode] || statusCode],
    //     ];
    //     infoLeft.forEach(([label, val], i) => {
    //         doc.text(label, 20, y + i * 16);
    //         doc.text(String(val), 100, y + i * 16);
    //     });
    //     infoRight.forEach(([label, val], i) => {
    //         doc.text(label, 320, y + i * 16);
    //         doc.text(String(val), 400, y + i * 16);
    //     });
    
    //     autoTable(doc, {
    //         startY: y + infoLeft.length * 16 + 20,
    //         head: [["No", "Nama Barang", "Qty", "UOM", "Keterangan"]],
    //         body: lines.map((l, idx) => [
    //             idx + 1,
    //             l.M_Product_ID?.identifier || "-",
    //             l.MovementQty,
    //             l.C_UOM_ID?.identifier || "-",
    //             l.Description || "",
    //         ]),
    //         theme: "grid",
    //         styles: { fontSize: 8 },
    //         headStyles: {
    //             fillColor: [0, 0, 0],
    //             textColor: [255, 255, 255],
    //             fontStyle: "bold",
    //         },
    //         margin: { left: 20, right: 20 }, 
    //         tableWidth: pageWidth - 40, 
    //     });

    //     let finalY = doc.lastAutoTable.finalY + 20;
    //     doc.setFont(undefined, "bold").setFontSize(10);
    //     doc.text("Histori Approval / Workflow", 20, finalY);
    //     doc.line(20, finalY + 6, pageWidth - 20, finalY + 6);

    //     finalY += 20;

    //     const marginLeft = 20;
    //     const marginRight = 20;
    //     const usableWidth = pageWidth - marginLeft - marginRight;
    //     const colCount = 5;
    //     const colWidth = usableWidth / colCount;
    //     const rowHeight = 65;

    //     history.forEach((h, idx) => {
    //         const col = idx % colCount;
    //         const row = Math.floor(idx / colCount);
    //         const x = marginLeft + col * colWidth;
    //         const yPos = finalY + row * rowHeight;
        
    //         if (row > 0 && col === 0) {
    //             doc.setLineDashPattern([2, 2], 0); 
    //             doc.setDrawColor(150, 150, 150); 
    //             doc.line(20, yPos - 10, pageWidth - 20, yPos - 10);
    //             doc.setLineDashPattern([], 0);
    //             doc.setDrawColor(0, 0, 0); 
    //         }
        
    //         const maxTextWidth = colWidth - 5; 
    //         doc.setFont(undefined, "bold").setFontSize(7.5);
    //         const nodeName = `${h.AD_WF_Node_ID?.identifier || "-"}`;
    //         const splitNode = doc.splitTextToSize(nodeName, maxTextWidth);
    //         doc.text(splitNode, x, yPos);
        
    //         const nodeHeightOffset = (splitNode.length - 1) * 9;
        
    //         doc.setFont(undefined, "normal").setFontSize(7.5);
    //         const userName = h.AD_User_ID?.identifier || "-";
    //         const splitUser = doc.splitTextToSize(userName, maxTextWidth);
            
    //         const userY = yPos + 22 + nodeHeightOffset;
    //         doc.text(splitUser, x, userY);
            
    //         const textWidth = doc.getTextWidth(splitUser[0] || "");
    //         doc.line(x, userY + 2, x + Math.min(textWidth, maxTextWidth), userY + 2); 
        
    //         const userHeightOffset = (splitUser.length - 1) * 9;
    //         doc.text(new Date(h.Updated).toLocaleDateString("id-ID"), x, userY + 15 + userHeightOffset);
    //     });
        
    //     const totalRows = Math.ceil(history.length / colCount);
    //     finalY += totalRows * rowHeight + 20;
        
    //     finalY += 20;
    //     doc.setFont(undefined, "bold").setFontSize(9);
    //     doc.text("Verifikasi Dokumen Digital", pageWidth / 2, finalY, { align: "center" });
    //     doc.addImage(qrDataUrl, "PNG", pageWidth / 2 - 30, finalY + 10, 60, 60);
    //     doc.setFont(undefined, "normal").setFontSize(6.5);
    //     doc.text(
    //         `Scan untuk verifikasi keaslian & status approval dokumen ${header.DocumentNo}`,
    //         pageWidth / 2, finalY + 80, { align: "center" }
    //     );
    
    //     const pageHeight = doc.internal.pageSize.getHeight();
    //     doc.setFont(undefined, "italic").setFontSize(7);
    //     doc.text(
    //         `Dokumen ini dicetak otomatis dari sistem dan sah tanpa tanda tangan basah selama status approval di atas terverifikasi pada sistem - dicetak ${new Date().toLocaleDateString("id-ID")}`,
    //         pageWidth / 2, pageHeight - 20, { align: "center" }
    //     );
    
    //     doc.save(`Penerimaan-${documentNo}.pdf`);
    // };

    const handleDownload = async (goodsreceipt) => {
        const goodsreceiptId = goodsreceipt._goodsreceiptId ?? goodsreceipt.id;
        setDownloadingId(goodsreceiptId);
        try {
            const token = localStorage.getItem("token");
            await generateGoodsReceiptPDF(goodsreceiptId, goodsreceipt.DocumentNo, orgInfo);
        } catch (err) {
            console.error("Gagal generate PDF:", err.message);
            alert("Gagal membuat dokumen PDF.");
        } finally {
            setDownloadingId(null);
        }
    };

    const tableData = goodsreceipts.map((goodsreceipt) => {
        const goodsreceiptId = goodsreceipt.id ?? goodsreceipt.M_InOut_ID;
        const status = normalizeStatus(goodsreceipt.DocStatus);

        return {
            ...goodsreceipt,
            _raw: goodsreceipt, 
            _goodsreceiptId: goodsreceiptId,
            _status: status,
            DocumentNo: goodsreceipt.DocumentNo || `#${goodsreceiptId}`,
            MovementDate: goodsreceipt.MovementDate
                ? new Date(goodsreceipt.MovementDate).toLocaleDateString("id-ID")
                : "-",
            "M_Warehouse_ID": goodsreceipt.M_Warehouse_ID?.identifier
                || goodsreceipt.M_Warehouse_ID?.Name
                || "-",
            TotalLines: `${parseFloat(goodsreceipt.TotalLines || 0).toLocaleString("id-ID")}`,
            DocStatus: <StatusBadge status={status} />,
        };
    });

    const actionRenderer = (item) => {
        const isEditDisabled = !["DR", "NA"].includes(item._status);
        const editTitle = item._status === "NA"
            ? "Revisi & ajukan ulang untuk approval"
            : "Edit Dokumen";
        const isDownloading = downloadingId === item._goodsreceiptId;
        const isDownloadDisabled = item._status !== "CO" || isDownloading;
    
        return (
            <div style={{ display: "flex", gap: "6px" }}>
                <button
                    onClick={() => !isEditDisabled ? handleEdit(item) : null}
                    disabled={isEditDisabled}
                    style={{
                        ...styles.editBtn,
                        backgroundColor: !isEditDisabled ? (item._status === "NA" ? "#c62828" : "#f57c00") : "#ccc",
                        cursor: !isEditDisabled ? "pointer" : "not-allowed",
                        opacity: !isEditDisabled ? 1 : 0.6,
                    }}
                    title={isEditDisabled ? `Status tidak dapat diubah` : editTitle}
                >
                    {item._status === "NA" ? "🔁 Revisi" : "✏️ Edit"}
                </button>
    
                <button
                    onClick={() => !isDownloadDisabled ? handleDownload(item) : null}
                    disabled={isDownloadDisabled}
                    style={{
                        ...styles.editBtn,
                        backgroundColor: isDownloadDisabled ? "#ccc" : "#546e7a",
                        cursor: isDownloadDisabled ? "not-allowed" : "pointer",
                        opacity: isDownloadDisabled ? 0.6 : 1,
                    }}
                    title={
                        item._status !== "CO"
                            ? `Download hanya tersedia untuk dokumen dengan status Completed`
                            : "Download Dokumen"
                    }
                >
                    {isDownloading ? "⏳ ..." : "⬇️ Download"}
                </button>
                <WorkflowProgressButton
                    tableName="M_InOut"
                    recordId={item._goodsreceiptId}
                    docStatus={item._status}
                    targetStatus="CO"
                    buttonStyle={styles.editBtn}
                />
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
                filters={STATUS_FILTERS}
                activeFilter={statusFilter}
                onFilterChange={(newStatus) => { setStatusFilter(newStatus); setOffset(0); }}
                title="Goods Receipt"
                onSearch={(val) => { setSearch(val); setOffset(0); }}
                extraAction={
                    <button
                        onClick={() => navigate("/goods-receipt")}
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
                summaryRow={{ columnKey: "TotalLines", value: chargeAmtFormatted, label: "Total Semua" }}
            />
        </div>
    );
};

const styles = {
    newBtn:  { backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    editBtn: { color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", transition: "all 0.2s ease" },
    dateFilterRow: { display: "flex", gap: "16px", flexWrap: "wrap", margin: "12px 0 16px" },
    dateField:     { display: "flex", flexDirection: "column", gap: "4px" },
    dateLabel:     { fontSize: "12px", fontWeight: "600", color: "#555" },
    dateInput:      { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" },
};

export default GoodsReceiptList;