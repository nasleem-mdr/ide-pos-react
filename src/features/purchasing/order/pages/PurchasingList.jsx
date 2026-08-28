import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, DataTable } from "@/shared/components/setup";
import { useOrgInfo } from "@/shared/hooks/useOrgInfo";
import { idempiereApi } from "@/api/idempiereApi";
import { renderListPDF } from "@/utils/pdf/renderListPDF";
import { generateOrderPDF } from "@/features/purchasing/order/utils/generateOrderPDF";
import "@/App.css";

const STATUS_FILTERS = [
    { value: "ALL", label: "Semua" },
    { value: "DR",  label: "Draft" },
    { value: "IP",  label: "Diproses" },
    { value: "NA",  label: "Ditolak" },
    { value: "CO",  label: "Selesai" },
];

const PurchasingList = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const { orgInfo } = useOrgInfo();
    const [orders, setOrders]             = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalAmountAll, setTotalAmountAll] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [startDate, setStartDate]       = useState(todayStr);
    const [endDate, setEndDate]           = useState(todayStr);
    const pageSize                        = 10;
    const navigate                        = useNavigate();

    const handleDownload = async (order) => {
        const orderId = order._orderId ?? order.id;
        setDownloadingId(orderId);
        try {
            await generateOrderPDF(orderId, order.DocumentNo, orgInfo);
        } catch (err) {
            console.error("Gagal generate PDF:", err);
            alert("Gagal membuat dokumen PDF: " + err.message);
        } finally {
            setDownloadingId(null);
        }
    };

    const getStatusLabel = (status) => {
        const map = { DR: "Draft", IP: "In Progress", CO: "Completed", CL: "Closed", VO: "Voided", RE: "Reversed", NA: "Ditolak" };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = { DR: "#f57c00", CO: "#2e7d32", CL: "#37474f", VO: "#c62828", IP: "#1565c0", NA: "#c62828" };
        return map[status] || "#555";
    };
    const [showAllOption, setShowAllOption] = useState('N');

    const buildFilterClause = useCallback((loginUserId) => {
        // Array untuk menampung semua kondisi filter
        const conditions = [
            `IsSOTrx eq false`,
            `Created ge ${startDate}T00:00:00Z`,
            `Created le ${endDate}T23:59:59Z`
        ];

        // Kondisi IF: Hanya tambahkan CreatedBy jika opsi tampilkan semua BUKAN 'Y'
        if (showAllOption !== 'Y' && loginUserId) {
            conditions.unshift(`CreatedBy eq ${loginUserId}`);
        }

        // Filter Search
        if (search) {
            conditions.push(`contains(tolower(DocumentNo),'${search.toLowerCase()}')`);
        }

        // Filter Status
        if (statusFilter && statusFilter !== "ALL") {
            conditions.push(`DocStatus eq '${statusFilter}'`);
        }

        // Gabungkan semua kondisi dengan kata ' and '
        return conditions.join(' and ');
    }, [search, startDate, endDate, statusFilter, showAllOption]);


    const fetchOrders = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setLoading(true);
        try {
            const filterClause = buildFilterClause(loginUserId);
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
    }, [offset, buildFilterClause]);

    const fetchTotalAmount = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setTotalAmountAll(null);
        try {
            const filterClause = buildFilterClause(loginUserId);
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
    }, [buildFilterClause]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useEffect(() => {
        fetchTotalAmount();
    }, [fetchTotalAmount]);

    const handleEdit = (order) => {
        const raw = order._raw ?? order;
        let cleanOrder;
        try {
            cleanOrder = JSON.parse(JSON.stringify(raw));
        } catch {
            cleanOrder = raw;
        }
        navigate("/purchasing", { state: { editOrder: cleanOrder } });
    };

    const fmtRp = (n) => `${Math.round(n || 0).toLocaleString("id-ID")}`;

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
        const isDownloadDisabled = item._status !== "CO" || isDownloading;

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

    // const fetchAllOrdersForPrint = useCallback(async () => {
    //     const loginUserId = localStorage.getItem("AD_User_ID");
        
    //     if (!loginUserId) return [];

    //     let filterClause =
    //         ` CreatedBy eq ${loginUserId}` +
    //         ` and IsSOTrx eq false` +
    //         ` and Created ge ${startDate}T00:00:00Z` +
    //         ` and Created le ${endDate}T23:59:59Z`;

    //     if (search) {
    //         filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
    //     }

    //     const res = await idempiereApi(
    //         `/models/c_order` +
    //         `?$filter=${filterClause}` +
    //         `&$select=C_Order_ID,DocumentNo,Createdby, DateOrdered,C_BPartner_ID,GrandTotal` +
    //         `&$orderby=DocumentNo desc` +
    //         `&$top=5000`
    //     );

    //     return Array.isArray(res.records) ? res.records : [];
    // }, [search, startDate, endDate]);
    // Tambahkan parameter (misal: showAll) ke dalam useCallback atau argumen fungsi
    
    const fetchAllOrdersForPrint = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        
        // Validasi login user hanya jika TIDAK memilih opsi 'Y'
        if (showAllOption !== 'Y' && !loginUserId) return [];
    
        // Array kondisi filter dasar
        const conditions = [
            `IsSOTrx eq false`,
            `Created ge ${startDate}T00:00:00Z`,
            `Created le ${endDate}T23:59:59Z`
        ];
    
        // Tambahkan CreatedBy HANYA jika opsi BUKAN 'Y'
        if (showAllOption !== 'Y' && loginUserId) {
            conditions.unshift(`CreatedBy eq ${loginUserId}`);
        }
    
        // Filter Search
        if (search) {
            conditions.push(`contains(tolower(DocumentNo),'${search.toLowerCase()}')`);
        }
    
        // Filter Status (jika ada)
        if (statusFilter && statusFilter !== "ALL") {
            conditions.push(`DocStatus eq '${statusFilter}'`);
        }
    
        // Gabungkan semua kondisi
        const filterClause = conditions.join(' and ');
    
        const res = await idempiereApi(
            `/models/c_order` +
            `?$filter=${encodeURIComponent(filterClause)}` +
            `&$select=C_Order_ID,DocumentNo,Createdby,DateOrdered,C_BPartner_ID,GrandTotal` +
            `&$orderby=DocumentNo desc` +
            `&$top=5000`
        );
    
        return Array.isArray(res.records) ? res.records : [];
        
    // Pastikan showAllOption DAN statusFilter dimasukkan ke dependency array!
    }, [search, startDate, endDate, statusFilter, showAllOption]);

    const [printingList, setPrintingList] = useState(false);
    const numberFormatter = new Intl.NumberFormat('en-US');
    const formatDateService = (dateStr) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        if (isNaN(d)) return "-";
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };
   
    const handlePrintList = async () => {
            setPrintingList(true);
            try {
                const allOrders = await fetchAllOrdersForPrint();
    
                if (allOrders.length === 0) {
                    alert('Tidak ada data untuk dicetak pada periode ini.');
                    return;
                }
    
                const totalAmount = allOrders.reduce((s, odr) => s + parseFloat(odr.GrandTotal || 0), 0);
                await renderListPDF({
                    title: 'DAFTAR SALES',
                    orgInfo,   
                    periodLabel: `PERIODE : ${formatDateService(startDate)}  ${formatDateService(endDate)}`,
                    columns: [
                        { key: 'no',         label: 'No',          width: 30,     align: 'center' },
                        { key: 'documentNo', label: 'Document No', width: 70 },
                        { key: 'dateOrder',  label: 'Date',        width: 60 },
                        { key: 'createdBy',  label: 'Sales Rep',   width: 80 },
                        { key: 'partner',    label: 'Customer',    width: 200 },
                        { key: 'amount',     label: 'Amount',      width: 85, align: 'right' },
                    ],
                    rows: allOrders.map((odr, idx) => ({
                        no:         idx + 1,
                        documentNo: odr.DocumentNo || `#${odr.id ?? odr.C_Order_ID}`,
                        dateOrder:  odr.DateOrdered || `#${odr.id ?? odr.DateOrdered}`,
                        createdBy:  odr.CreatedBy?.identifier || '-',
                        partner:    odr.C_BPartner_ID?.identifier || '-',
                        amount:     numberFormatter.format(odr.GrandTotal ?? 0),
                    })),
                    totalLabel: 'Total Semua',
                    totalValue: numberFormatter.format(totalAmount),
                    filenamePrefix: `DAFTAR-SALES-${startDate}_${endDate}`,
                });
            } catch (err) {
                console.error('Gagal generate PDF daftar:', err.message);
                alert('Gagal membuat PDF daftar.');
            } finally {
                setPrintingList(false);
            }
        };
    return (
        <div className="card-container">
            <PageHeader
                title="Purchasing"
                onSearch={(val) => { setSearch(val); setOffset(0); }}
                filters={STATUS_FILTERS}
                activeFilter={statusFilter}
                onFilterChange={handleFilterChange}
                extraAction={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handlePrintList} disabled={printingList} style={styles.newBtn}>
                            {printingList ? '⏳ ...' : '🖨️ Print PDF'}
                        </button>
                        <button onClick={() => navigate("/purchasing")} style={styles.newBtn}>
                            + New
                        </button>
                    </div>
                    // <button
                    //     onClick={() => navigate("/purchasing")}
                    //     style={styles.newBtn}
                    // >
                    //     + Transaksi Baru
                    // </button>
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

                {/* OPSI TAMBAHAN SEBELAH TANGGAL */}
                <div style={{ ...styles.dateField, justifyContent: 'center' }}>
                <label style={{ ...styles.dateLabel, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '24px' }}>
                    <input
                    type="checkbox"
                    checked={showAllOption === 'Y'}
                    onChange={(e) => setShowAllOption(e.target.checked ? 'Y' : 'N')}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Tampilkan Semua User
                </label>
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