import { useState, useCallback } from 'react';
import { idempiereApi, fkId } from '../utils/idempiereApi';
import { getLoginInfo } from './useLoginInfo';

// ─────────────────────────────────────────────────────────────────────────────
// useCashPurchaseSubmit.jsx
// Otomasi penuh: PO → Receipt → Invoice → Payment → Allocation, tanpa jeda
// approval manusia — untuk skenario pembelian TUNAI di lokasi (vendor datang
// langsung, barang diterima saat itu juga, dibayar saat itu juga).
//
// PENTING — beda dari POS:
//   - POS: C_Order sisi SALES (IsSOTrx=true), engine iDempiere auto-generate
//     shipment+invoice saat Complete karena C_POS_ID terisi.
//   - Ini: C_Order sisi PURCHASE (IsSOTrx=false) — TIDAK ada auto-generate
//     bawaan, jadi tiap dokumen kita buat & Complete manual secara eksplisit,
//     sambil tetap mengisi field penghubung yang sama seperti kalau proses
//     ini dilakukan manual oleh staff (C_OrderLine_ID, M_InOutLine_ID, dst)
//     — supaya 3-way matching & AP Aging tetap akurat.
//
// Kalau ada step yang gagal di tengah jalan, proses BERHENTI di situ dan
// mengembalikan info dokumen mana saja yang SUDAH berhasil dibuat — supaya
// tidak ada transaksi "hilang tanpa jejak" dan staff bisa lanjutkan manual
// dari titik yang gagal (lihat bagian error handling di bawah).
// ─────────────────────────────────────────────────────────────────────────────
export function useCashPurchaseSubmit({ poDocTypeId, receiptDocTypeId, invoiceDocTypeId, description, onError, onStepUpdate }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(null); // 'po' | 'receipt' | 'invoice' | 'payment' | 'allocation'

  const submit = useCallback(async (cart, {
    warehouseId,
    locatorId,
    vendorId,
    vendorLocationId,
    vendorName,
    paymentTenderType = 'K', // 'K' = Cash, sesuaikan dengan tender type kamu
    bankAccountId,           // C_BankAccount_ID untuk C_Payment (wajib untuk tender non-cash)
  } = {}) => {
    if (cart.length === 0) {
      onError?.('Keranjang pembelian masih kosong!');
      return null;
    }

    const { orgId, clientId } = getLoginInfo();

    if (!vendorId || !vendorLocationId) {
      onError?.('Vendor belum ditentukan.', 'Data Belum Lengkap');
      return null;
    }
    if (!warehouseId || !locatorId) {
      onError?.('Gudang/lokasi tujuan belum ditentukan.', 'Data Belum Lengkap');
      return null;
    }
    if (!poDocTypeId || !receiptDocTypeId || !invoiceDocTypeId) {
      onError?.('Document Type (PO/Receipt/Invoice) belum ter-resolve.', 'Konfigurasi Tidak Lengkap');
      return null;
    }

    setIsSubmitting(true);
    const created = { poId: null, receiptId: null, invoiceId: null, paymentId: null };

    try {
      const todayISO = new Date().toISOString().split('T')[0];

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 1 — Purchase Order
      // ═══════════════════════════════════════════════════════════════════
      setProgressStep('po');
      onStepUpdate?.('po', 'pending');
      const poRes = await idempiereApi('/models/c_order', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID:  { id: clientId },
          AD_Org_ID:     { id: orgId },
          C_DocType_ID:  { id: poDocTypeId },
          C_DocTypeTarget_ID: { id: poDocTypeId },
          C_BPartner_ID: { id: parseInt(vendorId) },
          C_BPartner_Location_ID: { id: parseInt(vendorLocationId) },
          M_Warehouse_ID: { id: parseInt(warehouseId) },
          DateOrdered:   todayISO,
          DatePromised:  todayISO,
          IsSOTrx:       false,
          PaymentRule:   'P', // Immediate Payment
          Description:   description,
        }),
      });
      const poId = fkId(poRes.id) ?? poRes.id ?? poRes.C_Order_ID;
      if (!poId) throw new Error('Gagal mendapatkan C_Order_ID (PO).');
      created.poId = poId;

      const poLineIds = [];
      for (const item of cart) {
        const uom = item.selectedUom || { C_UOM_ID: item.C_UOM_ID, multiplyRate: 1 };
        const qtyEntered = parseFloat(item.Qty);
        const qtyOrdered = qtyEntered * (uom.multiplyRate || 1);

        const lineRes = await idempiereApi('/models/c_orderline', {
          method: 'POST',
          body: JSON.stringify({
            AD_Org_ID:    { id: orgId },
            C_Order_ID:   { id: poId },
            M_Product_ID: { id: parseInt(item.M_Product_ID) },
            C_UOM_ID:     { id: parseInt(uom.C_UOM_ID) },
            QtyEntered:   qtyEntered,
            QtyOrdered:   qtyOrdered,
            PriceActual:  parseFloat(item.PriceActual || 0),
            PriceEntered: parseFloat(item.PriceEntered || item.PriceActual || 0),
          }),
        });
        poLineIds.push({
          orderLineId: fkId(lineRes.id) ?? lineRes.id,
          productId:   item.M_Product_ID,
          qty:         qtyEntered,
          uom,
        });
      }

      await idempiereApi(`/models/c_order/${poId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });
      const poStatus = await waitForDocStatus('c_order', poId);
      if (!poStatus.success) throw new Error(`PO gagal Complete (status: ${poStatus.status})`);
      onStepUpdate?.('po', 'success', { id: poId, documentNo: poStatus.documentNo });
      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 2 — Material Receipt (link ke C_OrderLine_ID per baris)
      // ═══════════════════════════════════════════════════════════════════
      setProgressStep('receipt');
      onStepUpdate?.('receipt', 'pending');
      const receiptRes = await idempiereApi('/models/m_inout', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID: { id: clientId },
          AD_Org_ID:    { id: orgId },
          C_DocType_ID: { id: receiptDocTypeId },
          C_Order_ID:   { id: poId }, // 1 PO = 1 Receipt di alur tunai ini
          C_BPartner_ID: { id: parseInt(vendorId) },
          C_BPartner_Location_ID: { id: parseInt(vendorLocationId) },
          M_Warehouse_ID: { id: parseInt(warehouseId) },
          MovementDate: todayISO,
          IsSOTrx:      false,
          Description:  description,
        }),
      });
      const receiptId = fkId(receiptRes.id) ?? receiptRes.id ?? receiptRes.M_InOut_ID;
      if (!receiptId) throw new Error('Gagal mendapatkan M_InOut_ID (Receipt).');
      created.receiptId = receiptId;

      const inOutLineIds = [];
      for (const line of poLineIds) {
        const movementQty = line.qty * (line.uom.multiplyRate || 1);
        const lineRes = await idempiereApi('/models/m_inoutline', {
          method: 'POST',
          body: JSON.stringify({
            AD_Org_ID:      { id: orgId },
            M_InOut_ID:     { id: receiptId },
            M_Product_ID:   { id: parseInt(line.productId) },
            M_Locator_ID:   { id: parseInt(locatorId) },
            C_UOM_ID:       { id: parseInt(line.uom.C_UOM_ID) },
            QtyEntered:     line.qty,
            MovementQty:    movementQty,
            C_OrderLine_ID: { id: line.orderLineId }, // ← kunci 3-way matching
          }),
        });
        inOutLineIds.push({
          inOutLineId: fkId(lineRes.id) ?? lineRes.id,
          orderLineId: line.orderLineId,
        });
      }

      await idempiereApi(`/models/m_inout/${receiptId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });
      const receiptStatus = await waitForDocStatus('m_inout', receiptId);
      if (!receiptStatus.success) throw new Error(`Receipt gagal Complete (status: ${receiptStatus.status})`);
      onStepUpdate?.('receipt', 'success', { id: receiptId, documentNo: receiptStatus.documentNo });
      
      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 3 — Vendor Invoice (link ke C_OrderLine_ID + M_InOutLine_ID)
      // ═══════════════════════════════════════════════════════════════════
      setProgressStep('invoice');
      onStepUpdate?.('invoice', 'pending');
      const invoiceRes = await idempiereApi('/models/c_invoice', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID: { id: clientId },
          AD_Org_ID:    { id: orgId },
          C_DocType_ID: { id: invoiceDocTypeId },
          C_DocTypeTarget_ID: { id: invoiceDocTypeId },
          C_Order_ID:   { id: poId },
          C_BPartner_ID: { id: parseInt(vendorId) },
          C_BPartner_Location_ID: { id: parseInt(vendorLocationId) },
          DateInvoiced: todayISO,
          IsSOTrx:      false,
          PaymentRule:  'P',
          Description:  description,
        }),
      });
      const invoiceId = fkId(invoiceRes.id) ?? invoiceRes.id ?? invoiceRes.C_Invoice_ID;
      if (!invoiceId) throw new Error('Gagal mendapatkan C_Invoice_ID.');
      created.invoiceId = invoiceId;

      for (const line of poLineIds) {
        const matchedInOutLine = inOutLineIds.find(io => io.orderLineId === line.orderLineId);
        await idempiereApi('/models/c_invoiceline', {
          method: 'POST',
          body: JSON.stringify({
            AD_Org_ID:      { id: orgId },
            C_Invoice_ID:   { id: invoiceId },
            M_Product_ID:   { id: parseInt(line.productId) },
            C_UOM_ID:       { id: parseInt(line.uom.C_UOM_ID) },
            QtyInvoiced:    line.qty,
            C_OrderLine_ID: { id: line.orderLineId },
            ...(matchedInOutLine ? { M_InOutLine_ID: { id: matchedInOutLine.inOutLineId } } : {}),
          }),
        });
      }

      const completedInvoice = await idempiereApi(`/models/c_invoice/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });

      const invoiceGrandTotal = parseFloat(completedInvoice.GrandTotal ?? 0);
      if (!invoiceGrandTotal) {
        console.warn('GrandTotal invoice tidak terbaca dari response Complete — payment mungkin perlu jumlah manual.');
      }
     
      onStepUpdate?.('invoice', 'success', { id: invoiceId, documentNo: completedInvoice.DocumentNo });
      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 4 — Payment
      // ═══════════════════════════════════════════════════════════════════
     
      setProgressStep('payment');
      onStepUpdate?.('payment', 'pending');
      const paymentRes = await idempiereApi('/models/c_payment', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID: { id: clientId },
          AD_Org_ID:    { id: orgId },
          C_BPartner_ID: { id: parseInt(vendorId) },
          C_DocType_ID:       { id: paymentDocTypeId },
          C_DocTypeTarget_ID: { id: paymentDocTypeId },
          DateTrx:      todayISO,
          DateAcct:     todayISO,
          IsReceipt:    false, // false = uang KELUAR (kita bayar vendor)
          TenderType:   paymentTenderType,
          PayAmt:       invoiceGrandTotal,
          ...(bankAccountId ? { C_BankAccount_ID: { id: parseInt(bankAccountId) } } : {}),
        }),
      });
      const paymentId = fkId(paymentRes.id) ?? paymentRes.id ?? paymentRes.C_Payment_ID;
      if (!paymentId) throw new Error('Gagal mendapatkan C_Payment_ID.');
      created.paymentId = paymentId;
      
      // ── Isi Payment Allocation SEBELUM Payment di-Complete ──────────────
      // (setara mengisi tab "Payment Allocation" saat header masih Draft di
      // Windows client — pilih invoice + nominal yang mau dibayar).
      await idempiereApi('/models/c_paymentallocate', {
        method: 'POST',
        body: JSON.stringify({
          AD_Org_ID:    { id: orgId },
          C_Payment_ID: { id: paymentId },
          C_Invoice_ID: { id: invoiceId },
          Amount:       invoiceGrandTotal, // full payment — sesuaikan kalau nanti support partial/under-over
        }),
      });
      
      // ── Complete Payment → trigger auto-generate AllocationHdr/Line ────
      const completedPayment = await idempiereApi(`/models/c_payment/${paymentId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });
      const paymentFinalStatus = completedPayment.DocStatus?.id ?? completedPayment.DocStatus;
      if (paymentFinalStatus !== 'CO' && paymentFinalStatus !== 'CL') {
        throw new Error(
          `Payment gagal Complete (status: ${paymentFinalStatus || 'tidak diketahui'}). ` +
          `Kemungkinan total baris Payment Allocation belum sama dengan PayAmt di header — cek langsung di iDempiere.`
        );
      }
      onStepUpdate?.('payment', 'success', { id: paymentId, documentNo: completedPayment.DocumentNo });
      // ═══════════════════════════════════════════════════════════════════
            
      return {
        poId, receiptId, invoiceId, paymentId,
        grandTotal: invoiceGrandTotal,
        vendorName: vendorName || `#${vendorId}`,
        date: new Date().toLocaleString('id-ID'),
        items: [...cart],
      };

    } catch (err) {
      // Jangan biarkan user mengira SEMUA gagal — kasih tahu step mana yang
      // sukses, supaya bisa dilanjutkan manual dari titik itu di iDempiere.
      const doneList = Object.entries(created)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      onError?.(
        `Gagal pada tahap "${progressStep}": ${err.message}` +
        (doneList ? `\n\nDokumen yang SUDAH berhasil dibuat (perlu ditindaklanjuti manual):\n${doneList}` : ''),
        'Proses Terhenti'
      );
      onStepUpdate?.(progressStep, 'error', { message: err.message });
      onError?.(`Gagal pada tahap "${progressStep}": ${err.message}`, 'Proses Terhenti');
      return null;
    } finally {
      setIsSubmitting(false);
      setProgressStep(null);
    }
  }, [poDocTypeId, receiptDocTypeId, invoiceDocTypeId, description, onError, onStepUpdate, progressStep]);

  return { submit, isSubmitting, progressStep };
}
