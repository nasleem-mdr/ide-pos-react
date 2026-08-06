import { useState, useCallback } from 'react';
import { idempiereApi, fkId, waitForDocStatus } from '@/api/idempiereApi';
import { getLoginInfo } from '@/shared/hooks/useLoginInfo';

// ─────────────────────────────────────────────────────────────────────────────
// useSalesInvoiceSubmit.jsx
// Submit langsung ke C_Invoice (sisi SALES, IsSOTrx=true) — HANYA
// Invoice + InvoiceLine, lalu Complete. TIDAK ada Order, Shipment, Payment,
// atau Allocation — dipakai untuk kasus jual langsung tanpa dokumen PO
// (mis. invoice manual / jasa / item non-stock).
//
// Beda dengan useCashPurchaseSubmit.jsx:
//   - Cuma 1 tahap dokumen: 'invoice' (bukan po → receipt → invoice → payment)
//   - IsSOTrx: true (Sales), bukan false (Purchase)
//   - Tidak menyentuh C_Order / M_InOut / C_Payment sama sekali
//
// Kalau Complete invoice gagal setelah invoice/line berhasil dibuat, proses
// berhenti dan mengembalikan info invoice yang sudah terlanjur dibuat (masih
// Draft) — supaya staff bisa lanjutkan/Complete manual dari iDempiere.
// ─────────────────────────────────────────────────────────────────────────────
export function useSalesInvoiceSubmit({ invoiceDocTypeId, description, onError, onStepUpdate }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(null); // 'invoice'

  const submit = useCallback(async (cart, {
    customerId,
    customerLocationId,
    customerName,
    paymentRule = 'P',      // 'P' = Immediate Payment, sesuaikan kalau perlu termin lain
    submitMode = 'complete', // 'draft' = simpan tanpa Complete, 'complete' = langsung Complete
  } = {}) => {
    if (cart.length === 0) {
      onError?.('Keranjang penjualan masih kosong!');
      return null;
    }

    const { orgId, clientId } = getLoginInfo();

    if (!customerId || !customerLocationId) {
      onError?.('Customer belum ditentukan.', 'Data Belum Lengkap');
      return null;
    }
    if (!invoiceDocTypeId) {
      onError?.('Document Type (Invoice) belum ter-resolve.', 'Konfigurasi Tidak Lengkap');
      return null;
    }

    setIsSubmitting(true);
    const created = { invoiceId: null };

    try {
      const todayISO = new Date().toISOString().split('T')[0];

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 1 — Sales Invoice (header)
      // ═══════════════════════════════════════════════════════════════════
      setProgressStep('invoice');
      onStepUpdate?.('invoice', 'pending');
      const invoiceRes = await idempiereApi('/models/c_invoice', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID:  { id: clientId },
          AD_Org_ID:     { id: orgId },
          C_DocType_ID:  { id: invoiceDocTypeId },
          C_DocTypeTarget_ID: { id: invoiceDocTypeId },
          C_BPartner_ID: { id: parseInt(customerId) },
          C_BPartner_Location_ID: { id: parseInt(customerLocationId) },
          DateInvoiced:  todayISO,
          IsSOTrx:       true,
          PaymentRule:   paymentRule,
          Description:   description,
        }),
      });
      const invoiceId = fkId(invoiceRes.id) ?? invoiceRes.id ?? invoiceRes.C_Invoice_ID;
      if (!invoiceId) throw new Error('Gagal mendapatkan C_Invoice_ID.');
      created.invoiceId = invoiceId;

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 1b — Invoice Lines
      // ═══════════════════════════════════════════════════════════════════
      for (const item of cart) {
        const uom = item.selectedUom || { C_UOM_ID: item.C_UOM_ID, multiplyRate: 1 };
        const qtyEntered = parseFloat(item.Qty);
        const qtyInvoiced = qtyEntered * (uom.multiplyRate || 1);

        await idempiereApi('/models/c_invoiceline', {
          method: 'POST',
          body: JSON.stringify({
            AD_Org_ID:     { id: orgId },
            C_Invoice_ID:  { id: invoiceId },
            M_Product_ID:  { id: parseInt(item.M_Product_ID) },
            C_UOM_ID:      { id: parseInt(uom.C_UOM_ID) },
            QtyEntered:    qtyEntered,
            QtyInvoiced:   qtyInvoiced,
            PriceActual:   parseFloat(item.PriceActual || item.Price || 0),
            PriceEntered:  parseFloat(item.PriceEntered || item.PriceActual || item.Price || 0),
          }),
        });
      }

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 1c — Complete (di-skip kalau submitMode === 'draft')
      // ═══════════════════════════════════════════════════════════════════
      // Total belum tentu ke-compute di iDempiere sebelum Complete, jadi
      // untuk mode draft kita hitung sendiri dari cart supaya UI (success
      // modal) tetap bisa menampilkan angka yang masuk akal.
      const clientGrandTotal = cart.reduce((s, item) => s + (parseFloat(item.Qty) * parseFloat(item.Price || item.PriceActual || 0)), 0);

      if (submitMode === 'draft') {
        onStepUpdate?.('invoice', 'success', { id: invoiceId, documentNo: invoiceRes.DocumentNo, status: 'Drafted' });
        return {
          invoiceId,
          documentNo: invoiceRes.DocumentNo || `#${invoiceId}`,
          status: 'Draft',
          grandTotal: clientGrandTotal,
          customerName: customerName || `#${customerId}`,
          date: new Date().toLocaleString('id-ID'),
          items: [...cart],
        };
      }

      const completedInvoice = await idempiereApi(`/models/c_invoice/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });
      const invoiceStatus = await waitForDocStatus('c_invoice', invoiceId);
      if (!invoiceStatus.success) throw new Error(`Invoice gagal Complete (status: ${invoiceStatus.status})`);

      const grandTotal = parseFloat(completedInvoice.GrandTotal ?? invoiceStatus.grandTotal ?? clientGrandTotal);
      onStepUpdate?.('invoice', 'success', { id: invoiceId, documentNo: invoiceStatus.documentNo, status: 'Completed' });
      // ═══════════════════════════════════════════════════════════════════

      return {
        invoiceId,
        documentNo: invoiceStatus.documentNo,
        status: 'Completed',
        grandTotal,
        customerName: customerName || `#${customerId}`,
        date: new Date().toLocaleString('id-ID'),
        items: [...cart],
      };

    } catch (err) {
      // Kalau invoice header sudah terlanjur dibuat (masih Draft), kasih tahu
      // supaya bisa dilanjutkan/dibetulkan manual dari iDempiere.
      const doneList = Object.entries(created)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      onStepUpdate?.(progressStep, 'error', { message: err.message });
      onError?.(
        `Gagal pada tahap "${progressStep}": ${err.message}` +
        (doneList ? `\n\nDokumen yang SUDAH berhasil dibuat (perlu ditindaklanjuti manual):\n${doneList}` : ''),
        'Proses Terhenti'
      );
      return null;
    } finally {
      setIsSubmitting(false);
      setProgressStep(null);
    }
  }, [invoiceDocTypeId, description, onError, onStepUpdate, progressStep]);

  return { submit, isSubmitting, progressStep };
}