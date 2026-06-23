import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import "../App.css";

const RequisitionList = () => {
    const [requisitions, setRequisitions]             = useState([]);
    const [loading, setLoading]           = useState(false);
    const [search, setSearch]             = useState("");
    const [offset, setOffset]             = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalLinesAll, setTotalLinesAll] = useState(null); 
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

    const fetchRequisitions = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setLoading(true);
        try {
            const today = new Date().toISOString().split("T")[0];

            let filterClause =
                ` CreatedBy eq ${loginUserId}` +
                ` and Created ge ${today}T00:00:00Z` +
                ` and Created le ${today}T23:59:59Z`;

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
    }, [offset, search]);

    // Fetch total GrandTotal seluruh halaman — hanya dipicu saat filter berubah (bukan saat ganti halaman)
    const fetchTotalLines = useCallback(async () => {
        const loginUserId = localStorage.getItem("AD_User_ID");
        if (!loginUserId) return;

        setTotalLinesAll(null); // reset saat filter berubah
        try {
            const today = new Date().toISOString().split("T")[0];

            let filterClause =
                ` CreatedBy eq ${loginUserId}` +
                ` and Created ge ${today}T00:00:00Z` +
                ` and Created le ${today}T23:59:59Z`;

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
    }, [search]); // hanya search — bukan offset

    useEffect(() => {
        fetchRequisitions();
    }, [fetchRequisitions]);

    useEffect(() => {
        fetchTotalLines();
    }, [fetchTotalLines]);

    const handleEdit = (requisition) => {
        navigate("/requisition", { state: { editRequisition: requisition } });
    };

    // Format total seluruh halaman dari state (null = sedang loading)
    const totalLinesFormatted = totalLinesAll === null
        ? "Menghitung..."
        : ` ${totalLinesAll.toLocaleString("id-ID")}`;

    const columns = [
        { key: "DocumentNo",    label: "No. Dokumen" },
        { key: "DateDoc",   label: "Tanggal" },
        { key: "M_Warehouse_ID", label: "Customer" },
        { key: "TotalLines",    label: "Total Lines", align: "right" },
        { key: "DocStatus",     label: "Status", align: "center" },
    ];

    const tableData = requisitions.map((requisition) => {
        const requisitionId = requisition.id ?? requisition.M_Requisition_ID;
        const status  = requisition.DocStatus?.id ?? requisition.DocStatus ?? "DR";

        return {
            ...requisition,
            _requisitionId:    requisitionId,
            _status:     status,
            DocumentNo:  requisition.DocumentNo || `#${requisitionId}`,
            DateDoc: requisition.DateDoc
                ? new Date(requisition.DateDoc).toLocaleDateString("id-ID")
                : "-",
            "M_Warhouse_ID": requisition.M_Warhouse_ID?.identifier
                || requisiton.M_Warehouse_ID?.Name
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
};

export default RequisitionList;