import React, { useState, useEffect } from "react";

const PaymentModal = ({ 
    isOpen, 
    onClose, 
    totalOrderAmount, 
    onSubmitPayment,
    idempiereApi, 
    adOrgId
}) => {
    // ─── STATE MANAGEMENT ──────────────────────────────────────────────────
    const [tenderTypes, setTenderTypes] = useState([]); // Data dari C_POSTenderType
    const [payments, setPayments] = useState([
        { id: Date.now(), C_POSTenderType_ID: "", TenderType: "", PayAmt: "" }
    ]);
    const [isLoading, setIsLoading] = useState(false);

    // ─── KAS/BANK ACCOUNT TUJUAN (khusus payment rule Cash) ─────────────────
    const [bankAccounts, setBankAccounts] = useState([]);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState("");

    // ─── AMBIL DATA TENDER TYPE DARI IDEMPIERE ──────────────────────────────
    useEffect(() => {
        if (isOpen) {
            const fetchTenderTypes = async () => {
                try {
                    // Ambil konfigurasi cara bayar aktif di terminal iDempiere
                    const response = await idempiereApi("/models/c_postendertype");
                    // Pastikan respons disesuaikan dengan format array REST API Anda
                    setTenderTypes(response.records || response || []);
                } catch (err) {
                    console.error("Gagal mengambil data C_POSTenderType:", err);
                }
            };
            fetchTenderTypes();
        }
    }, [isOpen]);

    // ─── AMBIL DATA C_BANKACCOUNT (untuk pilihan Kas/Bank tujuan saat Cash) ──
    useEffect(() => {
        if (isOpen) {
            const fetchBankAccounts = async () => {
                try {
                    // FIX: sebelumnya filter `AD_Org_ID eq {orgId}` secara ketat + `IsActive eq 'Y'`
                    // (string), yang bikin hasil kosong kalau C_BankAccount didefinisikan di Org 0
                    // (shared/HQ) — pola umum di iDempiere untuk Bank Account. Disamakan dengan
                    // pola yang sudah terbukti jalan di fetchPriceListOptions()/fetchBPartnerList():
                    // IsActive eq true (boolean) + (AD_Org_ID eq 0 or AD_Org_ID eq {orgId}).
                    const orgId  = adOrgId ? parseInt(adOrgId) : null;
                    const filter = orgId
                        ? `IsActive eq true and (AD_Org_ID eq 0 or AD_Org_ID eq ${orgId})`
                        : `IsActive eq true`;
                    const query = `/models/c_bankaccount?$filter=${filter}`;
                    const response = await idempiereApi(query);
                    const records = response.records || response || [];
                    setBankAccounts(records);

                    if (records.length === 0) {
                        console.warn("⚠️ Tidak ada C_BankAccount aktif ditemukan. Query:", query);
                    }

                    // Auto-pilih akun yang ditandai default (IsDefault), mengikuti perilaku
                    // MOrder.createPOSPayments() di iDempiere (order by IsDefault DESC)
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

    // ─── DETEKSI SKENARIO CASH TUNGGAL ──────────────────────────────────────
    // Sesuai logika di POSContainer: PaymentRule hanya jadi "B" (Cash) ketika
    // HANYA ADA 1 baris pembayaran dan TenderType-nya "X" (Cash). Untuk kasus ini
    // iDempiere butuh C_BankAccount_ID di header Order (sama seperti popup Kas
    // Tujuan yang muncul di client Swing/ZK saat PaymentRule = Cash).
    const isSingleCashPayment = payments.length === 1 && payments[0].TenderType === "X";

    // Ekstraksi nama akun bank secara aman (antisipasi field Name berbentuk objek)
    const getBankAccountLabel = (b) => {
        let name = b.Name;
        if (name && typeof name === "object") name = name.identifier || name.propertyLabel || "";
        if (!name && b.identifier) name = typeof b.identifier === "object" ? b.identifier.identifier : b.identifier;
        const acctNo = typeof b.AccountNo === "object" ? (b.AccountNo?.identifier || "") : (b.AccountNo || "");
        return acctNo ? `${name || "Kas"} - ${acctNo}` : (name || "Kas Tanpa Nama");
    };

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
            alert(`Pembayaran masih kurang! Kurang:  ${remainingAmount.toLocaleString()}`);
            return;
        }

        // Validasi khusus MIXED (>1 metode bayar): iDempiere mewajibkan total C_POSPayment
        // PERSIS SAMA dengan Grand Total (lihat createPOSPayments() — @POSPaymentDiffers@),
        // dan Mixed POS Payment diketahui belum reliable di instance ini. Kelebihan bayar
        // (kembalian) HANYA valid untuk Cash tunggal, tidak untuk Mixed.
        if (payments.length > 1 && Math.abs(remainingAmount) > 0.01) {
            alert(
                `Untuk pembayaran gabungan (lebih dari 1 metode), total bayar harus PERSIS sama ` +
                `dengan total tagihan (tidak boleh ada kembalian). Selisih saat ini: ${remainingAmount.toLocaleString()}. ` +
                `Sesuaikan nominal tiap baris, atau gunakan 1 metode bayar saja.`
            );
            return;
        }

        // Catatan: pilihan Kas Tujuan saat ini TIDAK di-kirim ke backend — C_BankAccount_ID
        // bukan kolom di C_Order, dan iDempiere me-resolve bank account secara otomatis saat
        // proses payment (lihat komentar di POSContainer.jsx). Jadi tidak lagi memblokir submit
        // di sini; dropdown-nya sementara bersifat informasional sampai ada endpoint khusus
        // untuk membuat C_Payment/AR Receipt secara eksplisit dengan bank account pilihan user.

        setIsLoading(false);
        // Kirim array baris pembayaran bersih ke fungsi utama POSContainer
        const cleanPayments = payments.map(({ C_POSTenderType_ID, TenderType, PayAmt }) => ({
            C_POSTenderType_ID: parseInt(C_POSTenderType_ID),
            TenderType: TenderType,
            PayAmt: parseFloat(PayAmt)
        }));

        // Kirim C_BankAccount_ID sebagai argumen kedua, hanya relevan saat Cash tunggal
        const bankAccountId = isSingleCashPayment ? parseInt(selectedBankAccountId) : null;

        console.log("💳 Submit pembayaran:", {
            jumlahBaris: cleanPayments.length,
            payments: cleanPayments,
            bankAccountId,
            catatan: cleanPayments.length === 1
                ? "1 baris → PaymentRule akan dihitung dari TenderType baris ini (X=Cash→B, K=CreditCard→K, D=DirectDeposit→T)"
                : "Lebih dari 1 baris → PaymentRule akan jadi Mixed (M), wajib total pas.",
        });

        await onSubmitPayment(cleanPayments, bankAccountId);
    };

    // ─── RENDERING TAMPILAN VISUAL MODAL ───────────────────────────────────
    return (
        <div style={styles.overlay}>
            <div style={styles.modalBox}>
                <div style={styles.header}>
                    <h3>Pembayaran POS</h3>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                {/* Ringkasan Nilai Belanja */}
                <div style={styles.summaryContainer}>
                    <div style={styles.summaryRow}><span>Total Tagihan:</span><strong>{totalOrderAmount.toLocaleString()}</strong></div>
                    <div style={styles.summaryRow}><span>Total Dibayar:</span><span style={{ color: "green" }}> {totalPaid.toLocaleString()}</span></div>
                    <div style={styles.summaryRow}>
                        <span>Kurang/Kembali:</span>
                        <strong style={{ color: remainingAmount <= 0 ? "blue" : "red" }}>
                            {remainingAmount <= 0 ? `Kembalian:  ${Math.abs(remainingAmount).toLocaleString()}` : `Kurang:  ${remainingAmount.toLocaleString()}`}
                        </strong>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th>Metode Pembayaran</th>
                                    <th>Jumlah Bayar</th>
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
                                                <svg 
                                                    fill="#fff" 
                                                    width="32px" 
                                                    height="32px" 
                                                    viewBox="0 0 256 256" 
                                                    id="Flat" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M128,24A104,104,0,1,0,232,128,104.12041,104.12041,0,0,0,128,24Zm40,112H88a8,8,0,0,1,0-16h80a8,8,0,0,1,0,16Z"/>
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button type="button" onClick={handleAddRow} style={styles.addBtn}>
                        + 
                    </button>

                    {/* Kas Tujuan — hanya tampil jika pembayaran Cash tunggal */}
                    {isSingleCashPayment && (
                        <div style={styles.bankAccountContainer}>
                            <label style={styles.bankAccountLabel}>Kas Tujuan (Penerimaan Cash):</label>
                            <select
                                required
                                value={selectedBankAccountId}
                                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                style={styles.input}
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
                            {bankAccounts.length === 0 && (
                                <div style={styles.bankAccountHint}>
                                    Tidak ada Kas/Bank Account aktif ditemukan untuk Org ini.
                                </div>
                            )}
                            <div style={styles.bankAccountHint}>
                                * Kas tujuan aktual di-resolve otomatis oleh iDempiere saat proses payment.
                            </div>
                        </div>
                    )}

                    <div style={styles.footer}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isLoading}>Batal</button>
                        <button type="submit" style={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? "Memproses Transaksi..." : "Bayar & Selesai"}
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
    bankAccountContainer: { backgroundColor: "#fff8e1", border: "1px solid #ffe082", borderRadius: "6px", padding: "10px 12px", marginBottom: "16px" },
    bankAccountLabel: { display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "6px", color: "#5d4a00" },
    bankAccountHint: { fontSize: "11px", color: "#b71c1c", marginTop: "4px" },
    footer: { display: "flex", justifyContent: "end", gap: "10px", borderTop: "1px solid #ddd", paddingTop: "15px" },
    cancelBtn: { backgroundColor: "#ccc", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer" },
    submitBtn: { backgroundColor: "#4CAF50", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }
};

export default PaymentModal;
