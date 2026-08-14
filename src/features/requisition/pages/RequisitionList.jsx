import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, DataTable }  from "@/shared/components";
import { renderListPDF } from "@/utils/pdf/renderListPDF";
import { generateRequisitionPDF } from '@/features/requisition/utils/generateRequisitionPDF';
import { idempiereApi } from "@/api/idempiereApi";
import { useOrgInfo } from "@/shared/hooks/useOrgInfo";
import "@/App.css";

// Filter status ala Shopee — value 'ALL' berarti tanpa filter DocStatus sama
// sekali. Urutan di sini menentukan urutan tab yang tampil di PageHeader.
const STATUS_FILTERS = [
    { value: "ALL", label: "Semua" },
    { value: "DR",  label: "Draft" },
    { value: "IP",  label: "Diproses" },
    { value: "NA",  label: "Ditolak" },
    { value: "CO",  label: "Selesai" },
];

const RequisitionList = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const { orgInfo } = useOrgInfo(); 
    const [requisitions, setRequisitions]             = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalLinesAll, setTotalLinesAll] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [startDate, setStartDate]       = useState(todayStr);
    const [endDate, setEndDate]           = useState(todayStr);
    const pageSize                        = 10;
    const navigate                        = useNavigate();

    const getStatusLabel = (status) => {
        const map = { DR: "Draft", IP: "In Progress", CO: "Completed", VO: "Voided", RE: "Reversed", NA: "Ditolak" };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = { DR: "#f57c00", CO: "#2e7d32", VO: "#c62828", IP: "#1565c0", NA: "#c62828" };
        return map[status] || "#555";
    };

    // Filter dasar (tanggal + owner + search) — dipakai bareng oleh
    // fetchRequisitions & fetchTotalLines supaya konsisten. statusFilter
    // ditambahkan terpisah karena 'ALL' berarti TIDAK ada klausa DocStatus.
    const buildFilterClause = useCallback((loginUserId) => {
        let filterClause =
            ` CreatedBy eq ${loginUserId}` +
            ` and Created ge ${startDate}T00:00:00Z` +
            ` and Created le ${endDate}T23:59:59Z`;

        if (search) {
            filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
        }
        if (statusFilter && statusFilter !== "ALL") {
            filterClause += ` and DocStatus eq '${statusFilter}'`;
        }
        return filterClause;
    }, [search, startDate, endDate, statusFilter]);

    const fetchRequisitions = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setLoading(true);
        try {
            const filterClause = buildFilterClause(loginUserId);

            const res = await idempiereApi(
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
    }, [offset, buildFilterClause]);
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
            const filterClause = buildFilterClause(loginUserId);

            // Ambil hanya kolom GrandTotal tanpa pagination untuk dijumlahkan
            const res = await idempiereApi(
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
    }, [buildFilterClause]);

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
    

   
    const handleDownload = async (requisition) => {
        const requisitionId = requisition._requisitionId ?? requisition.id;
        setDownloadingId(requisitionId);
        try {
            const token = localStorage.getItem("token");
            await generateRequisitionPDF(requisitionId, requisition.DocumentNo, token, orgInfo?.logoUrl);
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

    const numberFormatter = new Intl.NumberFormat('en-US');
    
        const formatDateService = (dateStr) => {
            if (!dateStr) return "-";
            const d = new Date(dateStr);
            if (isNaN(d)) return "-";
            const day = d.getDate();
            const month = d.getMonth() + 1; // getMonth() 0-based
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        const fetchAllRequisitionsForPrint = useCallback(async () => {
                const loginUserId = localStorage.getItem("AD_User_ID");
                if (!loginUserId) return [];
            
                let filterClause =
                    ` CreatedBy eq ${loginUserId}` +
                    ` and Created ge ${startDate}T00:00:00Z` +
                    ` and Created le ${endDate}T23:59:59Z`;
            
                if (search) {
                    filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
                }
            
                const res = await idempiereApi(
                    `/models/m_requisition` +
                    `?$filter=${filterClause}` +
                    `&$select=M_Requisition_ID,DocumentNo,Createdby, DateRequired, DateDoc,M_Warehouse_ID,Description, TotalLines` +
                    `&$orderby=DocumentNo desc` +
                    `&$top=5000`
                );
            
                return Array.isArray(res.records) ? res.records : [];
            }, [search, startDate, endDate]);
        
            const [printingList, setPrintingList] = useState(false);
        
            const handlePrintList = async () => {
                setPrintingList(true);
                try {
                    const allRequisitions = await fetchAllRequisitionsForPrint();
        
                    if (allRequisitions.length === 0) {
                        alert('Tidak ada data untuk dicetak pada periode ini.');
                        return;
                    }
        
                    const totalAmount = allRequisitions.reduce((s, odr) => s + parseFloat(odr.TotalLines || 0), 0);
        
                    await renderListPDF({
                        title: 'DAFTAR REQUISITION',
                        logoDataUrl: orgInfo?.logoUrl,
                        periodLabel: `PERIODE : ${formatDateService(startDate)}  ${formatDateService(endDate)}`,
                        columns: [
                            { key: 'no',         label: 'No',                width: 30,  align: 'center' },
                            { key: 'documentNo', label: 'Document No',       width: 'auto' },
                            { key: 'dateDoc', label: 'Date Doc',       width: 'auto' },
                            { key: 'dateReq', label: 'Date Required',       width: 'auto' },
                            { key: 'createdBy',    label: 'Sales Rep', width: 'auto' },
                            { key: 'partner',    label: 'Warhouse', width: 'auto' },
                            { key: 'descript',     label: 'Description',            width: 'flex'},
                        ],
                        rows: allRequisitions.map((odr, idx) => ({
                            no:         idx + 1,
                            documentNo: odr.DocumentNo || `#${odr.id ?? odr.M_Requisition_ID}`,
                            dateDoc: odr.DateDoc || `#${odr.id ?? odr.DateDoc}`,
                            dateReq: odr.DateRequired || `#${odr.id ?? odr.DateRequired}`,
                            createdBy:    odr.CreatedBy?.identifier || '-',
                            partner:    odr.M_Warehouse_ID?.identifier || '-',
                            descript: odr.Description || `#${odr.id ?? odr.Description}`,
                        })),
                        totalLabel: 'Total Semua',
                        totalValue: numberFormatter.format(totalAmount),
                        filenamePrefix: `DAFTAR-REQUISITION-${startDate}_${endDate}`,
                    });
                } catch (err) {
                    console.error('Gagal generate PDF daftar:', err.message);
                    alert('Gagal membuat PDF daftar.');
                } finally {
                    setPrintingList(false);
                }
            };
    

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

    const handleFilterChange = (val) => {
        setStatusFilter(val);
        setOffset(0);
    };

    return (
        <div className="card-container">
            
            <PageHeader
                title="Requisition"
                onSearch={(val) => { setSearch(val); setOffset(0); }}
                filters={STATUS_FILTERS}
                activeFilter={statusFilter}
                onFilterChange={handleFilterChange}
                extraAction={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handlePrintList} disabled={printingList} style={styles.newBtn}>
                            {printingList ? '⏳ ...' : '🖨️ Print PDF'}
                        </button>
                        <button onClick={() => navigate("/requisition")} style={styles.newBtn}>
                            + New
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
