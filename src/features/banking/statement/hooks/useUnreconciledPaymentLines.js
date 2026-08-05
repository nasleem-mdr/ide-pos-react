import { useState, useCallback } from 'react';
import { idempiereApi, fkId, fkLabel } from '@/api/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useUnreconciledPaymentLines.js
// Fetch C_Payment yang: (a) sudah Complete, (b) belum direkonsiliasi
// (IsReconciled = false), (c) terikat ke Bank Account yang dipilih.
// Dipakai oleh BankStatementImportModal — replika "Create lines from" di
// Windows client (lihat screenshot referensi).
//
// docTypeFilter: 'AR' (Receipt, IsReceipt=true) | 'AP' (Payment, IsReceipt=false) | null (semua)
//
// ⚠️ EXCLUDE payment yang SUDAH dipakai di C_BankStatementLine manapun
// (termasuk yang statement-nya masih Draft, belum Complete) — supaya tidak
// ada 1 payment ke-double-input di 2 statement berbeda yang jalan
// bersamaan. iDempiere tidak auto-filter ini di level C_Payment.IsReconciled
// (itu baru ke-flag TRUE setelah statement-nya Complete), jadi kita cross-
// check manual ke C_BankStatementLine di sini.
// ─────────────────────────────────────────────────────────────────────────────
export function useUnreconciledPaymentLines() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLines = useCallback(async ({
    bankAccountId,
    docTypeFilter = null,     // 'AR' | 'AP' | null
    bpartnerId = null,
    amountMin = null,
    amountMax = null,
    dateFrom = null,
    dateTo = null,
  }) => {
    if (!bankAccountId) { setLines([]); return; }
    setLoading(true);
    try {
      let filter = `C_BankAccount_ID eq ${bankAccountId} and DocStatus eq 'CO' and IsReconciled eq false`;
      if (docTypeFilter === 'AR') filter += ' and IsReceipt eq true';
      if (docTypeFilter === 'AP') filter += ' and IsReceipt eq false';
      if (bpartnerId) filter += ` and C_BPartner_ID eq ${bpartnerId}`;
      if (amountMin != null) filter += ` and PayAmt ge ${amountMin}`;
      if (amountMax != null) filter += ` and PayAmt le ${amountMax}`;
      if (dateFrom) filter += ` and DateTrx ge '${dateFrom}'`;
      if (dateTo)   filter += ` and DateTrx le '${dateTo}'`;

      const res = await idempiereApi(
        `/models/c_payment?$filter=${filter}` +
        `&$select=C_Payment_ID,DocumentNo,DateTrx,PayAmt,IsReceipt,C_BPartner_ID,C_Currency_ID,Description` +
        `&$orderby=DateTrx desc&$top=200`
      );
      const payments = Array.isArray(res.records) ? res.records : [];
      if (payments.length === 0) { setLines([]); return; }

      // ── Cross-check: buang yang sudah ada di C_BankStatementLine manapun ──
      const paymentIds = payments.map(p => p.id ?? p.C_Payment_ID);
      const filterStr = paymentIds.map(id => `C_Payment_ID eq ${id}`).join(' or ');
      let usedPaymentIds = new Set();
      try {
        const usedRes = await idempiereApi(
          `/models/c_bankstatementline?$filter=${filterStr}&$select=C_Payment_ID&$top=500`
        );
        const usedRecords = Array.isArray(usedRes.records) ? usedRes.records : [];
        usedRecords.forEach(r => {
          const pid = fkId(r.C_Payment_ID) ?? r.C_Payment_ID?.id;
          if (pid != null) usedPaymentIds.add(String(pid));
        });
      } catch (err) {
        console.warn('[useUnreconciledPaymentLines] gagal cross-check C_BankStatementLine, lanjut tanpa filter ini:', err.message);
      }

      // ── Cari invoice yang ter-allocate ke payment ini (utk kolom "Invoice") ─
      let invoiceByPayment = new Map();
      try {
        const allocRes = await idempiereApi(
          `/models/c_allocationline?$filter=${paymentIds.map(id => `C_Payment_ID eq ${id}`).join(' or ')}` +
          `&$select=C_Payment_ID,C_Invoice_ID&$top=500`
        );
        const allocRecords = Array.isArray(allocRes.records) ? allocRes.records : [];
        allocRecords.forEach(a => {
          const pid = fkId(a.C_Payment_ID) ?? a.C_Payment_ID?.id;
          const invId = fkId(a.C_Invoice_ID) ?? a.C_Invoice_ID?.id;
          if (pid != null && invId != null) invoiceByPayment.set(String(pid), { id: invId, label: fkLabel(a.C_Invoice_ID) });
        });
      } catch (err) {
        console.warn('[useUnreconciledPaymentLines] gagal fetch C_AllocationLine (invoice), field Invoice akan kosong:', err.message);
      }

      const mapped = payments
        .filter(p => !usedPaymentIds.has(String(p.id ?? p.C_Payment_ID)))
        .map(p => {
          const pid = p.id ?? p.C_Payment_ID;
          const invoice = invoiceByPayment.get(String(pid));
          return {
            C_Payment_ID: pid,
            DocumentNo:   p.DocumentNo,
            DateTrx:      p.DateTrx,
            PayAmt:       parseFloat(p.PayAmt ?? 0),
            IsReceipt:    !!p.IsReceipt,
            C_BPartner_ID: fkId(p.C_BPartner_ID) ?? p.C_BPartner_ID?.id ?? null,
            BPName:        fkLabel(p.C_BPartner_ID) || '',
            C_Currency_ID: fkId(p.C_Currency_ID) ?? p.C_Currency_ID?.id ?? null,
            C_Invoice_ID:  invoice?.id ?? null,
            InvoiceLabel:  invoice?.label ?? '',
            Description:   p.Description || '',
          };
        });

      setLines(mapped);
    } catch (err) {
      console.error('[useUnreconciledPaymentLines] gagal fetch:', err);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { lines, loading, fetchLines };
}