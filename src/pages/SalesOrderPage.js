import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SalesOrderPage = () => {
    const [orders, setOrders]   = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate              = useNavigate();

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

    useEffect(() => {
        const fetchDraftOrders = async () => {
            try {
                const loginUserId = localStorage.getItem("AD_User_ID");
                if (!loginUserId) return;
    
                // Format tanggal hari ini: YYYY-MM-DD
                const today = new Date().toISOString().split("T")[0];
    
                const res = await customFetch(
                    `/models/c_order?$filter=IsSOTrx eq true` +
                    ` and CreatedBy eq ${loginUserId}` +
                    ` and Created ge '${today}T00:00:00'` +
                    ` and Created le '${today}T23:59:59'` +
                    `&$select=C_Order_ID,DocumentNo,DateOrdered,C_BPartner_ID,GrandTotal,DocStatus,M_PriceList_ID,M_Warehouse_ID,C_DocTypeTarget_ID` +
                    `&$orderby=DateOrdered desc&$top=50`
                );
                setOrders(Array.isArray(res.records) ? res.records : []);
            } catch (err) {
                console.error("Gagal fetch orders:", err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDraftOrders();
    }, []);

    const handleEdit = (order) => {
        // Kirim data order ke POSContainer via router state
        navigate("/pos-order", { state: { editOrder: order } });
    };

    const getStatusLabel = (status) => {
        const map = { DR: "Draft", IP: "In Progress", CO: "Completed", VO: "Voided", RE: "Reversed" };
        return map[status] || status;
    };

    const getStatusColor = (status) => {
        const map = { DR: "#f57c00", CO: "#2e7d32", VO: "#c62828", IP: "#1565c0" };
        return map[status] || "#555";
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{ margin: 0 }}>📋 Sales Order — Draft</h2>
                <button onClick={() => navigate("/pos-order")} style={styles.newBtn}>
                    + Transaksi Baru
                </button>
            </div>

            {loading ? (
                <p>Memuat data...</p>
            ) : orders.length === 0 ? (
                <p style={{ color: "#999", textAlign: "center", marginTop: "40px" }}>
                    Tidak ada transaksi draft.
                </p>
            ) : (
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.thead}>
                                <th style={styles.th}>No. Dokumen</th>
                                <th style={styles.th}>Tanggal</th>
                                <th style={styles.th}>Customer</th>
                                <th style={styles.th}>Grand Total</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => {
                                const orderId  = order.id ?? order.C_Order_ID;
                                const docNo    = order.DocumentNo || `#${orderId}`;
                                const date     = order.DateOrdered
                                    ? new Date(order.DateOrdered).toLocaleDateString("id-ID")
                                    : "-";
                                const customer = order.C_BPartner_ID?.identifier
                                    || order.C_BPartner_ID?.Name
                                    || "-";
                                const total    = parseFloat(order.GrandTotal || 0)
                                    .toLocaleString("id-ID");
                                const status   = order.DocStatus?.id ?? order.DocStatus ?? "DR";

                                return (
                                    <tr key={orderId} style={styles.tr}>
                                        <td style={styles.td}><strong>{docNo}</strong></td>
                                        <td style={styles.td}>{date}</td>
                                        <td style={styles.td}>{customer}</td>
                                        <td style={{ ...styles.td, textAlign: "right" }}>
                                            Rp {total}
                                        </td>
                                        <td style={styles.td}>
                                            <span style={{
                                                ...styles.badge,
                                                backgroundColor: getStatusColor(status),
                                            }}>
                                                {getStatusLabel(status)}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
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
                                      </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const styles = {
    container:    { padding: "24px", fontFamily: "Arial, sans-serif", maxWidth: "1100px", margin: "0 auto" },
    header:       { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
    newBtn:       { backgroundColor: "#1976d2", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    tableWrapper: { overflowX: "auto", borderRadius: "8px", border: "1px solid #e0e0e0" },
    table:        { width: "100%", borderCollapse: "collapse" },
    thead:        { backgroundColor: "#f5f5f5" },
    th:           { padding: "12px 16px", textAlign: "left", fontSize: "13px", fontWeight: "bold", color: "#333", borderBottom: "2px solid #ddd" },
    tr:           { borderBottom: "1px solid #eee", transition: "background 0.15s" },
    td:           { padding: "11px 16px", fontSize: "13px", color: "#333", verticalAlign: "middle" },
    badge:        { color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
    editBtn:      { backgroundColor: "#f57c00", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" },
};

export default SalesOrderPage;
