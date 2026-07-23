import { useState, useCallback } from 'react';
import { idempiereApi, fkId } from '../utils/idempiereApi';
import { getLoginInfo } from './useLoginInfo';
import { useUomConversion } from './useUomConversion';

// ─────────────────────────────────────────────────────────────────────────────
// usePurchaseOrderSubmit.jsx
//
// MODE NORMAL (editOrderId = null): cart di-groupBy C_BPartner_ID, lalu untuk
// SETIAP vendor dibuatkan satu C_Order (header) + C_OrderLine (detail) BARU.
// 1 klik submit bisa menghasilkan BEBERAPA nomor dokumen PO sekaligus (1 per
// vendor) — sesuai requirement "kalau 1 FPB punya >1 vendor, buat PO terpisah".
//
// MODE EDIT (editOrderId diisi): meng-update SATU C_Order yang SUDAH ADA.
// KARENA proses normal di atas menjamin 1 dokumen PO = 1 vendor, PurchasingList
// juga hanya akan pernah mengirim cart utk edit dari 1 PO / 1 vendor. Maka:
//   - Cart WAJIB berisi 1 vendor saja, dan HARUS vendor yang sama dengan PO
//     yang sedang di-edit (vendor tidak bisa diganti lewat mode edit — kalau
//     butuh vendor lain, batalkan edit & buat PO baru).
//   - Header di-UPDATE (bukan create baru), lines lama dihapus lalu diganti
//     lines baru (pola sama dengan useRequisitionSubmit mode edit).
//   - FPB (M_RequisitionLine) yang tadinya ter-link ke line lama TAPI tidak
//     lagi ada di cart baru → otomatis di-UNMARK (C_OrderLine_ID di-null-kan)
//     supaya baris FPB itu bisa muncul lagi utk di-import ke PO lain.
//
// submitMode ('draft' | 'complete', default 'complete') — SAMA pola dengan
// useRequisitionSubmit.jsx:
//   - 'complete' -> doc-action 'CO' dipanggil setelah data tersimpan.
//   - 'draft'    -> TIDAK ada doc-action yang dipanggil sama sekali -> tetap Drafted.
//
// MATCHING M_RequisitionLine ↔ C_OrderLine — FIELD NATIVE (iDempiere 13+):
// Link-nya SATU ARAH SAJA: M_RequisitionLine.C_OrderLine_ID → C_OrderLine.
// PENTING: baris FPB HANYA ditandai "sudah di-PO-kan" kalau submitMode ===
// 'complete' — supaya FPB tidak dianggap selesai di-follow-up selama PO-nya
// sendiri masih draft (berlaku juga saat insert ulang lines di mode edit).
//
// ── UOM ENTERED vs BASE — 2 SUMBER, TERGANTUNG ASAL ITEM ──────────────────
// A) Item dari IMPORT FPB (item.sourceRequisitionLineId ada): QtyOrdered
//    diambil LANGSUNG dari item.BaseQty (sudah dikonversi benar sekali saat
//    FPB disubmit). TIDAK dihitung ulang di sini.
// B) Item MANUAL (tanpa sourceRequisitionLineId): QtyOrdered dihitung via
//    toBaseQty() dari useUomConversion.
// PriceActual, di KEDUA kasus, diturunkan dari rasio qty:
//     PriceActual = (PriceEntered × QtyEntered) ÷ QtyOrdered
//
// RETURN CONTRACT: submit() mengembalikan { results, hadError }. Setiap entry
// di `results` punya field `status: 'Draft' | 'Completed'`.
// ─────────────────────────────────────────────────────────────────────────────
export function usePurchaseOrderSubmit({ docTypeId, defaultDescription, onError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetchUomOptions, toBaseQty } = useUomConversion();

  const markRequisitionLineOrdered = useCallback(async (requisitionLineId, orderLineId) => {
    try {
      await idempiereApi(`/models/m_requisitionline/${requisitionLineId}`, {
        method: 'PUT',
        body: JSON.stringify({ C_OrderLine_ID: { id: orderLineId } }),
      });
      return true;
    } catch (err) {
      console.error(`[usePurchaseOrderSubmit] gagal update M_RequisitionLine.C_OrderLine_ID #${requisitionLineId}:`, err);
      return false;
    }
  }, []);

  // Unmark FPB line — dipakai saat edit membuang line yang tadinya dari FPB.
  const unmarkRequisitionLineOrdered = useCallback(async (requisitionLineId) => {
    try {
      await idempiereApi(`/models/m_requisitionline/${requisitionLineId}`, {
        method: 'PUT',
        body: JSON.stringify({ C_OrderLine_ID: null }),
      });
      return true;
    } catch (err) {
      console.error(`[usePurchaseOrderSubmit] gagal unmark M_RequisitionLine.C_OrderLine_ID #${requisitionLineId}:`, err);
      return false;
    }
  }, []);

  // Cari objek UOM (untuk toBaseQty) — HANYA dipakai untuk item MANUAL.
  const resolveSelectedUom = useCallback(async (item) => {
    const enteredUomId = parseInt(item.C_UOM_ID);
    const baseUomId    = parseInt(item.BaseUOM_ID || item.C_UOM_ID);
    if (!baseUomId || enteredUomId === baseUomId) return null;

    const options = await fetchUomOptions(item.M_Product_ID, baseUomId, null);
    const match = options.find(o => o.C_UOM_ID === enteredUomId);
    if (!match) {
      console.warn(
        `[usePurchaseOrderSubmit] tidak ditemukan C_UOM_Conversion untuk produk #${item.M_Product_ID} ` +
        `(UOM entered ${enteredUomId} → base ${baseUomId}). Qty tidak dikonversi — CEK MANUAL PO ini.`
      );
      return null;
    }
    return match;
  }, [fetchUomOptions]);

  const resolveQtyOrdered = useCallback(async (item, qtyEntered) => {
    const hasPrecomputedBaseQty = item.sourceRequisitionLineId && item.BaseQty != null && !isNaN(parseFloat(item.BaseQty));
    if (hasPrecomputedBaseQty) {
      return parseFloat(item.BaseQty);
    }
    const selectedUom = await resolveSelectedUom(item);
    return toBaseQty(qtyEntered, selectedUom);
  }, [resolveSelectedUom, toBaseQty]);

  // Insert 1 C_OrderLine untuk 1 item cart — dipakai baik di mode normal
  // (loop per vendor) maupun mode edit (1 order saja). Mengembalikan
  // { ok, name } untuk pelaporan matchFailures kalau linking FPB gagal.
  const insertOrderLine = useCallback(async (orderId, orgId, item, submitMode) => {
    const qtyEntered   = parseFloat(item.Qty || 0);
    const priceEntered = parseFloat(item.Price || 0);
    const qtyOrdered   = await resolveQtyOrdered(item, qtyEntered);
    const priceActual  = qtyOrdered > 0 ? (priceEntered * qtyEntered) / qtyOrdered : priceEntered;

    const lineRes = await idempiereApi('/models/c_orderline', {
      method: 'POST',
      body: JSON.stringify({
        AD_Org_ID:    { id: orgId },
        C_Order_ID:   { id: orderId },
        M_Product_ID: { id: parseInt(item.M_Product_ID) },
        C_UOM_ID:     { id: parseInt(item.C_UOM_ID) },
        QtyEntered:   qtyEntered,
        QtyOrdered:   qtyOrdered,
        PriceEntered: priceEntered,
        PriceActual:  priceActual,
        ...(item.sourceRequisitionLineId
          ? { Description: `Ref. FPB Line #${item.sourceRequisitionLineId}` }
          : {}),
      }),
    });

    if (item.sourceRequisitionLineId && submitMode === 'complete') {
      const orderLineId = lineRes.id ?? lineRes.C_OrderLine_ID;
      const ok = await markRequisitionLineOrdered(item.sourceRequisitionLineId, orderLineId);
      return { ok, name: item.Name };
    }
    return { ok: true, name: item.Name };
  }, [resolveQtyOrdered, markRequisitionLineOrdered]);

  // Jalankan doc-action (atau tidak) sesuai submitMode, kembalikan {docNo, status}.
  const finalizeOrder = useCallback(async (orderId, submitMode, vendorName) => {
    if (submitMode === 'complete') {
      const completedRes = await idempiereApi(`/models/c_order/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });
      const finalStatus = completedRes.DocStatus?.id ?? completedRes.DocStatus;
      if (finalStatus !== 'CO' && finalStatus !== 'CL') {
        throw new Error(
          `PO untuk vendor "${vendorName}" (${completedRes.DocumentNo || `#${orderId}`}) gagal di-Complete ` +
          `(status: ${finalStatus || 'tidak diketahui'}). ` +
          `Kemungkinan ada field wajib yang belum terisi (mis. Company Agent) — cek dokumen ini langsung di iDempiere.`
        );
      }
      return { docNo: completedRes.DocumentNo || `PO-${orderId}`, status: 'Completed' };
    }
    // draft — tidak ada doc-action sama sekali
    const draftRes = await idempiereApi(`/models/c_order/${orderId}?$select=DocumentNo,DocStatus`);
    return { docNo: draftRes.DocumentNo || `PO-${orderId}`, status: 'Draft' };
  }, []);

  const submit = useCallback(async (cart, { warehouseId, description, submitMode = 'complete', editOrderId = null } = {}) => {
    if (cart.length === 0) {
      onError?.('Daftar Purchase Order masih kosong!');
      return { results: null, hadError: true };
    }

    const finalDescription = (description && description.trim()) || defaultDescription;

    const missingVendor = cart.filter(i => !i.C_BPartner_ID);
    if (missingVendor.length > 0) {
      onError?.(
        `${missingVendor.length} produk belum ditentukan vendor-nya:\n` +
        missingVendor.map(i => `• ${i.Name}`).join('\n'),
        'Vendor Belum Lengkap'
      );
      return { results: null, hadError: true };
    }

    // ── Mode edit: cart WAJIB 1 vendor saja ──────────────────────────────
    if (editOrderId) {
      const vendorIds = new Set(cart.map(i => String(i.C_BPartner_ID)));
      if (vendorIds.size > 1) {
        onError?.(
          'Saat mode edit, PO hanya boleh berisi 1 vendor (sesuai PO yang sedang di-edit).\n' +
          'Kalau butuh vendor lain, batalkan edit lalu buat PO baru dari FPB.',
          'Vendor Tidak Konsisten'
        );
        return { results: null, hadError: true };
      }
    }

    const { orgId, clientId, userId } = getLoginInfo();
    if (!orgId || !clientId || !warehouseId) {
      onError?.('Data sesi/gudang tidak lengkap.\nSilakan login kembali.', 'Error');
      return { results: null, hadError: true };
    }

    setIsSubmitting(true);
    const results = [];
    const matchFailures = [];
    const todayISO = new Date().toISOString().split('T')[0];

    try {
      if (editOrderId) {
        // ══════════════════════════════════════════════════════════════════
        // MODE EDIT — update 1 PO yang sudah ada, 1 vendor terkunci
        // ══════════════════════════════════════════════════════════════════
        const vendorId   = cart[0].C_BPartner_ID;
        const vendorName = cart[0].VendorName;

        const currentOrderRes = await idempiereApi(
          `/models/c_order/${editOrderId}?$select=DocStatus,C_BPartner_ID,C_BPartner_Location_ID`
        );
        const currentStatus  = currentOrderRes?.DocStatus?.id ?? currentOrderRes?.DocStatus ?? null;
        const existingVendorId = fkId(currentOrderRes?.C_BPartner_ID) ?? currentOrderRes?.C_BPartner_ID?.id;

        if (existingVendorId && String(existingVendorId) !== String(vendorId)) {
          throw new Error(
            `PO ini terdaftar untuk vendor lain (ID #${existingVendorId}).\n` +
            `Vendor tidak bisa diganti lewat mode edit — batalkan edit dan buat PO baru kalau perlu vendor berbeda.`
          );
        }

        let vendorLocationId = cart[0].C_BPartner_Location_ID
          || fkId(currentOrderRes?.C_BPartner_Location_ID)
          || currentOrderRes?.C_BPartner_Location_ID?.id;
        if (!vendorLocationId) {
          const locRes = await idempiereApi(
            `/models/c_bpartner_location?$select=C_BPartner_Location_ID&$filter=C_BPartner_ID eq ${vendorId} and IsActive eq true&$top=1`
          );
          const locRecords = Array.isArray(locRes.records) ? locRes.records : [];
          vendorLocationId = locRecords[0] ? (fkId(locRecords[0].C_BPartner_Location_ID) ?? locRecords[0].id) : null;
        }
        if (!vendorLocationId) {
          throw new Error(`Vendor "${vendorName}" tidak memiliki alamat aktif (C_BPartner_Location).\nTambahkan alamat vendor terlebih dahulu di Business Partner.`);
        }

        // ── Update header ──────────────────────────────────────────────
        await idempiereApi(`/models/c_order/${editOrderId}`, {
          method: 'PUT',
          body: JSON.stringify({
            M_Warehouse_ID:          { id: parseInt(warehouseId) },
            C_BPartner_Location_ID:  { id: parseInt(vendorLocationId) },
            DateOrdered:             todayISO,
            Description:             finalDescription,
          }),
        });

        // ── Ambil lines lama + FPB yang masih ter-link ke lines itu ─────
        const oldLinesRes = await idempiereApi(
          `/models/c_orderline?$filter=C_Order_ID eq ${editOrderId}&$select=C_OrderLine_ID`
        );
        const oldLines   = Array.isArray(oldLinesRes.records) ? oldLinesRes.records : [];
        const oldLineIds = oldLines.map(l => l.id ?? l.C_OrderLine_ID);

        let oldLinkedReqLines = [];
        if (oldLineIds.length > 0) {
          const filterStr = oldLineIds.map(id => `C_OrderLine_ID eq ${id}`).join(' or ');
          const linkedRes = await idempiereApi(
            `/models/m_requisitionline?$filter=${filterStr}&$select=M_RequisitionLine_ID,C_OrderLine_ID`
          );
          oldLinkedReqLines = Array.isArray(linkedRes.records) ? linkedRes.records : [];
        }

        // ── Hapus semua line lama ────────────────────────────────────────
        for (const lineId of oldLineIds) {
          await idempiereApi(`/models/c_orderline/${lineId}`, { method: 'DELETE' });
        }

        // ── Unmark FPB line lama yang TIDAK ada lagi di cart baru ───────
        const keptReqLineIds = new Set(
          cart.filter(i => i.sourceRequisitionLineId).map(i => String(i.sourceRequisitionLineId))
        );
        for (const reqLine of oldLinkedReqLines) {
          const reqLineId = reqLine.id ?? reqLine.M_RequisitionLine_ID;
          if (!keptReqLineIds.has(String(reqLineId))) {
            const ok = await unmarkRequisitionLineOrdered(reqLineId);
            if (!ok) matchFailures.push(`(unmark) FPB line #${reqLineId}`);
          }
        }

        // ── Insert lines baru ────────────────────────────────────────────
        for (const item of cart) {
          const { ok, name } = await insertOrderLine(editOrderId, orgId, item, submitMode);
          if (!ok) matchFailures.push(name);
        }

        // ── Reset workflow kalau status lama NA (hanya relevan utk complete) ──
        if (currentStatus === 'NA' && submitMode === 'complete') {
          await idempiereApi(`/models/c_order/${editOrderId}`, {
            method: 'PUT',
            body: JSON.stringify({ 'doc-action': 'PR' }),
          });
        }

        // ── Complete / draft ─────────────────────────────────────────────
        const { docNo, status } = await finalizeOrder(editOrderId, submitMode, vendorName);

        results.push({
          documentNo: docNo,
          status,
          vendorName,
          date: new Date().toLocaleString('id-ID'),
          items: [...cart],
          total: cart.reduce((s, i) => s + i.Qty * (i.Price || 0), 0),
        });

      } else {
        // ══════════════════════════════════════════════════════════════════
        // MODE NORMAL — group-by-vendor, bikin PO baru per vendor
        // ══════════════════════════════════════════════════════════════════
        const groups = new Map();
        cart.forEach(item => {
          const key = item.C_BPartner_ID;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(item);
        });

        for (const [vendorId, items] of groups.entries()) {
          const vendorName = items[0].VendorName;

          let vendorLocationId = items[0].C_BPartner_Location_ID;
          if (!vendorLocationId) {
            const locRes = await idempiereApi(
              `/models/c_bpartner_location?$select=C_BPartner_Location_ID&$filter=C_BPartner_ID eq ${vendorId} and IsActive eq true&$top=1`
            );
            const locRecords = Array.isArray(locRes.records) ? locRes.records : [];
            vendorLocationId = locRecords[0] ? (fkId(locRecords[0].C_BPartner_Location_ID) ?? locRecords[0].id) : null;
          }
          if (!vendorLocationId) {
            throw new Error(`Vendor "${vendorName}" tidak memiliki alamat aktif (C_BPartner_Location).\nTambahkan alamat vendor terlebih dahulu di Business Partner.`);
          }

          const headerRes = await idempiereApi('/models/c_order', {
            method: 'POST',
            body: JSON.stringify({
              AD_Client_ID:           { id: clientId },
              AD_Org_ID:              { id: orgId },
              C_DocType_ID:           { id: docTypeId },
              C_DocTypeTarget_ID:     { id: docTypeId },
              C_BPartner_ID:          { id: parseInt(vendorId) },
              C_BPartner_Location_ID: { id: parseInt(vendorLocationId) },
              M_Warehouse_ID:         { id: parseInt(warehouseId) },
              DateOrdered:            todayISO,
              IsSOTrx:                false,
              Description:            finalDescription,
              IsActive:               true,
              ...(userId ? { SalesRep_ID: { id: parseInt(userId) } } : {}),
            }),
          });
          const orderId = headerRes.id ?? headerRes.C_Order_ID;
          if (!orderId) throw new Error(`Gagal membuat header PO untuk vendor "${vendorName}".`);

          for (const item of items) {
            const { ok, name } = await insertOrderLine(orderId, orgId, item, submitMode);
            if (!ok) matchFailures.push(name);
          }

          const { docNo, status } = await finalizeOrder(orderId, submitMode, vendorName);

          results.push({
            documentNo: docNo,
            status,
            vendorName,
            date: new Date().toLocaleString('id-ID'),
            items,
            total: items.reduce((s, i) => s + i.Qty * (i.Price || 0), 0),
          });
        }
      }

      if (matchFailures.length > 0) {
        onError?.(
          `PO berhasil diproses, tapi ${matchFailures.length} baris gagal ter-update link FPB:\n` +
          matchFailures.map(n => `• ${n}`).join('\n') +
          `\n\nIni tidak mempengaruhi PO yang sudah dibuat/diupdate, tapi status FPB terkait mungkin tidak akurat (perlu dicek manual).`,
          'Peringatan: Update Status FPB Gagal'
        );
        return { results, hadError: true };
      }

      return { results, hadError: false };
    } catch (err) {
      onError?.(
        `Gagal memproses Purchase Order:\n\n${err.message}` +
        (results.length > 0
          ? `\n\n${results.length} PO SUDAH berhasil diproses sebelum error ini terjadi:\n` +
            results.map(r => `• ${r.documentNo} (${r.vendorName})`).join('\n')
          : ''),
        'Error'
      );
      return { results: results.length > 0 ? results : null, hadError: true };
    } finally {
      setIsSubmitting(false);
    }
  }, [docTypeId, defaultDescription, onError, insertOrderLine, finalizeOrder, unmarkRequisitionLineOrdered]);

  return { submit, isSubmitting };
}