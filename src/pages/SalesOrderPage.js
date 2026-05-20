import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import "../App.css";

const SalesOrderPage = () => {
    const [orders, setOrders]             = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [grandTotalAll, setGrandTotalAll] = useState(null); // null = belum load
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
            const today = new Date().toISOString().split("T")[0];

            let filterClause =
                `IsSOTrx eq true` +
                ` and CreatedBy eq ${loginUserId}` +
                ` and Created ge ${today}T00:00:00Z` +
                ` and Created le ${today}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            const res = await customFetch(
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
    }, [offset, search]);

    // Fetch total GrandTotal seluruh halaman — hanya dipicu saat filter berubah (bukan saat ganti halaman)
    const fetchGrandTotal = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setGrandTotalAll(null); // reset saat filter berubah
        try {
            const today = new Date().toISOString().split("T")[0];

            let filterClause =
                `IsSOTrx eq true` +
                ` and CreatedBy eq ${loginUserId}` +
                ` and Created ge ${today}T00:00:00Z` +
                ` and Created le ${today}T23:59:59Z`;

            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            // Ambil hanya kolom GrandTotal tanpa pagination untuk dijumlahkan
            const res = await customFetch(
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
    }, [search]); // hanya search — bukan offset

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
        : `Rp ${grandTotalAll.toLocaleString("id-ID")}`;

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
            GrandTotal: `Rp ${parseFloat(order.GrandTotal || 0).toLocaleString("id-ID")}`,
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

    return (
        <div className="card-container">
            <PageHeader
                title="📋 Sales Order — Hari ini"
                onSearch={(val) => { setSearch(val); setOffset(0); }}
                extraAction={
                    <button
                        onClick={() => navigate("/pos-order")}
                        style={styles.newBtn}
                    >
                        + Transaksi Baru
                    </button>
                }
            />

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
};

export default SalesOrderPage;