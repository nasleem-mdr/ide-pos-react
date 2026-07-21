import { useState, useCallback } from 'react';
import { idempiereApi } from '../utils/idempiereApi';
import { getLoginInfo } from './useLoginInfo';
import { useUomConversion } from './useUomConversion';

export function useRequisitionSubmit({ docTypeId, description: defaultDescription, onError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toBaseQty } = useUomConversion();

  // warehouseId sekarang diterima dari caller (RequisitionContainer),
  // bukan lagi hardcode dari session — supaya ikut warehouse yang dipilih user.
  //
  // editRequisitionId (opsional): jika diisi, fungsi ini akan UPDATE header +
  // hapus & insert ulang lines milik requisition tersebut, alih-alih membuat
  // dokumen baru. Mengikuti pola "Mode Edit" pada POSContainer.handleCheckout.
  //
  // description (opsional, param ke-5): diisi manual oleh user lewat textarea
  // di CartSidebar/CartPanel. Kalau kosong/tidak diisi, fallback ke
  // defaultDescription dari config awal (REQUISITION_CONFIG.DESCRIPTION).
  //
  // ── UOM ENTERED vs BASE + FALLBACK SEMENTARA ────────────────────────────
  // M_RequisitionLine idealnya punya kolom custom QtyEntered + C_UOM_ID
  // (diaktifkan) untuk menyimpan qty SEBAGAIMANA diinput user (mis. 5 Dus),
  // sedangkan Qty (native) TETAP diisi qty dalam UOM DASAR produk.
  //
  // SELAMA kolom QtyEntered belum tersedia di server (lihat diskusi:
  // Synchronize Column di demo.globalqss.com gagal execute ALTER TABLE
  // fisiknya, kemungkinan karena privilege DB dibatasi di server demo
  // publik) — insertRequisitionLine() di bawah akan otomatis FALLBACK:
  // coba kirim dengan QtyEntered dulu, kalau ditolak server karena kolom
  // tidak ada, kirim ulang TANPA field itu. Qty (base) yang dikirim tetap
  // hasil konversi yang benar di kedua jalur — jadi tidak ada bug data,
  // cuma histori "user input dalam UOM apa" belum tersimpan sampai kolom
  // itu benar-benar ada. Begitu kolomnya sudah dibuat di server Anda
  // sendiri, jalur utama akan otomatis "menyala" tanpa perlu ubah kode ini.
  const submit = useCallback(async (cart, requesterName, warehouseId, editRequisitionId = null, description = null) => {
    if (cart.length === 0) {
      onError?.('Daftar permintaan masih kosong!');
      return null;
    }

    const resolvedDescription = (description && description.trim()) ? description.trim() : defaultDescription;

    const { userId, orgId, clientId } = getLoginInfo();

    // warehouseId wajib ada — dari pilihan user atau fallback session
    const resolvedWarehouseId = warehouseId ?? getLoginInfo().warehouseId;
    if (!userId || !resolvedWarehouseId || !orgId || !clientId) {
      onError?.('Data sesi tidak lengkap.\nSilakan login kembali.', 'Error');
      return null;
    }

    setIsSubmitting(true);
    try {
      const todayISO = new Date().toISOString().split('T')[0];

      // Insert 1 baris FPB, dengan fallback otomatis kalau kolom QtyEntered
      // belum ada di server (lihat catatan panjang di atas).
      const insertRequisitionLine = async (reqId, item) => {
        const uomId      = item.selectedUom?.C_UOM_ID || item.C_UOM_ID;
        const qtyEntered = parseFloat(item.Qty);
        const qtyBase    = toBaseQty(qtyEntered, item.selectedUom); // selalu benar, terlepas dari fallback atau tidak

        const basePayload = {
          AD_Org_ID:        { id: orgId },
          M_Requisition_ID: { id: reqId },
          M_Product_ID:     { id: parseInt(item.M_Product_ID) },
          C_UOM_ID:         { id: parseInt(uomId) },
          Qty:              qtyBase,
          ...(item.VendorId ? { C_BPartner_ID: { id: parseInt(item.VendorId) } } : {}),
        };

        try {
          // Jalur UTAMA — pakai ini kalau kolom QtyEntered sudah ada di server.
          return await idempiereApi('/models/m_requisitionline', {
            method: 'POST',
            body: JSON.stringify({ ...basePayload, QtyEntered: qtyEntered }),
          });
        } catch (err) {
          const msg = String(err?.message || '');
          const looksLikeMissingColumn = /qtyentered/i.test(msg);
          if (!looksLikeMissingColumn) throw err; // error lain (bukan soal kolom) — jangan ditelan, lempar ke atas

          console.warn(
            '[useRequisitionSubmit] Kolom QtyEntered belum tersedia di server ini — ' +
            'insert ulang TANPA field itu (fallback sementara). Qty (base) tetap terkirim benar. ' +
            'Buat kolom QtyEntered di M_RequisitionLine untuk mengaktifkan histori UOM entered.'
          );
          return await idempiereApi('/models/m_requisitionline', {
            method: 'POST',
            body: JSON.stringify(basePayload),
          });
        }
      };
      
      let reqId;
      let headerRes;

      if (editRequisitionId) {
        // ── MODE EDIT: update header requisition yang sudah ada ────────────
        reqId = editRequisitionId;

        // Cek status dokumen saat ini — jika NA (Not Approved), iDempiere
        // mewajibkan langkah "Prepare" untuk mereset workflow sebelum bisa
        // "Complete" lagi. Loncat NA → CO langsung akan ditolak server.
        const currentRes = await idempiereApi(
          `/models/m_requisition/${reqId}?$select=DocStatus`
        );
        const currentStatus = currentRes?.DocStatus?.id ?? currentRes?.DocStatus ?? null;

        await idempiereApi(`/models/m_requisition/${reqId}`, {
          method: 'PUT',
          body: JSON.stringify({
            M_Warehouse_ID: { id: resolvedWarehouseId },
            DateRequired:   todayISO,
            Description:    resolvedDescription,
          }),
        });

        // Hapus semua line lama milik requisition ini
        const oldLinesRes = await idempiereApi(
          `/models/m_requisitionline?$filter=M_Requisition_ID eq ${reqId}&$select=M_RequisitionLine_ID`
        );
        const oldLines = Array.isArray(oldLinesRes.records) ? oldLinesRes.records : [];
        for (const line of oldLines) {
          const lineId = line.id ?? line.M_RequisitionLine_ID;
          await idempiereApi(`/models/m_requisitionline/${lineId}`, { method: 'DELETE' });
        }

        // Insert lines baru DULU, sebelum Prepare — supaya dokumen tidak
        // dalam kondisi kosong (0 lines) saat workflow di-reset. Beberapa
        // konfigurasi iDempiere menolak Prepare/Complete pada dokumen tanpa lines.
        for (const item of cart) {
          await insertRequisitionLine(reqId, item);
        }

        if (currentStatus === 'NA') {
          // Reset workflow dari nol — Prepare dulu sebelum Complete lagi,
          // mengikuti perilaku Document Action di iDempiere untuk status NA.
          await idempiereApi(`/models/m_requisition/${reqId}`, {
            method: 'PUT',
            body: JSON.stringify({ 'doc-action': 'PR' }),
          });
        }
      } else {
        // ── MODE NORMAL: buat requisition baru ──────────────────────────────
        headerRes = await idempiereApi('/models/m_requisition', {
          method: 'POST',
          body: JSON.stringify({
            AD_Client_ID:   { id: clientId },
            AD_Org_ID:      { id: orgId },
            C_DocType_ID:   { id: docTypeId },
            M_Warehouse_ID: { id: resolvedWarehouseId }, // ← pakai yg dipilih user
            AD_User_ID:     { id: userId },
            DateRequired:   todayISO,
            Description:    resolvedDescription,
            IsActive:       true,
          }),
        });

        reqId = headerRes.id ?? headerRes.M_Requisition_ID;
        if (!reqId) throw new Error('Gagal mendapatkan M_Requisition_ID dari server.');
        // Insert lines untuk dokumen baru
        for (const item of cart) {
          await insertRequisitionLine(reqId, item);
        }
      }

      const completedRes = await idempiereApi(`/models/m_requisition/${reqId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });

      const docNo = completedRes.DocumentNo || `REQ-${reqId}`;
      return {
        documentNo:    docNo,
        date:          new Date().toLocaleString('id-ID'),
        requesterName,
        warehouseName: null, // diisi dari caller kalau perlu di modal sukses
        items:         [...cart],
      };
    } catch (err) {
      onError?.('Gagal membuat Requisition:\n\n' + err.message, 'Error');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [docTypeId, defaultDescription, onError, toBaseQty]);

  return { submit, isSubmitting };
}
