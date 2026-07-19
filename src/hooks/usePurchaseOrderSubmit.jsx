import { useState, useCallback } from 'react';
import { idempiereApi, fkId } from '../utils/idempiereApi';
import { getLoginInfo } from './useLoginInfo';
import { useUomConversion } from './useUomConversion';

// ─────────────────────────────────────────────────────────────────────────────
// usePurchaseOrderSubmit.jsx
// Inti dari requirement "kalau 1 FPB punya lebih dari 1 vendor, buat PO
// terpisah": cart di-groupBy C_BPartner_ID di sini, lalu untuk SETIAP
// vendor dibuatkan satu C_Order (header) + C_OrderLine (detail) SENDIRI,
// masing-masing langsung di-Complete.
//
// MATCHING M_RequisitionLine ↔ C_OrderLine — FIELD NATIVE (iDempiere 13+):
// Link-nya SATU ARAH SAJA: M_RequisitionLine.C_OrderLine_ID → C_OrderLine.
// Cukup update M_RequisitionLine.C_OrderLine_ID saja (lihat
// markRequisitionLineOrdered).
//
// ── UOM ENTERED vs BASE — 2 SUMBER, TERGANTUNG ASAL ITEM ──────────────────
// A) Item dari IMPORT FPB (item.sourceRequisitionLineId ada):
//    QtyOrdered diambil LANGSUNG dari item.BaseQty (= M_RequisitionLine.Qty,
//    sudah dikonversi dengan benar sekali saat FPB disubmit — lihat
//    useRequisitionSubmit.jsx & RequisitionToPOImportModal.jsx). TIDAK
//    dihitung ulang lewat C_UOM_Conversion di sini — menghindari 2 titik
//    hitung konversi yang bisa beda hasil kalau data C_UOM_Conversion
//    berubah di antara FPB dibuat dan PO disubmit.
//
// B) Item ditambah MANUAL ke cart PO (search produk langsung di Purchasing,
//    tanpa lewat FPB — tidak ada sourceRequisitionLineId, tidak ada
//    BaseQty): QtyOrdered dihitung via toBaseQty() dari useUomConversion,
//    persis seperti sebelumnya — karena item ini tidak punya qty base
//    yang sudah dihitung di tempat lain.
//
// PriceActual, di KEDUA kasus, diturunkan dari rasio qty — BUKAN dari rate
// terpisah — supaya Line Amount selalu konsisten (PriceEntered×QtyEntered
// == PriceActual×QtyOrdered) apa pun sumber qty-nya:
//     PriceActual = (PriceEntered × QtyEntered) ÷ QtyOrdered
//
// RETURN CONTRACT: submit() mengembalikan { results, hadError } — supaya
// pemanggil (PurchasingContainer) bisa membedakan "semua vendor berhasil"
// vs "sebagian gagal, tapi ada PO yang terlanjur berhasil dibuat".
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

  // Cari objek UOM (untuk toBaseQty) — HANYA dipakai untuk item MANUAL
  // (tanpa BaseQty siap pakai dari FPB). Return null kalau entered == base
  // (atau BaseUOM_ID tidak ada/valid) — toBaseQty pakai rate default 1.
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

  // QtyOrdered untuk 1 item cart — cabang A (dari FPB, pakai BaseQty apa
  // adanya) atau cabang B (manual, hitung via toBaseQty).
  const resolveQtyOrdered = useCallback(async (item, qtyEntered) => {
    const hasPrecomputedBaseQty = item.sourceRequisitionLineId && item.BaseQty != null && !isNaN(parseFloat(item.BaseQty));
    if (hasPrecomputedBaseQty) {
      return parseFloat(item.BaseQty); // ← dari FPB, apa adanya, tidak dihitung ulang
    }
    const selectedUom = await resolveSelectedUom(item);
    return toBaseQty(qtyEntered, selectedUom); // ← item manual, hitung via konversi
  }, [resolveSelectedUom, toBaseQty]);

  const submit = useCallback(async (cart, { warehouseId, description } = {}) => {
    if (cart.length === 0) {
      onError?.('Daftar Purchase Order masih kosong!');
      return { results: null, hadError: true };
    }

    // Fallback ke default kalau user tidak isi manual
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

    const { orgId, clientId, userId } = getLoginInfo();
    if (!orgId || !clientId || !warehouseId) {
      onError?.('Data sesi/gudang tidak lengkap.\nSilakan login kembali.', 'Error');
      return { results: null, hadError: true };
    }

    setIsSubmitting(true);
    const results = [];
    const matchFailures = []; // baris yang PO-nya sukses tapi match-table gagal ter-update

    try {
      // ── Kelompokkan cart per vendor — 1 grup = 1 PO ────────────────────
      const groups = new Map();
      cart.forEach(item => {
        const key = item.C_BPartner_ID;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      });

      const todayISO = new Date().toISOString().split('T')[0];

      for (const [vendorId, items] of groups.entries()) {
        const vendorName = items[0].VendorName;

        // Lokasi vendor wajib ada untuk Complete dokumen — kalau item belum
        // bawa locationId (mis. dari import FPB yang cuma dapat vendor dari
        // M_Product_PO tanpa lokasi), fetch di sini.
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

        // ── Header C_Order ────────────────────────────────────────────────
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
            IsSOTrx:                false, // sisi pembelian
            Description:            finalDescription,
            IsActive:               true,
            // "Company Agent" di window Purchase Order = kolom SalesRep_ID
            // (FK ke AD_User) — mandatory di sebagian setup iDempiere.
            ...(userId ? { SalesRep_ID: { id: parseInt(userId) } } : {}),
          }),
        });
        const orderId = headerRes.id ?? headerRes.C_Order_ID;
        if (!orderId) throw new Error(`Gagal membuat header PO untuk vendor "${vendorName}".`);

        // ── Lines C_OrderLine ─────────────────────────────────────────────
        for (const item of items) {
          const qtyEntered   = parseFloat(item.Qty || 0);
          const priceEntered = parseFloat(item.Price || 0);

          const qtyOrdered  = await resolveQtyOrdered(item, qtyEntered);
          const priceActual = qtyOrdered > 0 ? (priceEntered * qtyEntered) / qtyOrdered : priceEntered;

          const lineRes = await idempiereApi('/models/c_orderline', {
            method: 'POST',
            body: JSON.stringify({
              AD_Org_ID:      { id: orgId },
              C_Order_ID:     { id: orderId },
              M_Product_ID:   { id: parseInt(item.M_Product_ID) },
              C_UOM_ID:       { id: parseInt(item.C_UOM_ID) }, // UOM entered — bukan base
              QtyEntered:     qtyEntered,
              QtyOrdered:     qtyOrdered,   // ← dari BaseQty (FPB) atau toBaseQty (manual)
              PriceEntered:   priceEntered,
              PriceActual:    priceActual,  // ← diturunkan dari rasio qty, konsisten otomatis
              ...(item.sourceRequisitionLineId
                ? { Description: `Ref. FPB Line #${item.sourceRequisitionLineId}` }
                : {}),
            }),
          });

          // ── Tandai baris FPB sebagai sudah di-PO-kan ────────────────────
          if (item.sourceRequisitionLineId) {
            const orderLineId = lineRes.id ?? lineRes.C_OrderLine_ID;
            const ok = await markRequisitionLineOrdered(item.sourceRequisitionLineId, orderLineId);
            if (!ok) matchFailures.push(item.Name);
          }
        }

        // ── Complete dokumen ─────────────────────────────────────────────
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

        results.push({
          documentNo: completedRes.DocumentNo || `PO-${orderId}`,
          vendorName,
          date: new Date().toLocaleString('id-ID'),
          items,
          total: items.reduce((s, i) => s + i.Qty * (i.Price || 0), 0),
        });
      }

      if (matchFailures.length > 0) {
        onError?.(
          `PO berhasil dibuat, tapi ${matchFailures.length} baris gagal ter-update status "sudah di-PO" di FPB asal:\n` +
          matchFailures.map(n => `• ${n}`).join('\n') +
          `\n\nIni tidak mempengaruhi PO yang sudah dibuat, tapi FPB terkait mungkin masih muncul lagi di daftar import (perlu dicek manual).`,
          'Peringatan: Update Status FPB Gagal'
        );
        return { results, hadError: true };
      }

      return { results, hadError: false };
    } catch (err) {
      onError?.(
        `Gagal membuat Purchase Order:\n\n${err.message}` +
        (results.length > 0
          ? `\n\n${results.length} PO SUDAH berhasil dibuat sebelum error ini terjadi:\n` +
            results.map(r => `• ${r.documentNo} (${r.vendorName})`).join('\n')
          : ''),
        'Error'
      );
      return { results: results.length > 0 ? results : null, hadError: true };
    } finally {
      setIsSubmitting(false);
    }
  }, [docTypeId, defaultDescription, onError, markRequisitionLineOrdered, resolveQtyOrdered]);

  return { submit, isSubmitting };
}
