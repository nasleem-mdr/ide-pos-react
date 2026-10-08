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
import DocActionButton from "@/shared/components/DocActionButton";
import { getAvailableActions } from "@/shared/docAction/docActionConfig";

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
    // --- Pilihan baris untuk aksi massal Close/Void ---
    const [selected, setSelected] = useState(() => new Map());
    const toDocItem = (g) => ({ id: g._goodsreceiptId, documentNo: g.DocumentNo, status: g._status });
    const toggleSelect = (g) =>
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(g._goodsreceiptId)) next.delete(g._goodsreceiptId);
            else next.set(g._orderId, toDocItem(g));
            return next;
        });
    const handleDocActionDone = () => {
        setSelected(new Map());
        fetchGoodsReceipts();
        fetchChargeAmts();
    };

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

    // const svgToPngDataUrl = (svgString, width, height) => {
    //     return new Promise((resolve, reject) => {
    //         const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    //         const url = URL.createObjectURL(svgBlob);
    //         const img = new Image();
    //         img.onload = () => {
    //             const canvas = document.createElement("canvas");
    //             canvas.width = width * 2;  
    //             canvas.height = height * 2;
    //             const ctx = canvas.getContext("2d");
    //             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    //             URL.revokeObjectURL(url);
    //             resolve(canvas.toDataURL("image/png"));
    //         };
    //         img.onerror = reject;
    //         img.src = url;
    //     });
    // };

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
                <input
                    type="checkbox"
                    checked={selected.has(item._goodsreceiptId)}
                    disabled={getAvailableActions("M_InOut", item._status).length === 0}
                    onChange={() => toggleSelect(item)}
                    title="Pilih untuk aksi massal Close/Void"
                    style={{ width: "16px", height: "16px" }}
                />
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
                <DocActionButton
                    tableName="M_InOut"
                    items={[toDocItem(item)]}
                    onDone={handleDocActionDone}
                    style={{ ...styles.editBtn, backgroundColor: "#6d4c41" }}
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
                    <div style={{ display: 'flex', gap: '8px' }}>
                    <DocActionButton
                        tableName="M_InOut"
                        items={[...selected.values()]}
                        label={`⛔ Close / Void (${selected.size})`}
                        onDone={handleDocActionDone}
                        style={{ ...styles.newBtn, backgroundColor: "#6d4c41" }}
                    />
                    <button
                        onClick={() => navigate("/goods-receipt")}
                        style={styles.newBtn}
                    >
                        + Transaksi Baru
                    </button>
                    </div>
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