import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PageHeader } from "@/shared/components";
import { idempiereApi } from "@/api/idempiereApi";
import { renderPivotListPDF } from "@/utils/pdf/renderPivotListPDF"; // duplikasi khusus laporan grouped/pivot
import { useOrgInfo } from "@/shared/hooks/useOrgInfo";
import * as XLSX from "xlsx"; // npm install xlsx (kalau belau ada di project) -> "xlsx" : "^0.18.5"
import "@/App.css";

/**
 * GeneralLedgerReport — Laporan Buku Besar (dari Fact_Acct)
 * ─────────────────────────────────────────────────────────────────────────
 * Jurnal posting per akun dengan BALANCE KUMULATIF:
 *     Balance = SaldoAwal + Σ(AmtAcctDr − AmtAcctCr) s.d. baris tsb.
 *
 * ─── PERLAKUAN BERBEDA: NERACA vs LABA-RUGI ─────────────────────────────
 * Fact_Acct tidak punya kolom balance, jadi saldo awal dihitung di JS —
 * dan dasar perhitungannya BERBEDA per jenis akun:
 *
 *   • Akun NERACA (Asset/A, Liability/L, Equity/O):
 *     SALDO AWAL = Σ(Dr−Cr) dari SEMUA histori posting sebelum Date From.
 *     Akun neraca akumulatif sejak awal mula, tidak pernah reset.
 *
 *   • Akun LABA-RUGI (Expense/E, Revenue/R):
 *     SALDO AWAL = Σ(Dr−Cr) dari AWAL TAHUN FISKAL sampai Date From.
 *     Posting tahun fiskal sebelumnya DIABAIKAN TOTAL — laba-rugi reset
 *     tiap tahun. (Fiscal year start diatur via FY_START_MONTH di bawah.)
 *
 * ─── POSISI NORMAL AKUN & SALDO NEGATIF ─────────────────────────────────
 *   • Asset & Expense  → posisi normal DEBET   → balance positif saat normal
 *   • Liability, Equity, Revenue → posisi normal KREDIT → balance Dr−Cr
 *     tampak NEGATIF saat normal — BUKAN error.
 * Konvensi tampilan: saldo negatif ditulis (dalam kurung) berwarna merah,
 * yang berarti "saldo kredit". Perhitungan tetap satu rumus untuk semua
 * akun supaya Grand Total & subtotal selalu konsisten.
 *
 * ALUR FETCH:
 *   1) Ambil C_ElementValue (Value, Name, AccountType) → opsi multi-select
 *      akun + klasifikasi neraca/laba-rugi per akun.
 *   2) Ambil Fact_Acct s.d. tanggal AKHIR, difilter akun terpilih lewat
 *      OR-chunk per CHUNK_SIZE (pola SalesOrderDetailReport).
 *   3) Di useMemo: klasifikasi per akun → hitung saldo awal & running
 *      balance sesuai aturan neraca/laba-rugi di atas.
 *
 * ⚠️ ASUMSI yang perlu kamu cek/sesuaikan:
 *   - Path import "@/features/accounting/report/..." sesuaikan struktur project.
 *   - $top=5000 per chunk. Volume posting besar → naikkan atau chunk per bulan.
 *   - Filter default hanya DateAcct. Tambahkan PostingType eq 'A',
 *     C_AcctSchema_ID, AD_Org_ID di factFilter bila perlu (lihat komentar).
 *   - FY_START_MONTH: 1 = Januari (tahun kalender), 7 = Juli (FY Juli–Juni).
 *     Ubah konstanta di bawah sesuai tahun fiskal perusahaan Anda.
 */

const CHUNK_SIZE = 40; // jumlah Account_ID per batch query Fact_Acct

// ─── KONFIGURASI TAHUN FISKAL ────────────────────────────────────────────────
// 1 = Januari (tahun kalender), 7 = Juli (tahun fiskal Juli–Juni), dll.
const FY_START_MONTH = 1;

// Klasifikasi AccountType iDempiere (kolom AccountType di C_ElementValue)
const ACCOUNT_TYPE = {
    A: { label: "Aktiva", group: "NERACA", normal: "Debet" },
    L: { label: "Liabilitas", group: "NERACA", normal: "Kredit" },
    O: { label: "Ekuitas", group: "NERACA", normal: "Kredit" },
    E: { label: "Beban", group: "LABA-RUGI", normal: "Debet" },
    R: { label: "Pendapatan", group: "LABA-RUGI", normal: "Kredit" },
    M: { label: "Memo", group: "NERACA", normal: "Debet" }, // memo → perlakuan neraca
};
// Urutan tampilan: neraca dulu (A, L, O), lalu laba-rugi (R, E)
const TYPE_SORT_ORDER = { A: 1, L: 2, O: 3, R: 4, E: 5, M: 6 };

// Ambil tanggal mulai tahun fiskal untuk suatu tanggal (dinamis)
const getFiscalYearStartTs = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const y = d.getUTCFullYear();
    const candidate = new Date(Date.UTC(y, FY_START_MONTH - 1, 1)).getTime();
    return d.getTime() >= candidate
        ? candidate
        : new Date(Date.UTC(y - 1, FY_START_MONTH - 1, 1)).getTime();
};

const GeneralLedgerReport = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const firstOfMonth = todayStr.slice(0, 8) + "01";
    const { orgInfo } = useOrgInfo();

    const [startDate, setStartDate] = useState(firstOfMonth);
    const [endDate, setEndDate] = useState(todayStr);

    const [factLines, setFactLines] = useState([]); // semua posting le endDate, BELUM difilter akun
    const [loading, setLoading] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);

    // ─── Multi-select filter akun ───────────────────────────────────────────
    const [accountOptions, setAccountOptions] = useState([]); // {id, Value, Name, AccountType}
    const [selectedAccountIds, setSelectedAccountIds] = useState([]);
    const [accountSearch, setAccountSearch] = useState("");
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const accountDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
                setIsAccountDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ─── FETCH: opsi akun + AccountType (untuk klasifikasi neraca/laba-rugi) ─
    const fetchAccountOptions = useCallback(async () => {
        try {
            const res = await idempiereApi(
                `/models/c_elementvalue?$filter=IsActive eq true&$select=Value,Name,AccountType&$orderby=Value&$top=1000`
            );
            setAccountOptions(Array.isArray(res.records) ? res.records : []);
        } catch (err) {
            console.error("Gagal mengambil daftar akun:", err.message);
        }
    }, []);

    useEffect(() => {
        fetchAccountOptions();
    }, [fetchAccountOptions]);

    // Map accountId → { accountType, value, name } untuk klasifikasi di JS
    const accountMetaMap = useMemo(() => {
        const map = new Map();
        accountOptions.forEach((a) => {
            map.set(a.id ?? a.C_ElementValue_ID, {
                accountType: a.AccountType?.id ?? a.AccountType ?? null,
                value: a.Value,
                name: a.Name,
            });
        });
        return map;
    }, [accountOptions]);

    // ─── FETCH: posting Fact_Acct s.d. endDate (saldo awal + transaksi) ─────
    const fetchReportData = useCallback(async () => {
        setLoading(true);
        try {
            // 🔧 Sesuaikan bila perlu:
            //   + ` and PostingType eq 'A'`          (hanya Actual)
            //   + ` and C_AcctSchema_ID eq 1000000`  (schema tertentu)
            //   + ` and AD_Org_ID eq ${orgId}`       (organisasi tertentu)
            const factFilter = `DateAcct le ${endDate}T23:59:59Z`;
            const selectFields = `DateAcct,Account_ID,AmtAcctDr,AmtAcctCr,Description`;

            let allRecords = [];
            if (selectedAccountIds.length === 0) {
                const res = await idempiereApi(
                    `/models/fact_acct?$filter=${factFilter}&$select=${selectFields}&$orderby=DateAcct&$top=5000`
                );
                allRecords = Array.isArray(res.records) ? res.records : [];
            } else {
                for (let i = 0; i < selectedAccountIds.length; i += CHUNK_SIZE) {
                    const chunk = selectedAccountIds.slice(i, i + CHUNK_SIZE);
                    const orClause = chunk.map((aid) => `Account_ID eq ${aid}`).join(" or ");
                    const res = await idempiereApi(
                        `/models/fact_acct?$filter=(${orClause}) and ${factFilter}` +
                        `&$select=${selectFields}&$orderby=DateAcct&$top=5000`
                    );
                    allRecords.push(...(Array.isArray(res.records) ? res.records : []));
                }
            }

            const startTs = new Date(`${startDate}T00:00:00Z`).getTime();
            const endTs = new Date(`${endDate}T23:59:59Z`).getTime();

            const rows = allRecords.map((rec, idx) => {
                const dateAcct = rec.DateAcct;
                const ts = new Date(dateAcct).getTime();
                const accountId = rec.Account_ID?.id ?? rec.Account_ID ?? null;
                const accountName =
                    rec.Account_ID?.identifier ||
                    rec.Account_ID?.Name ||
                    `#${accountId}`;
                return {
                    key: `${accountId}-${idx}`,
                    dateAcct,
                    ts,
                    accountId,
                    accountName,
                    description: rec.Description || "",
                    debit: parseFloat(rec.AmtAcctDr || 0),
                    credit: parseFloat(rec.AmtAcctCr || 0),
                    inPeriod: ts >= startTs && ts <= endTs, // transaksi tampil
                };
            });

            setFactLines(rows);
        } catch (err) {
            console.error("Gagal mengambil data buku besar:", err.message);
            setFactLines([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedAccountIds]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    // ─── Pivot per akun + klasifikasi neraca/laba-rugi + running balance ────
    const groupedByAccount = useMemo(() => {
        const startTs = new Date(`${startDate}T00:00:00Z`).getTime();
        const endTs = new Date(`${endDate}T23:59:59Z`).getTime();
        const fyStartTs = getFiscalYearStartTs(startDate);

        const map = new Map();
        factLines.forEach((r) => {
            if (!map.has(r.accountId)) {
                const meta = accountMetaMap.get(r.accountId) || {};
                const accountType = meta.accountType || "?";
                const typeInfo = ACCOUNT_TYPE[accountType] || {
                    label: "Lainnya", group: "NERACA", normal: "Debet",
                };
                map.set(r.accountId, {
                    accountId: r.accountId,
                    accountName: r.accountName,
                    accountType,
                    typeInfo,
                    isPnL: typeInfo.group === "LABA-RUGI",
                    openingBalance: 0,
                    totalDebit: 0,
                    totalCredit: 0,
                    rows: [],
                });
            }
            const group = map.get(r.accountId);

            if (group.isPnL) {
                // ── LABA-RUGI: posting sebelum awal tahun fiskal DIBUANG,
                //    posting sejak awal tahun fiskal s.d. sebelum periode
                //    menjadi SALDO AWAL tahun berjalan. ──
                if (r.ts < fyStartTs) return;
                if (r.ts < startTs) {
                    group.openingBalance += r.debit - r.credit;
                } else if (r.ts <= endTs) {
                    group.totalDebit += r.debit;
                    group.totalCredit += r.credit;
                    group.rows.push(r);
                }
            } else {
                // ── NERACA: saldo awal = SELURUH histori sebelum periode. ──
                if (r.ts < startTs) {
                    group.openingBalance += r.debit - r.credit;
                } else if (r.ts <= endTs) {
                    group.totalDebit += r.debit;
                    group.totalCredit += r.credit;
                    group.rows.push(r);
                }
            }
        });

        // Running balance + saldo awal per grup; urut neraca dulu lalu laba-rugi
        const groups = Array.from(map.values()).map((g) => {
            let running = g.openingBalance;
            const rows = g.rows.map((r) => {
                running += r.debit - r.credit;
                return { ...r, balance: running };
            });
            return {
                ...g,
                rows,
                closingBalance: running,
                openingRow: {
                    key: `${g.accountId}-opening`,
                    dateAcct: startDate,
                    description: g.isPnL ? "Saldo Awal Tahun Berjalan" : "Saldo Awal",
                    balance: g.openingBalance,
                    isOpeningRow: true,
                },
            };
        });

        groups.sort((a, b) => {
            const ta = TYPE_SORT_ORDER[a.accountType] ?? 99;
            const tb = TYPE_SORT_ORDER[b.accountType] ?? 99;
            return ta !== tb ? ta - tb : a.accountName.localeCompare(b.accountName);
        });
        return groups;
    }, [factLines, accountMetaMap, startDate, endDate]);

    const filteredGroups = useMemo(() => {
        const q = accountSearch.trim().toLowerCase();
        if (!q) return groupedByAccount;
        return groupedByAccount.filter(
            (g) =>
                (g.accountName || "").toLowerCase().includes(q) ||
                g.rows.some((r) => (r.description || "").toLowerCase().includes(q))
        );
    }, [groupedByAccount, accountSearch]);

    const grandTotal = useMemo(() => {
        return filteredGroups.reduce(
            (acc, g) => ({
                debit: acc.debit + g.totalDebit,
                credit: acc.credit + g.totalCredit,
                closing: acc.closing + g.closingBalance,
            }),
            { debit: 0, credit: 0, closing: 0 }
        );
    }, [filteredGroups]);

    // ─── Handler multi-select akun ──────────────────────────────────────────
    const getAccountId = (a) => a.id ?? a.C_ElementValue_ID;
    const toggleAccount = (accountId) => {
        setSelectedAccountIds((prev) =>
            prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
        );
    };
    const clearAccountFilter = () => setSelectedAccountIds([]);

    const accountFilterLabel =
        selectedAccountIds.length === 0 ? "Semua Akun" : `${selectedAccountIds.length} akun dipilih`;

    const fmtDate = (iso) => {
        if (!iso) return "-";
        const d = new Date(iso);
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
    };
    // Angka negatif → dalam kurung (konvensi akuntansi "saldo kredit")
    const fmtSigned = (n) =>
        n < 0 ? `(${Math.abs(n).toLocaleString("id-ID")})` : n.toLocaleString("id-ID");

    // ─── Print PDF ───────────────────────────────────────────────────────────
    const handlePrintDetail = async () => {
        if (filteredGroups.length === 0) {
            alert("Tidak ada data untuk dicetak.");
            return;
        }
        setPrinting(true);
        try {
            const rows = [];
            let no = 0;
            let currentSection = "";
            filteredGroups.forEach((group) => {
                // Penanda section NERACA / LABA-RUGI di PDF
                if (group.typeInfo.group !== currentSection) {
                    currentSection = group.typeInfo.group;
                    rows.push({
                        no: "",
                        dateAcct: "",
                        accountName: `── ${currentSection} ──`,
                        debit: "",
                        credit: "",
                        balance: "",
                        _isGroupHeader: true,
                    });
                }
                rows.push({
                    no: "",
                    dateAcct: "",
                    accountName: `${group.accountName}`,
                    debit: "",
                    credit: "",
                    balance: `Awal: ${fmtSigned(group.openingBalance)}  →  Akhir: ${fmtSigned(group.closingBalance)}`,
                    _isGroupHeader: true,
                });
                rows.push({
                    no: "",
                    dateAcct: fmtDate(startDate),
                    accountName: group.isPnL ? "Saldo Awal Tahun Berjalan" : "Saldo Awal",
                    debit: "",
                    credit: "",
                    balance: fmtSigned(group.openingBalance),
                });
                group.rows.forEach((r) => {
                    no += 1;
                    rows.push({
                        no,
                        dateAcct: fmtDate(r.dateAcct),
                        accountName: r.description || group.accountName,
                        debit: r.debit ? r.debit.toLocaleString("id-ID") : "",
                        credit: r.credit ? r.credit.toLocaleString("id-ID") : "",
                        balance: fmtSigned(r.balance),
                    });
                });
                rows.push({
                    no: "",
                    dateAcct: "",
                    accountName: `Subtotal ${group.accountName}`,
                    debit: group.totalDebit.toLocaleString("id-ID"),
                    credit: group.totalCredit.toLocaleString("id-ID"),
                    balance: "",
                });
            });

            await renderPivotListPDF({
                title: "LAPORAN BUKU BESAR (GENERAL LEDGER)",
                logoDataUrl: orgInfo?.logoUrl,
                orgName: orgInfo?.name,
                orgPhone: orgInfo?.phone,
                orgEmail: orgInfo?.email,
                periodLabel: `PERIODE : ${startDate}  s/d  ${endDate}   (FY start: ${FY_START_MONTH === 1 ? "Januari" : "Bulan-" + FY_START_MONTH})`,
                columns: [
                    { key: "no", label: "No", width: 20, align: "center" },
                    { key: "dateAcct", label: "Tanggal", width: 40 },
                    { key: "accountName", label: "Akun / Keterangan", width: 170 },
                    { key: "debit", label: "Debet", width: 65, align: "right" },
                    { key: "credit", label: "Kredit", width: 65, align: "right" },
                    { key: "balance", label: "Balance", width: 75, align: "right" },
                ],
                rows,
                totalLabel: "Total Debet / Kredit",
                totalValue: `${grandTotal.debit.toLocaleString("id-ID")} / ${grandTotal.credit.toLocaleString("id-ID")}`,
                filenamePrefix: `BUKU-BESAR-${startDate}_${endDate}`,
            });
        } catch (err) {
            console.error("Gagal generate PDF:", err.message);
            alert("Gagal membuat PDF laporan.");
        } finally {
            setPrinting(false);
        }
    };

    // ─── Export Excel (AOA manual) ───────────────────────────────────────────
    const handleExportExcel = () => {
        if (filteredGroups.length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }
        setExportingExcel(true);
        try {
            const aoa = [
                ["LAPORAN BUKU BESAR (GENERAL LEDGER)"],
                [`Periode: ${startDate} s/d ${endDate}`],
                [`Catatan: saldo negatif = posisi kredit (dalam kurung). Laba-rugi dihitung dari awal tahun fiskal (bulan ke-${FY_START_MONTH}).`],
                [],
                ["No", "Tanggal", "Akun / Keterangan", "Debet", "Kredit", "Balance"],
            ];

            let no = 0;
            let currentSection = "";
            filteredGroups.forEach((group) => {
                if (group.typeInfo.group !== currentSection) {
                    currentSection = group.typeInfo.group;
                    aoa.push([`── ${currentSection} ──`]);
                }
                aoa.push([`📒 ${group.accountName}`, "", "", "", "", ""]);
                aoa.push(["", fmtDate(startDate), group.isPnL ? "Saldo Awal Tahun Berjalan" : "Saldo Awal", "", "", group.openingBalance]);
                group.rows.forEach((r) => {
                    no += 1;
                    aoa.push([no, fmtDate(r.dateAcct), r.description || group.accountName, r.debit, r.credit, r.balance]);
                });
                aoa.push(["", "", `Subtotal ${group.accountName}`, group.totalDebit, group.totalCredit, ""]);
            });

            aoa.push([]);
            aoa.push(["", "", "TOTAL PERIODE (Debet / Kredit)", grandTotal.debit, grandTotal.credit, ""]);

            const worksheet = XLSX.utils.aoa_to_sheet(aoa);
            worksheet["!cols"] = [
                { wch: 6 }, { wch: 12 }, { wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Buku Besar");
            XLSX.writeFile(workbook, `BUKU-BESAR-${startDate}_${endDate}.xlsx`);
        } catch (err) {
            console.error("Gagal export Excel:", err.message);
            alert("Gagal membuat file Excel.");
        } finally {
            setExportingExcel(false);
        }
    };

    // Warna badge per tipe akun
    const typeBadgeColor = { NERACA: "#1a237e", "LABA-RUGI": "#7c5800" };

    return (
        <div className="card-container">
            <PageHeader
                title="📒 Laporan Buku Besar"
                extraAction={
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={handleExportExcel} disabled={exportingExcel} style={styles.excelBtn}>
                            {exportingExcel ? "⏳ ..." : "📥 Download Excel"}
                        </button>
                        <button onClick={handlePrintDetail} disabled={printing} style={styles.printBtn}>
                            {printing ? "⏳ ..." : "🖨️ Print PDF"}
                        </button>
                    </div>
                }
            />

            {/* ─── Filter bar ─────────────────────────────────────────────── */}
            <div style={styles.filterRow}>
                <div style={styles.dateField}>
                    <label style={styles.fieldLabel}>Date From</label>
                    <input type="date" value={startDate} max={endDate}
                        onChange={(e) => setStartDate(e.target.value)} style={styles.dateInput} />
                </div>
                <div style={styles.dateField}>
                    <label style={styles.fieldLabel}>Date To</label>
                    <input type="date" value={endDate} min={startDate}
                        onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
                </div>

                {/* Multi-select akun */}
                <div style={{ position: "relative" }} ref={accountDropdownRef}>
                    <label style={styles.fieldLabel}>Filter Akun</label>
                    <button type="button" onClick={() => setIsAccountDropdownOpen((v) => !v)}
                        style={styles.accountDropdownBtn}>
                        {accountFilterLabel} ▾
                    </button>
                    {isAccountDropdownOpen && (
                        <div style={styles.accountDropdownPanel}>
                            <input type="text" placeholder="Cari akun..." value={accountSearch}
                                onChange={(e) => setAccountSearch(e.target.value)} style={styles.accountSearchInput} />
                            <div style={styles.accountOptionList}>
                                {accountOptions.length === 0 && (
                                    <div style={{ padding: "8px", color: "#888" }}>Tidak ada akun.</div>
                                )}
                                {accountOptions.map((a) => {
                                    const aid = getAccountId(a);
                                    return (
                                        <label key={aid} style={styles.accountOptionRow}>
                                            <input type="checkbox" checked={selectedAccountIds.includes(aid)}
                                                onChange={() => toggleAccount(aid)} />
                                            {a.Value} — {a.Name}
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedAccountIds.length > 0 && (
                                <button type="button" onClick={clearAccountFilter} style={styles.clearFilterBtn}>
                                    Hapus semua pilihan
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div style={styles.dateField}>
                    <label style={styles.fieldLabel}>Cari</label>
                    <input type="text" placeholder="Nama akun / keterangan..." value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)} style={styles.textInput} />
                </div>
            </div>

            {/* ─── Buku Besar per Akun ────────────────────────────────────── */}
            <div className="detail-section">
                <h3>Buku Besar per Akun</h3>
                {loading ? (
                    <p>Memuat data...</p>
                ) : filteredGroups.length === 0 ? (
                    <p style={{ color: "#777" }}>Tidak ada data untuk filter ini.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Akun / Keterangan</th>
                                    <th style={{ textAlign: "right" }}>Debet</th>
                                    <th style={{ textAlign: "right" }}>Kredit</th>
                                    <th style={{ textAlign: "right" }}>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    let lastSection = "";
                                    return filteredGroups.map((group) => {
                                        const sectionRow =
                                            group.typeInfo.group !== lastSection ? (
                                                (lastSection = group.typeInfo.group),
                                                <tr key={`section-${group.typeInfo.group}`} style={styles.sectionRow}>
                                                    <td colSpan={5}>{group.typeInfo.group === "NERACA" ? "🏛️ NERACA" : "📈 LABA-RUGI"}</td>
                                                </tr>
                                            ) : null;
                                        return (
                                            <React.Fragment key={group.accountId ?? group.accountName}>
                                                {sectionRow}
                                                {/* Header akun: badge tipe + posisi normal */}
                                                <tr style={styles.groupHeaderRow}>
                                                    <td colSpan={5}>
                                                        <div style={styles.groupHeaderContent}>
                                                            <span style={styles.groupHeaderName}>
                                                                📒 {group.accountName}
                                                                <span style={{ ...styles.typeBadge, color: typeBadgeColor[group.typeInfo.group] }}>
                                                                    [{group.accountType}] {group.typeInfo.label} • Normal: {group.typeInfo.normal}
                                                                </span>
                                                            </span>
                                                            <span style={styles.groupHeaderStats}>
                                                                Saldo Awal: <strong>{fmtSigned(group.openingBalance)}</strong>
                                                                &nbsp;&nbsp;|&nbsp;&nbsp;
                                                                Saldo Akhir: <strong>{fmtSigned(group.closingBalance)}</strong>
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Baris saldo awal */}
                                                <tr style={styles.openingRow}>
                                                    <td>{fmtDate(startDate)}</td>
                                                    <td style={{ fontStyle: "italic", color: "#555" }}>
                                                        {group.isPnL ? "Saldo Awal Tahun Berjalan" : "Saldo Awal"}
                                                    </td>
                                                    <td style={{ textAlign: "right", color: "#999" }}>—</td>
                                                    <td style={{ textAlign: "right", color: "#999" }}>—</td>
                                                    <td style={{ textAlign: "right", fontWeight: "600", ...(group.openingBalance < 0 ? styles.negative : {}) }}>
                                                        {fmtSigned(group.openingBalance)}
                                                    </td>
                                                </tr>
                                                {/* Transaksi dengan balance kumulatif */}
                                                {group.rows.map((r) => (
                                                    <tr key={r.key}>
                                                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.dateAcct)}</td>
                                                        <td>{r.description || group.accountName}</td>
                                                        <td style={{ textAlign: "right" }}>{r.debit ? r.debit.toLocaleString("id-ID") : "—"}</td>
                                                        <td style={{ textAlign: "right" }}>{r.credit ? r.credit.toLocaleString("id-ID") : "—"}</td>
                                                        <td style={{ textAlign: "right", fontWeight: "500", ...(r.balance < 0 ? styles.negative : {}) }}>
                                                            {fmtSigned(r.balance)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr style={styles.subtotalRow}>
                                                    <td colSpan={2} style={{ fontWeight: "bold" }}>
                                                        Subtotal {group.accountName}
                                                    </td>
                                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                                                        {group.totalDebit.toLocaleString("id-ID")}
                                                    </td>
                                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                                                        {group.totalCredit.toLocaleString("id-ID")}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} style={{ fontWeight: "bold" }}>
                                        Grand Total ({fmtDate(startDate)} – {fmtDate(endDate)})
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                                        {grandTotal.debit.toLocaleString("id-ID")}
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                                        {grandTotal.credit.toLocaleString("id-ID")}
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                                        {fmtSigned(grandTotal.closing)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
                <p style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
                    Balance = Saldo Awal + kumulatif (Debet − Kredit). Neraca: saldo awal dari seluruh
                    histori. Laba-rugi: saldo awal dari awal tahun fiskal (bulan ke-{FY_START_MONTH}).
                    Saldo dalam kurung merah = posisi kredit (wajar untuk Liabilitas, Ekuitas, Pendapatan).
                </p>
            </div>
        </div>
    );
};

const styles = {
    printBtn: { backgroundColor: "#546e7a", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    excelBtn: { backgroundColor: "#1e7e34", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
    filterRow: { display: "flex", gap: "16px", flexWrap: "wrap", margin: "12px 0 20px", alignItems: "flex-end" },
    dateField: { display: "flex", flexDirection: "column", gap: "4px" },
    fieldLabel: { fontSize: "12px", fontWeight: "600", color: "#555" },
    dateInput: { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" },
    textInput: { padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px", minWidth: "200px" },
    accountDropdownBtn: { padding: "8px 14px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "13px", minWidth: "160px", textAlign: "left" },
    accountDropdownPanel: { position: "absolute", top: "100%", left: 0, marginTop: "4px", background: "#fff", border: "1px solid #ddd", borderRadius: "6px", width: "300px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 20, padding: "8px" },
    accountSearchInput: { width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "8px", boxSizing: "border-box" },
    accountOptionList: { maxHeight: "220px", overflowY: "auto" },
    accountOptionRow: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px", cursor: "pointer", fontSize: "13px" },
    clearFilterBtn: { marginTop: "8px", width: "100%", padding: "6px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
    groupHeaderRow: { backgroundColor: "#fff8e1", borderTop: "2px solid #ffe082", borderBottom: "1px solid #ffe082" },
    groupHeaderContent: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "8px 4px" },
    groupHeaderName: { fontWeight: "700", color: "#7c5800", fontSize: "13.5px" },
    groupHeaderStats: { fontSize: "12.5px", color: "#8d6e00" },
    typeBadge: { marginLeft: "10px", fontSize: "11px", fontWeight: "600" },
    sectionRow: { backgroundColor: "#37474f", color: "#fff", fontWeight: "700", fontSize: "13px" },
    openingRow: { backgroundColor: "#fafafa" },
    subtotalRow: { backgroundColor: "#fffde7", borderTop: "1px dashed #ffe082" },
    negative: { color: "#c62828" },
};

export default GeneralLedgerReport;