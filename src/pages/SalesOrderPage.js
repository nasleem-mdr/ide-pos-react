import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import "../App.css";

const SalesOrderPage = () => {
    const [orders, setOrders]           = useState([]);
    const [loading, setLoading]         = useState(false);
    const [search, setSearch]           = useState("");
    const [offset, setOffset]           = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const pageSize                      = 10;
    const navigate                      = useNavigate();

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
            // Format tanggal hari ini: YYYY-MM-DD
            const today = new Date().toISOString().split("T")[0];

            let filterClause =
                `IsSOTrx eq true` +
                ` and CreatedBy eq ${loginUserId}` +
                ` and Created ge ${today}T00:00:00Z` +
                ` and Created le ${today}T23:59:59Z`;

            // Tambah filter pencarian berdasarkan DocumentNo
            if (search) {
                filterClause += ` and contains(tolower(DocumentNo),'${search.toLowerCase()}')`;
            }

            const res = await customFetch(
                `/models/c_order` +
                `?$filter=${filterClause}` +
                `&$select=C_Order_ID,DocumentNo,DateOrdered,C_BPartner_ID,GrandTotal,DocStatus,M_PriceList_ID,M_Warehouse_ID,C_DocTypeTarget_ID` +
                `&$orderby=DateOrdered desc` +
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

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleEdit = (order) => {
        navigate("/pos-order", { state: { editOrder: order } });
    };

    // Konfigurasi kolom untuk DataTable
    const columns = [
        { key: "DocumentNo",    label: "No. Dokumen" },
        { key: "DateOrdered",   label: "Tanggal" },
        { key: "C_BPartner_ID", label: "Customer" },
        { key: "GrandTotal",    label: "Grand Total" },
        { key: "DocStatus",     label: "Status" },
        { key: "_actions",      label: "Aksi" },
    ];

    // Transform data agar sesuai format flat untuk DataTable
    const tableData = orders.map((order) => {
        const orderId  = order.id ?? order.C_Order_ID;
        const status   = order.DocStatus?.id ?? order.DocStatus ?? "DR";

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
            _actions: (
                <button
                    onClick={() => status === "DR" ? handleEdit(order) : null}
                    disabled={status !== "DR"}
                    style={{
                        ...styles.editBtn,
                        backgroundColor: status === "DR" ? "#f57c00" : "#ccc",
                        cursor:          status === "DR" ? "pointer"  : "not-allowed",
                        opacity:         status === "DR" ? 1          : 0.6,
                    }}
                >
                    ✏️ Edit
                </button>
            ),
        };
    });

    return (
        <div className="card-container">
            {/* PageHeader dengan search — sama seperti BusinessPartner */}
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

            {/* DataTable dengan pagination — sama seperti BusinessPartner */}
            <DataTable
                columns={columns}
                data={tableData}
                loading={loading}
                offset={offset}
                pageSize={pageSize}
                totalRecords={totalRecords}
                onPageChange={(newOffset) => setOffset(newOffset)}
            />
        </div>
    );
};

const styles = {
    newBtn:  { backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    badge:   { color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
    editBtn: { backgroundColor: "#f57c00", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" },
};

export default SalesOrderPage;