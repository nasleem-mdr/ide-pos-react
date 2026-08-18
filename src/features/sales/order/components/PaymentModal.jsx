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
                    const orgId = adOrgId ? parseInt(adOrgId) : null;
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

    // Helper Format Angka Ribuan
    const formatCurrency = (val) => {
        return (parseFloat(val) || 0).toLocaleString("id-ID");
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
            alert(`Pembayaran masih kurang! Kurang: Rp ${formatCurrency(remainingAmount)}`);
            return;
        }

        if (payments.length > 1 && Math.abs(remainingAmount) > 0.01) {
            alert(
                `Untuk pembayaran gabungan (lebih dari 1 metode), total bayar harus PERSIS sama ` +
                `dengan total tagihan (tidak boleh ada kembalian). Selisih saat ini: Rp ${formatCurrency(remainingAmount)}.`
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
            <div style={styles.modalCard}>
                {/* Header Banner */}
                <div style={styles.headerBanner}>
                    POS PAYMENT
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Ringkasan Nominal Utama */}
                    <div style={styles.summarySection}>
                        {/* Total Tagihan */}
                        <div style={styles.summaryRow}>
                            <div style={styles.summaryLabelGroup}>
                                <span style={styles.summaryLabel}>TOTAL TAGIHAN</span>
                                <span style={styles.summaryColon}>:</span>
                            </div>
                            <div style={styles.summaryValueBox}>
                                {formatCurrency(totalOrderAmount)}
                            </div>
                        </div>

                        {/* Total Pembayaran */}
                        <div style={styles.summaryRow}>
                            <div style={styles.summaryLabelGroup}>
                                <span style={styles.summaryLabel}>TOTAL PEMBAYARAN</span>
                                <span style={styles.summaryColon}>:</span>
                            </div>
                            <div style={styles.summaryValueBox}>
                                {formatCurrency(totalPaid)}
                            </div>
                        </div>

                        {/* Status (Kembalian / Kurang) */}
                        <div style={styles.summaryRow}>
                            <div style={styles.summaryLabelGroup}>
                                <span style={styles.summaryLabel}>
                                    STATUS ({remainingAmount <= 0 ? (
                                        <span style={{ color: "#008a00" }}>KEMBALIAN</span>
                                    ) : (
                                        <span style={{ color: "#d32f2f" }}>KURANG</span>
                                    )})
                                </span>
                                <span style={styles.summaryColon}>:</span>
                            </div>
                            <div style={{
                                ...styles.summaryValueBox,
                                color: remainingAmount <= 0 ? "#008a00" : "#d32f2f"
                            }}>
                                {formatCurrency(Math.abs(remainingAmount))}
                            </div>
                        </div>
                    </div>

                    {/* Baris Input Pembayaran */}
                    <div style={styles.paymentsList}>
                        {payments.map((row) => (
                            <div key={row.id} style={styles.paymentRow}>
                                <div style={styles.colMethod}>
                                    <label style={styles.fieldLabel}>Metode Pembayaran</label>
                                    <select
                                        required
                                        value={row.C_POSTenderType_ID}
                                        onChange={(e) => handleRowChange(row.id, "C_POSTenderType_ID", e.target.value)}
                                        style={styles.selectInput}
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

                                            return (
                                                <option key={stringId || Math.random()} value={stringId}>
                                                    {displayName}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div style={styles.colAmount}>
                                    <label style={styles.fieldLabel}>Jumlah Pembayaran</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="0"
                                        value={row.PayAmt}
                                        onChange={(e) => handleRowChange(row.id, "PayAmt", e.target.value)}
                                        style={styles.numberInput}
                                        disabled={isLoading}
                                    />
                                </div>

                                <div style={styles.colActions}>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRow(row.id)}
                                        style={styles.removeBtn}
                                        disabled={payments.length === 1 || isLoading}
                                        title="Hapus Metode"
                                    >
                                        X
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAddRow}
                                        style={styles.addBtn}
                                        disabled={isLoading}
                                        title="Tambah Metode"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Kas / Bank Tujuan Box */}
                    {isSingleCashPayment && (
                        <div style={styles.bankAccountContainer}>
                            <label style={styles.bankAccountLabel}>Kas / Bank Tujuan</label>
                            <select
                                required
                                value={selectedBankAccountId}
                                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                style={styles.selectInput}
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

                    {/* Footer / Action Buttons */}
                    <div style={styles.footer}>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            style={styles.cancelBtn} 
                            disabled={isLoading}
                        >
                            Batal
                        </button>
                        <button 
                            type="submit" 
                            style={styles.submitBtn} 
                            disabled={isLoading}
                        >
                            {isLoading ? "Memproses..." : "Bayar / Selesai"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── STYLES (SESUAI DENGAN DESAIN GAMBAR) ─────────────────────────────────
const styles = {
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        fontFamily: "'Aptos', 'Segoe UI', Arial, sans-serif"
    },
    modalCard: {
        backgroundColor: "#fcfcfc",
        padding: "24px",
        borderRadius: "28px",
        border: "1.5px solid #1e1e1e",
        width: "520px",
        maxWidth: "95%",
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        boxSizing: "border-box"
    },
    headerBanner: {
        backgroundColor: "#1e1e1e",
        color: "#ffffff",
        textAlign: "center",
        fontWeight: "900",
        fontSize: "24px",
        padding: "10px 0",
        borderRadius: "20px",
        marginBottom: "24px",
        letterSpacing: "0.5px"
    },
    summarySection: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        marginBottom: "20px"
    },
    summaryRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
    },
    summaryLabelGroup: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "210px",
        fontWeight: "800",
        fontSize: "17px",
        color: "#1e1e1e"
    },
    summaryLabel: {
        letterSpacing: "-0.2px"
    },
    summaryColon: {
        fontWeight: "bold",
        marginRight: "8px"
    },
    summaryValueBox: {
        flex: 1,
        border: "1.5px solid #222222",
        borderRadius: "20px",
        padding: "8px 16px",
        textAlign: "right",
        fontWeight: "900",
        fontSize: "32px",
        lineHeight: "1",
        backgroundColor: "#ffffff",
        color: "#1e1e1e",
        minHeight: "42px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end"
    },
    paymentsList: {
        marginBottom: "16px"
    },
    paymentRow: {
        display: "flex",
        alignItems: "flex-end",
        gap: "10px",
        marginBottom: "10px"
    },
    colMethod: {
        flex: 1
    },
    colAmount: {
        flex: 1
    },
    colActions: {
        display: "flex",
        gap: "6px",
        alignItems: "center",
        paddingBottom: "2px"
    },
    fieldLabel: {
        display: "block",
        fontSize: "14px",
        fontWeight: "bold",
        marginBottom: "4px",
        color: "#1e1e1e",
        textAlign: "center"
    },
    selectInput: {
        width: "100%",
        padding: "8px 12px",
        borderRadius: "16px",
        border: "1.5px solid #222222",
        backgroundColor: "#ffffff",
        fontSize: "15px",
        fontWeight: "bold",
        color: "#1e1e1e",
        outline: "none",
        boxSizing: "border-box",
        cursor: "pointer"
    },
    numberInput: {
        width: "100%",
        padding: "8px 12px",
        borderRadius: "16px",
        border: "1.5px solid #222222",
        backgroundColor: "#ffffff",
        fontSize: "20px",
        fontWeight: "800",
        textAlign: "right",
        color: "#1e1e1e",
        outline: "none",
        boxSizing: "border-box"
    },
    removeBtn: {
        backgroundColor: "#ff0000",
        color: "#ffffff",
        border: "none",
        borderRadius: "6px",
        width: "36px",
        height: "36px",
        fontWeight: "bold",
        fontSize: "18px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    addBtn: {
        backgroundColor: "#008a00",
        color: "#ffffff",
        border: "none",
        borderRadius: "6px",
        width: "36px",
        height: "36px",
        fontWeight: "bold",
        fontSize: "22px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    bankAccountContainer: {
        backgroundColor: "#fcd6b5",
        borderRadius: "14px",
        padding: "12px",
        marginBottom: "20px"
    },
    bankAccountLabel: {
        display: "block",
        fontSize: "15px",
        fontWeight: "bold",
        marginBottom: "6px",
        color: "#1e1e1e"
    },
    footer: {
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        marginTop: "10px"
    },
    cancelBtn: {
        backgroundColor: "#b0b0b0",
        color: "#1e1e1e",
        border: "none",
        padding: "10px 36px",
        borderRadius: "20px",
        fontSize: "16px",
        fontWeight: "bold",
        cursor: "pointer"
    },
    submitBtn: {
        backgroundColor: "#008a00",
        color: "#ffffff",
        border: "none",
        padding: "10px 28px",
        borderRadius: "20px",
        fontSize: "16px",
        fontWeight: "bold",
        cursor: "pointer"
    }
};

export default PaymentModal;
