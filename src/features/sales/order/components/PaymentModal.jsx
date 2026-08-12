import React, { useState, useEffect } from "react";

const PaymentModal = ({ 
    isOpen, 
    onClose, 
    totalOrderAmount = 0, 
    onSubmitPayment,
    idempiereApi, 
    adOrgId
}) => {
    // ─── STATE MANAGEMENT ──────────────────────────────────────────────────
    const [tenderTypes, setTenderTypes] = useState([]);
    const [payments, setPayments] = useState([
        { id: Date.now(), C_POSTenderType_ID: "", TenderType: "", PayAmt: "" }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    // ─── KAS/BANK ACCOUNT TUJUAN ──────────────────────────────────────────
    const [bankAccounts, setBankAccounts] = useState([]);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState("");

    // Reset state setiap modal dibuka
    useEffect(() => {
        if (isOpen) {
            setPayments([
                { id: Date.now(), C_POSTenderType_ID: "", TenderType: "", PayAmt: totalOrderAmount || "" }
            ]);
            setIsLoading(false);
        }
    }, [isOpen, totalOrderAmount]);

    // ─── AMBIL DATA TENDER TYPE ─────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            const fetchTenderTypes = async () => {
                try {
                    const response = await idempiereApi("/models/c_postendertype?$filter=IsActive eq true");
                    const records = response.records || response || [];
                    setTenderTypes(records);

                    // Auto select tender type pertama jika baru dibuka
                    if (records.length > 0) {
                        const first = records[0];
                        const firstId = first.id?.id ?? first.id ?? first.C_POSTenderType_ID;
                        const firstCode = typeof first.TenderType === "object" ? (first.TenderType.id || "X") : (first.TenderType || "X");

                        setPayments([{
                            id: Date.now(),
                            C_POSTenderType_ID: String(firstId),
                            TenderType: firstCode,
                            PayAmt: totalOrderAmount || ""
                        }]);
                    }
                } catch (err) {
                    console.error("Gagal mengambil data C_POSTenderType:", err);
                }
            };
            fetchTenderTypes();
        }
    }, [isOpen, totalOrderAmount]);

    // ─── AMBIL DATA C_BANKACCOUNT ─────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            const fetchBankAccounts = async () => {
                try {
                    const orgId  = adOrgId ? parseInt(adOrgId) : null;
                    const filter = orgId
                        ? `IsActive eq true and (AD_Org_ID eq 0 or AD_Org_ID eq ${orgId})`
                        : `IsActive eq true`;
                    const query = `/models/c_bankaccount?$filter=${filter}`;
                    const response = await idempiereApi(query);
                    const records = response.records || response || [];
                    setBankAccounts(records);

                    const defaultAcct = records.find(b => b.IsDefault === true || b.IsDefault === "Y");
                    const fallback = defaultAcct || records[0];
                    if (fallback) {
                        const fallbackId = fallback.id?.id ?? fallback.id ?? fallback.C_BankAccount_ID;
                        setSelectedBankAccountId(fallbackId ? String(fallbackId) : "");
                    }
                } catch (err) {
                    console.error("Gagal mengambil data C_BankAccount:", err);
                }
            };
            fetchBankAccounts();
        }
    }, [isOpen, adOrgId]);

    if (!isOpen) return null;

    // ─── KALKULASI NOMINAL KASIR ───────────────────────────────────────────
    const totalPaid = payments.reduce((sum, item) => sum + (parseFloat(item.PayAmt) || 0), 0);
    const remainingAmount = totalOrderAmount - totalPaid;

    const isSingleCashPayment = payments.length === 1 && payments[0].TenderType === "X";

    const getBankAccountLabel = (b) => {
        let name = b.Name;
        if (name && typeof name === "object") name = name.identifier || name.propertyLabel || "";
        if (!name && b.identifier) name = typeof b.identifier === "object" ? b.identifier.identifier : b.identifier;
        const acctNo = typeof b.AccountNo === "object" ? (b.AccountNo?.identifier || "") : (b.AccountNo || "");
        return acctNo ? `${name || "Kas"} - ${acctNo}` : (name || "Kas Tanpa Nama");
    };

    // ─── HANDLER FORM ──────────────────────────────────────────────────────
    const handleAddRow = () => {
        const defaultAmt = remainingAmount > 0 ? remainingAmount : "";
        setPayments([
            ...payments,
            { id: Date.now(), C_POSTenderType_ID: "", TenderType: "", PayAmt: defaultAmt }
        ]);
    };

    const handleRemoveRow = (id) => {
        if (payments.length === 1) return;
        setPayments(payments.filter(item => item.id !== id));
    };

    const handleRowChange = (id, field, value) => {
        const updated = payments.map((row) => {
            if (row.id === id) {
                if (field === "C_POSTenderType_ID") {
                    const selected = tenderTypes.find(t => {
                        const targetId = t.id?.id ?? t.id ?? t.C_POSTenderType_ID;
                        return String(targetId) === String(value);
                    });

                    const rawTenderCode = typeof selected?.TenderType === "object" 
                        ? (selected?.TenderType?.id || "X") 
                        : (selected?.TenderType || "X");

                    return { 
                        ...row, 
                        C_POSTenderType_ID: value, 
                        TenderType: rawTenderCode
                    };
                }
                return { ...row, [field]: value };
            }
            return row;
        });
        setPayments(updated);
    };

    // ─── SUBMIT HANDLER ────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (totalPaid < totalOrderAmount) {
            alert(`Pembayaran masih kurang! Kurang: Rp ${remainingAmount.toLocaleString()}`);
            return;
        }

        if (payments.length > 1 && Math.abs(remainingAmount) > 0.01) {
            alert(
                `Untuk pembayaran gabungan (lebih dari 1 metode), total bayar harus PERSIS sama ` +
                `dengan total tagihan (tidak boleh ada kembalian). Selisih saat ini: Rp ${remainingAmount.toLocaleString()}.`
            );
            return;
        }

        setIsLoading(true);

        try {
            const cleanPayments = payments.map(({ C_POSTenderType_ID, TenderType, PayAmt }) => ({
                C_POSTenderType_ID: parseInt(C_POSTenderType_ID),
                TenderType: TenderType,
                PayAmt: parseFloat(PayAmt)
            }));

            const bankAccountId = selectedBankAccountId ? parseInt(selectedBankAccountId) : null;

            // Panggil onSubmitPayment (yang terhubung ke completeAndSettle)
            await onSubmitPayment(cleanPayments, bankAccountId);
            onClose();
        } catch (error) {
            console.error("Gagal submit pembayaran:", error);
            alert(`Gagal memproses pembayaran: ${error.message || "Terjadi kesalahan pada server"}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modalBox}>
                <div style={styles.header}>
                    <h3 style={{ margin: 0 }}>Pembayaran POS</h3>
                    <button onClick={onClose} style={styles.closeBtn} disabled={isLoading}>✕</button>
                </div>

                <div style={styles.summaryContainer}>
                    <div style={styles.summaryRow}>
                        <span>Total Tagihan:</span>
                        <strong>Rp {totalOrderAmount.toLocaleString()}</strong>
                    </div>
                    <div style={styles.summaryRow}>
                        <span>Total Dibayar:</span>
                        <span style={{ color: "green", fontWeight: "bold" }}>Rp {totalPaid.toLocaleString()}</span>
                    </div>
                    <div style={styles.summaryRow}>
                        <span>Status Nominal:</span>
                        <strong style={{ color: remainingAmount <= 0 ? "blue" : "red" }}>
                            {remainingAmount <= 0 
                                ? `Kembalian: Rp ${Math.abs(remainingAmount).toLocaleString()}` 
                                : `Kurang: Rp ${remainingAmount.toLocaleString()}`}
                        </strong>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: "left" }}>Metode Pembayaran</th>
                                    <th style={{ textAlign: "left" }}>Jumlah Bayar</th>
                                    <th style={{ width: "50px" }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((row) => (
                                    <tr key={row.id}>
                                        <td style={{ padding: "4px" }}>
                                            <select
                                                required
                                                value={row.C_POSTenderType_ID}
                                                onChange={(e) => handleRowChange(row.id, "C_POSTenderType_ID", e.target.value)}
                                                style={styles.input}
                                                disabled={isLoading}
                                            >
                                                <option value="">-- Pilih Cara Bayar --</option>
                                                {tenderTypes.map((t) => {
                                                    const rawId = t.id?.id ?? t.id ?? t.C_POSTenderType_ID;
                                                    const stringId = rawId ? String(rawId) : "";

                                                    let displayName = "Cara Bayar";
                                                    if (t.Name) {
                                                        displayName = typeof t.Name === "object" ? (t.Name.identifier || t.Name.propertyLabel) : t.Name;
                                                    } else if (t.identifier) {
                                                        displayName = typeof t.identifier === "object" ? t.identifier.identifier : t.identifier;
                                                    }

                                                    const tenderCode = typeof t.TenderType === "object" ? (t.TenderType.id || "X") : (t.TenderType || "X");

                                                    return (
                                                        <option key={stringId || Math.random()} value={stringId}>
                                                            {displayName} ({tenderCode})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                placeholder="0"
                                                value={row.PayAmt}
                                                onChange={(e) => handleRowChange(row.id, "PayAmt", e.target.value)}
                                                style={styles.input}
                                                disabled={isLoading}
                                            />
                                        </td>
                                        <td style={{ textAlign: "center", padding: "4px" }}>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveRow(row.id)} 
                                                style={styles.deleteRowBtn}
                                                disabled={payments.length === 1 || isLoading}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button 
                        type="button" 
                        onClick={handleAddRow} 
                        style={styles.addBtn}
                        disabled={isLoading}
                    >
                        + Tambah Metode
                    </button>

                    {isSingleCashPayment && (
                        <div style={styles.bankAccountContainer}>
                            <label style={styles.bankAccountLabel}>Kas Tujuan (Penerimaan Cash):</label>
                            <select
                                required
                                value={selectedBankAccountId}
                                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                style={styles.input}
                                disabled={isLoading}
                            >
                                <option value="">-- Pilih Kas/Bank --</option>
                                {bankAccounts.map((b) => {
                                    const rawId = b.id?.id ?? b.id ?? b.C_BankAccount_ID;
                                    const stringId = rawId ? String(rawId) : "";
                                    return (
                                        <option key={stringId || Math.random()} value={stringId}>
                                            {getBankAccountLabel(b)}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    <div style={styles.footer}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isLoading}>
                            Batal
                        </button>
                        <button type="submit" style={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? "Memproses Transaksi..." : "Bayar & Selesai"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
    modalBox: { backgroundColor: "#fff", padding: "20px", borderRadius: "8px", width: "550px", maxWidth: "90%", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px", marginBottom: "15px" },
    closeBtn: { background: "none", border: "none", fontSize: "18px", cursor: "pointer" },
    summaryContainer: { backgroundColor: "#f9f9f9", padding: "12px", borderRadius: "6px", marginBottom: "15px", border: "1px solid #eee" },
    summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
    tableWrapper: { maxHeight: "200px", overflowY: "auto", marginBottom: "10px" },
    table: { width: "100%", borderCollapse: "collapse" },
    input: { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" },
    deleteRowBtn: { backgroundColor: "#ff4d4d", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" },
    addBtn: { backgroundColor: "#2196F3", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", marginBottom: "15px" },
    bankAccountContainer: { backgroundColor: "#fff8e1", border: "1px solid #ffe082", borderRadius: "6px", padding: "10px 12px", marginBottom: "16px" },
    bankAccountLabel: { display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "6px", color: "#5d4a00" },
    footer: { display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #ddd", paddingTop: "15px" },
    cancelBtn: { backgroundColor: "#ccc", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer" },
    submitBtn: { backgroundColor: "#4CAF50", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }
};

export default PaymentModal;