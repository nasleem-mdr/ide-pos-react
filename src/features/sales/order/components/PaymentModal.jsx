import React, { useState, useEffect } from "react";

const PaymentModal = ({ 
    isOpen, 
    onClose, 
    totalOrderAmount, 
    onSubmitPayment,
    customFetch // Menggunakan handler API Anda
}) => {
    // ─── STATE MANAGEMENT ──────────────────────────────────────────────────
    const [tenderTypes, setTenderTypes] = useState([]); // Data dari C_POSTenderType
    const [payments, setPayments] = useState([
        { id: Date.now(), C_POSTenderType_ID: "", TenderType: "", PayAmt: "" }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    // ─── AMBIL DATA TENDER TYPE DARI IDEMPIERE ──────────────────────────────
    useEffect(() => {
        if (isOpen) {
            const fetchTenderTypes = async () => {
                try {
                    // Ambil konfigurasi cara bayar aktif di terminal iDempiere
                    const response = await customFetch("/models/c_postendertype");
                    // Pastikan respons disesuaikan dengan format array REST API Anda
                    setTenderTypes(response.records || response || []);
                } catch (err) {
                    console.error("Gagal mengambil data C_POSTenderType:", err);
                }
            };
            fetchTenderTypes();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // ─── KALKULASI NOMINAL KASIR ───────────────────────────────────────────
    const totalPaid = payments.reduce((sum, item) => sum + (parseFloat(item.PayAmt) || 0), 0);
    const remainingAmount = totalOrderAmount - totalPaid;

    // ─── LOGIKA MANIPULASI FORM BARIS ──────────────────────────────────────
    const handleAddRow = () => {
        // Otomatis isi nilai sisa pembayaran pada baris baru agar kasir lebih cepat bekerja
        const defaultAmt = remainingAmount > 0 ? remainingAmount : "";
        setPayments([
            ...payments,
            { id: Date.now(), C_POSTenderType_ID: "", TenderType: "", PayAmt: defaultAmt }
        ]);
    };

    const handleRemoveRow = (id) => {
        if (payments.length === 1) return; // Sisakan minimal 1 baris
        setPayments(payments.filter(item => item.id !== id));
    };

    const handleRowChange = (id, field, value) => {
    const updated = payments.map((row) => {
            if (row.id === id) {
                if (field === "C_POSTenderType_ID") {
                    // Cari object asli dengan membandingkan ID murni secara aman
                    const selected = tenderTypes.find(t => {
                        const targetId = t.id?.id ?? t.id ?? t.C_POSTenderType_ID;
                        return String(targetId) === String(value);
                    });

                    // Ekstrak kode tender murni (misal: "X")
                    const rawTenderCode = selected?.TenderType?.id ?? selected?.TenderType ?? "X";

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


    // ─── SUBMIT KASIR KE CONTAINER UTAMA ───────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validasi: Pembayaran tidak boleh kurang dari total belanjaan
        if (totalPaid < totalOrderAmount) {
            alert(`Pembayaran masih kurang! Kurang: Rp ${remainingAmount.toLocaleString()}`);
            return;
        }

        setIsLoading(false);
        // Kirim array baris pembayaran bersih ke fungsi utama POSContainer
        const cleanPayments = payments.map(({ C_POSTenderType_ID, TenderType, PayAmt }) => ({
            C_POSTenderType_ID: parseInt(C_POSTenderType_ID),
            TenderType: TenderType,
            PayAmt: parseFloat(PayAmt)
        }));

        await onSubmitPayment(cleanPayments);
    };

    // ─── RENDERING TAMPILAN VISUAL MODAL ───────────────────────────────────
    return (
        <div style={styles.overlay}>
            <div style={styles.modalBox}>
                <div style={styles.header}>
                    <h3>Pembayaran POS (Mixed Mode)</h3>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                {/* Ringkasan Nilai Belanja */}
                <div style={styles.summaryContainer}>
                    <div style={styles.summaryRow}><span>Total Tagihan:</span><strong>Rp {totalOrderAmount.toLocaleString()}</strong></div>
                    <div style={styles.summaryRow}><span>Total Dibayar:</span><span style={{ color: "green" }}>Rp {totalPaid.toLocaleString()}</span></div>
                    <div style={styles.summaryRow}>
                        <span>Sisa Sisa / Kembalian:</span>
                        <strong style={{ color: remainingAmount <= 0 ? "blue" : "red" }}>
                            {remainingAmount <= 0 ? `Kembalian: Rp ${Math.abs(remainingAmount).toLocaleString()}` : `Kurang: Rp ${remainingAmount.toLocaleString()}`}
                        </strong>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th>Metode Pembayaran (C_POSTenderType)</th>
                                    <th>Jumlah Bayar (PayAmt)</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <select
                                                required
                                                value={row.C_POSTenderType_ID}
                                                onChange={(e) => handleRowChange(row.id, "C_POSTenderType_ID", e.target.value)}
                                                style={styles.input}
                                            >
                                                <option value="">-- Pilih Cara Bayar --</option>
                                                {tenderTypes.map((t) => {
                                                    // ─── AMANKAN EKSTRAKSI ID ──────────────────────────────────────────
                                                    // Mengantisipasi jika 'id' berupa object {id: 123} atau angka murni
                                                    const rawId = t.id?.id ?? t.id ?? t.C_POSTenderType_ID;
                                                    const stringId = rawId ? String(rawId) : "";

                                                    // ─── AMANKAN EKSTRAKSI NAMA (Bypass Object-as-a-Child Error) ──────
                                                    // Deteksi jika t.Name atau t.identifier berbentuk objek iDempiere kompleks
                                                    let displayName = "Cara Bayar Tanpa Nama";
                                                    if (t.Name) {
                                                        displayName = typeof t.Name === "object" ? (t.Name.identifier || t.Name.propertyLabel || JSON.stringify(t.Name)) : t.Name;
                                                    } else if (t.identifier) {
                                                        displayName = typeof t.identifier === "object" ? (t.identifier.identifier || JSON.stringify(t.identifier)) : t.identifier;
                                                    } else if (t.propertyLabel) {
                                                        displayName = t.propertyLabel;
                                                    }

                                                    // Ambil kode Tender Type (X, K, D, dll)
                                                    const tenderCode = typeof t.TenderType === "object" ? (t.TenderType.id || "X") : (t.TenderType || "X");

                                                    return (
                                                        <option key={t.id?.id || stringId || Math.random()} value={stringId}>
                                                            {displayName} ({tenderCode})
                                                        </option>
                                                    );
                                                })}
</select>

                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                placeholder="0"
                                                value={row.PayAmt}
                                                onChange={(e) => handleRowChange(row.id, "PayAmt", e.target.value)}
                                                style={styles.input}
                                            />
                                        </td>
                                        <td>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveRow(row.id)} 
                                                style={styles.deleteRowBtn}
                                                disabled={payments.length === 1}
                                            >
                                                Hapus
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button type="button" onClick={handleAddRow} style={styles.addBtn}>
                        + Tambah Baris Pembayaran
                    </button>

                    <div style={styles.footer}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isLoading}>Batal</button>
                        <button type="submit" style={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? "Memproses Transaksi..." : "Bayar & Selesaikan Selesai"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── STYLING OBJECT MURNI (BISA DIGANTI KE CSS KUSTOM ANDA) ───────────────
const styles = {
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
    modalBox: { backgroundColor: "#fff", padding: "20px", borderRadius: "8px", width: "550px", maxWidth: "90%", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" },
    header: { display: "flex", justifyContent: "between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px", marginBottom: "15px" },
    closeBtn: { background: "none", border: "none", fontSize: "18px", cursor: "pointer" },
    summaryContainer: { backgroundColor: "#f9f9f9", padding: "12px", borderRadius: "6px", marginBottom: "15px", border: "1px solid #eee" },
    summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
    tableWrapper: { maxHeight: "200px", overflowY: "auto", marginBottom: "10px" },
    table: { width: "100%", borderCollapse: "collapse" },
    input: { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-color" },
    deleteRowBtn: { backgroundColor: "#ff4d4d", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" },
    addBtn: { backgroundColor: "#2196F3", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "4px", cursor: "pointer", marginBottom: "20px" },
    footer: { display: "flex", justifyContent: "end", gap: "10px", borderTop: "1px solid #ddd", paddingTop: "15px" },
    cancelBtn: { backgroundColor: "#ccc", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer" },
    submitBtn: { backgroundColor: "#4CAF50", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }
};

export default PaymentModal;
