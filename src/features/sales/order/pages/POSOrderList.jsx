import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, DataTable } from "@/shared/components";
import { idempiereApi } from "@/api/idempiereApi";
import { LogoSMAMerahHitam } from "@/shared/components/icon";
import { renderListPDF } from "@/utils/pdf/renderListPDF";
import { useOrgInfo } from '@/shared/hooks/useOrgInfo';
import "@/App.css";

const POSOrderList = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const [orders, setOrders]             = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [grandTotalAll, setGrandTotalAll] = useState(null); // null = belum load
    const pageSize                        = 10;
    const [startDate, setStartDate]       = useState(todayStr);
    const [endDate, setEndDate]           = useState(todayStr);
    const navigate                        = useNavigate();
    const { orgInfo } = useOrgInfo();
    if (loading) return null;

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
        const map = { DR: "Draft", IP: "In Progress", CO: "Completed", VO: "Voided", RE: "Reversed" };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = { DR: "#f57c00", CO: "#2e7d32", VO: "#c62828", IP: "#1565c0" };
        return map[status] || "#555";
    };

    const fetchOrders = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setLoading(true);
        try {
            //const today = new Date().toISOString().split("T")[0];

            let filterClause =
                `IsSOTrx eq true` +
                ` and CreatedBy eq ${loginUserId}` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            const res = await idempiereApi(
                `/models/c_order` +
                `?$filter=${filterClause}` +
                `&$select=C_Order_ID,DocumentNo,DateOrdered,C_BPartner_ID,GrandTotal,DocStatus,M_PriceList_ID,M_Warehouse_ID,C_DocTypeTarget_ID` +
                `&$orderby=DocumentNo desc` +
                `&$top=${pageSize}` +
                `&$skip=${offset}`
            );

            setOrders(Array.isArray(res.records) ? res.records : []);
            setTotalRecords(res["row-count"] || res.totalRecords || 0);
        } catch (err) {
            console.error("Gagal fetch orders:", err.message);
        } finally {
            setLoading(false);
        }
    }, [offset, startDate, endDate, search]);

    // Fetch total GrandTotal seluruh halaman — hanya dipicu saat filter berubah (bukan saat ganti halaman)
    const fetchGrandTotal = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setGrandTotalAll(null); // reset saat filter berubah
        try {
            //const today = new Date().toISOString().split("T")[0];

            let filterClause =
                `IsSOTrx eq true` +
                ` and CreatedBy eq ${loginUserId}` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            // Ambil hanya kolom GrandTotal tanpa pagination untuk dijumlahkan
            const res = await idempiereApi(
                `/models/c_order` +
                `?$filter=${filterClause}` +
                `&$select=GrandTotal`
            );

            const records = Array.isArray(res.records) ? res.records : [];
            const total   = records.reduce((sum, r) => sum + parseFloat(r.GrandTotal || 0), 0);
            setGrandTotalAll(total);
        } catch (err) {
            console.error("Gagal fetch grand total:", err.message);
            setGrandTotalAll(0);
        }
    }, [search, startDate, endDate]); // hanya search — bukan offset

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useEffect(() => {
        fetchGrandTotal();
    }, [fetchGrandTotal]);

    const handleEdit = (order) => {
        navigate("/pos-order", { state: { editOrder: order } });
    };

    // Format total seluruh halaman dari state (null = sedang loading)
    const grandTotalFormatted = grandTotalAll === null
        ? "Menghitung..."
        : `${grandTotalAll.toLocaleString("id-ID")}`;

    const columns = [
        { key: "DocumentNo",    label: "No. Dokumen" },
        { key: "DateOrdered",   label: "Tanggal" },
        { key: "C_BPartner_ID", label: "Customer" },
        { key: "GrandTotal",    label: "Grand Total", align: "right" },
        { key: "DocStatus",     label: "Status", align: "center" },
    ];

    const tableData = orders.map((order) => {
        const orderId = order.id ?? order.C_Order_ID;
        const status  = order.DocStatus?.id ?? order.DocStatus ?? "DR";

        return {
            ...order,
            _orderId:    orderId,
            _status:     status,
            DocumentNo:  order.DocumentNo || `#${orderId}`,
            DateOrdered: order.DateOrdered
                ? new Date(order.DateOrdered).toLocaleDateString("id-ID")
                : "-",
            "C_BPartner_ID": order.C_BPartner_ID?.identifier
                || order.C_BPartner_ID?.Name
                || "-",
            GrandTotal: `${parseFloat(order.GrandTotal || 0).toLocaleString("id-ID")}`,
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
    const fetchAllOrdersForPrint = useCallback(async () => {
            const loginUserId = localStorage.getItem("AD_User_ID");
            if (!loginUserId) return [];
        
            let filterClause =
                ` IsSOTrx eq true` +
                ` and Created ge ${startDate}T00:00:00Z` +
                ` and Created le ${endDate}T23:59:59Z`;
        
            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }
        
            const res = await idempiereApi(
                `/models/c_order` +
                `?$filter=${filterClause}` +
                `&$select=C_Order_ID,DocumentNo,Createdby, DateOrdered,C_BPartner_ID,GrandTotal` +
                `&$orderby=DocumentNo desc` +
                `&$top=5000`
            );
        
            return Array.isArray(res.records) ? res.records : [];
        }, [search, startDate, endDate]);
    
        const [printingList, setPrintingList] = useState(false);
    
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
                    logo: '{orgInfo?.logoUrl && <img src={orgInfo.logoUrl} alt="Logo" style={{ height: 48 }} />}',
                    periodLabel: `PERIODE : ${formatDateService(startDate)}  ${formatDateService(endDate)}`,
                    columns: [
                        { key: 'no',         label: 'No',                width: 30,  align: 'center' },
                        { key: 'documentNo', label: 'Document No',       width: 'auto' },
                        { key: 'dateOrder', label: 'Date',       width: 'auto' },
                        { key: 'createdBy',    label: 'Sales Rep', width: 'auto' },
                        { key: 'partner',    label: 'Customer', width: 'flex' },
                        { key: 'amount',     label: 'Amount',            width: 'auto', align: 'right' },
                    ],
                    rows: allOrders.map((odr, idx) => ({
                        no:         idx + 1,
                        documentNo: odr.DocumentNo || `#${odr.id ?? odr.C_Order_ID}`,
                        dateOrder: odr.DateOrdered || `#${odr.id ?? odr.DateOrdered}`,
                        createdBy:    odr.CreatedBy?.identifier || '-',
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


    const actionRenderer = (item) => {
        const isEditDisabled = item._status !== "DR";
        return (
            <button
                onClick={() => !isEditDisabled ? handleEdit(item) : null}
                disabled={isEditDisabled}
                style={{
                    ...styles.editBtn,
                    backgroundColor: !isEditDisabled ? "#f57c00" : "#ccc",
                    cursor:          !isEditDisabled ? "pointer"  : "not-allowed",
                    opacity:         !isEditDisabled ? 1          : 0.6,
                }}
                title={isEditDisabled ? `Status ${getStatusLabel(item._status)} tidak dapat diubah` : "Edit Dokumen"}
            >
                ✏️ Edit
            </button>
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
                title="📋 Sales Order — Hari ini"
                onSearch={(val) => { setSearch(val); setOffset(0); }}
                extraAction={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handlePrintList} disabled={printingList} style={styles.newBtn}>
                            {printingList ? '⏳ ...' : '🖨️ Print PDF'}
                        </button>
                        <button onClick={() => navigate("/pos-order")} style={styles.newBtn}>
                            + New
                        </button>
                    </div>

                   
                }
            />
            <div style={styles.dateFilterRow}>
                <div style={styles.dateField}>
                    <label style={styles.dateLabel}>Date from</label>
                    <input
                        type="date"
                        value={startDate}
                        max={endDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        style={styles.dateInput}
                    />
                </div>
                <div style={styles.dateField}>
                    <label style={styles.dateLabel}>Date To</label>
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
                summaryRow={{ columnKey: "GrandTotal", value: grandTotalFormatted, label: "Total Semua" }}
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

export default POSOrderList;