import { useState, useCallback } from 'react';
import { idempiereApi, fkId } from '../utils/idempiereApi';
import { getLoginInfo } from './useLoginInfo';
import { useUomConversion } from './useUomConversion';

// ─────────────────────────────────────────────────────────────────────────────
// usePurchaseOrderSubmit.jsx
// Inti dari requirement "kalau 1 FPB punya lebih dari 1 vendor, buat PO
// terpisah": cart di-groupBy C_BPartner_ID di sini, lalu untuk SETIAP
// vendor dibuatkan satu C_Order (header) + C_OrderLine (detail) SENDIRI,
// masing-masing langsung di-Complete. Kalau cart cuma punya 1 vendor,
// hasilnya ya cuma 1 PO seperti biasa — logic-nya sama, cuma loop 1x.
//
// MATCHING M_RequisitionLine ↔ C_OrderLine — FIELD NATIVE (iDempiere 13+):
// Link-nya SATU ARAH SAJA: M_RequisitionLine.C_OrderLine_ID → C_OrderLine.
// TIDAK ADA kolom M_RequisitionLine_ID di tabel C_OrderLine — tab "Purchase
// Order" di window Requisition sebenarnya query terbalik (cari C_OrderLine
// yang C_OrderLine_ID-nya cocok dengan M_RequisitionLine.C_OrderLine_ID),
// bukan lewat FK di sisi C_OrderLine. Jadi cukup update
// M_RequisitionLine.C_OrderLine_ID saja (lihat markRequisitionLineOrdered)
// — TIDAK perlu (dan TIDAK BISA) kirim field balik di payload C_OrderLine.
//   • M_RequisitionLine.C_OrderLine_ID — diisi begitu baris FPB dipakai
//     bikin 1 C_OrderLine. NULL = belum pernah di-PO-kan (biner, BUKAN
//     akumulasi qty — proses native pun cuma cek `== 0` untuk skip baris
//     yang sudah pernah diproses, tidak ada tracking qty parsial sama sekali).
//
// ── UOM ENTERED vs BASE (C_OrderLine) ───────────────────────────────────────
// item.Qty  = qty SEBAGAIMANA diinput/dibawa (dalam item.C_UOM_ID, "entered")
// item.C_UOM_ID   = UOM entered (dari cart manual ATAU dari FPB, lihat
//                    PurchasingContainer.jsx & RequisitionToPOImportModal.jsx)
// item.BaseUOM_ID = UOM DASAR produk (M_Product.C_UOM_ID) — WAJIB ada di
//                    setiap cart item supaya konversi di bawah benar. Kalau
//                    tidak ada (cart item lama/kompatibilitas), fallback ke
//                    item.C_UOM_ID sendiri (dianggap tidak perlu konversi).
//
// C_OrderLine punya pasangan field serupa (QtyEntered/QtyOrdered +
// PriceEntered/PriceActual), jadi konversinya SIMETRIS:
//   QtyOrdered  = QtyEntered  × MultiplyRate   (mis. 5 Dus → 60 pcs)
//   PriceActual = PriceEntered ÷ MultiplyRate  (harga per pcs, bukan per Dus)
// — pola pembagian harga ini sudah dikonfirmasi & dipakai di modul Internal
// Use (useUomConversion.toBaseQty rekannya, di sisi harga dilakukan manual
// di bawah karena arahnya kebalikan dari qty).
//
// RETURN CONTRACT — PENTING:
// submit() SEKARANG mengembalikan { results, hadError }, BUKAN array
// langsung. Ini supaya pemanggil (PurchasingContainer) bisa membedakan
// "semua vendor berhasil" vs "sebagian vendor gagal, tapi ada PO yang
// terlanjur berhasil dibuat sebelum errornya" — sebelumnya kedua kasus ini
// SAMA-SAMA cuma mengembalikan array hasil, sehingga UI salah kira semuanya
// sukses walau ada error di tengah proses (Dialog error jadi ketutup oleh
// Success Modal). Lihat PurchasingContainer.jsx untuk cara pemakaiannya.
// ─────────────────────────────────────────────────────────────────────────────
export function usePurchaseOrderSubmit({ docTypeId, defaultDescription, onError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetchUomOptions } = useUomConversion();

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

  // Cari MultiplyRate untuk 1 item cart — dari UOM entered ke UOM dasar
  // produk. Kalau entered == base (atau BaseUOM_ID tidak ada / tidak
  // valid), rate = 1 (tidak perlu fetch, tidak perlu konversi).
  const resolveMultiplyRate = useCallback(async (item) => {
    const enteredUomId = parseInt(item.C_UOM_ID);
    const baseUomId    = parseInt(item.BaseUOM_ID || item.C_UOM_ID);
    if (!baseUomId || enteredUomId === baseUomId) return 1;

    const options = await fetchUomOptions(item.M_Product_ID, baseUomId, null);
    const match = options.find(o => o.C_UOM_ID === enteredUomId);
    if (!match) {
      console.warn(
        `[usePurchaseOrderSubmit] tidak ditemukan C_UOM_Conversion untuk produk #${item.M_Product_ID} ` +
        `(UOM entered ${enteredUomId} → base ${baseUomId}). MultiplyRate dianggap 1 — CEK MANUAL PO ini.`
      );
      return 1;
    }
    return match.multiplyRate;
  }, [fetchUomOptions]);

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
            // Cukup diisi user yang sedang login, tidak perlu setup
            // "Sales Rep" khusus di window User.
            ...(userId ? { SalesRep_ID: { id: parseInt(userId) } } : {}),
          }),
        });
        const orderId = headerRes.id ?? headerRes.C_Order_ID;
        if (!orderId) throw new Error(`Gagal membuat header PO untuk vendor "${vendorName}".`);

        // ── Lines C_OrderLine ─────────────────────────────────────────────
        for (const item of items) {
          const qtyEntered   = parseFloat(item.Qty || 0);
          const priceEntered = parseFloat(item.Price || 0);
          const multiplyRate = await resolveMultiplyRate(item);

          const qtyOrdered  = qtyEntered * multiplyRate;
          const priceActual = multiplyRate ? priceEntered / multiplyRate : priceEntered;

          const lineRes = await idempiereApi('/models/c_orderline', {
            method: 'POST',
            body: JSON.stringify({
              AD_Org_ID:      { id: orgId },
              C_Order_ID:     { id: orderId },
              M_Product_ID:   { id: parseInt(item.M_Product_ID) },
              C_UOM_ID:       { id: parseInt(item.C_UOM_ID) }, // UOM entered — bukan base
              QtyEntered:     qtyEntered,
              QtyOrdered:     qtyOrdered,   // ← dikonversi ke UOM dasar produk
              PriceEntered:   priceEntered,
              PriceActual:    priceActual,  // ← dikonversi jadi harga per UOM dasar
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

        // iDempiere REST kadang mengembalikan HTTP 200 walau dokumen GAGAL
        // divalidasi saat Complete (mis. field mandatory kosong) — body-nya
        // tetap berisi DocStatus lama (bukan 'CO') tanpa melempar HTTP error.
        // Tanpa pengecekan ini, baris ini akan dianggap "berhasil" padahal
        // dokumennya masih Draft/In Progress — sumber bug "PO jadi draft
        // tanpa error yang kelihatan".
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
          // Total di sini pakai qty & harga ENTERED (item.Qty × item.Price) —
          // ini benar apa adanya karena entered×entered = total yang sama
          // terlepas dari UOM apa pun dipakai (tidak perlu ikut dikonversi).
          total: items.reduce((s, i) => s + i.Qty * (i.Price || 0), 0),
        });
      }

      if (matchFailures.length > 0) {
        onError?.(
          `PO berhasil dibuat, tapi ${matchFailures.length} baris gagal ter-update status "sudah di-PO" di FPB asal:\n` +
          matchFailures.map(n => `• ${n}`).join('\n') +
          `\n\nIni tidak mempengaruhi PO yang sudah dibuat, tapi FPB terkait mungkin masih muncul lagi di daftar import (perlu dicek manual). ` +
          `Kemungkinan penyebab: versi iDempiere Anda belum punya kolom M_RequisitionLine.C_OrderLine_ID (field ini baru ada di iDempiere 13+).`,
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
      // Kembalikan hasil yang sudah berhasil (kalau ada) SEKALIGUS tandai
      // hadError:true — supaya UI tahu harus menampilkan Dialog error
      // TERLEBIH DAHULU sebelum (atau selain) success modal, bukan malah
      // langsung menganggap semuanya sukses.
      return { results: results.length > 0 ? results : null, hadError: true };
    } finally {
      setIsSubmitting(false);
    }
  }, [docTypeId, defaultDescription, onError, markRequisitionLineOrdered, resolveMultiplyRate]);

  return { submit, isSubmitting };
}
