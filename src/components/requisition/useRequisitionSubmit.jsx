import { useState, useCallback } from 'react';
import { idempiereApi } from '../../utils/idempiereApi';
import { getLoginInfo } from '../../hooks/useLoginInfo';

export function useRequisitionSubmit({ docTypeId, description, onError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // warehouseId sekarang diterima dari caller (RequisitionContainer),
  // bukan lagi hardcode dari session — supaya ikut warehouse yang dipilih user.
  //
  // editRequisitionId (opsional): jika diisi, fungsi ini akan UPDATE header +
  // hapus & insert ulang lines milik requisition tersebut, alih-alih membuat
  // dokumen baru. Mengikuti pola "Mode Edit" pada POSContainer.handleCheckout.
  const submit = useCallback(async (cart, requesterName, warehouseId, editRequisitionId = null) => {
    if (cart.length === 0) {
      onError?.('Daftar permintaan masih kosong!');
      return null;
    }

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
          const uomId = item.selectedUom?.C_UOM_ID || item.C_UOM_ID;
          await idempiereApi('/models/m_requisitionline', {
            method: 'POST',
            body: JSON.stringify({
              AD_Org_ID:        { id: orgId },
              M_Requisition_ID: { id: reqId },
              M_Product_ID:     { id: parseInt(item.M_Product_ID) },
              C_UOM_ID:         { id: parseInt(uomId) },
              Qty:              parseFloat(item.Qty),
              ...(item.VendorId ? { C_BPartner_ID: { id: parseInt(item.VendorId) } } : {}),
            }),
          });
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
            Description:    description,
            IsActive:       true,
          }),
        });

        reqId = headerRes.id ?? headerRes.M_Requisition_ID;
        if (!reqId) throw new Error('Gagal mendapatkan M_Requisition_ID dari server.');

        // Insert lines untuk dokumen baru
        for (const item of cart) {
          const uomId = item.selectedUom?.C_UOM_ID || item.C_UOM_ID;
          await idempiereApi('/models/m_requisitionline', {
            method: 'POST',
            body: JSON.stringify({
              AD_Org_ID:        { id: orgId },
              M_Requisition_ID: { id: reqId },
              M_Product_ID:     { id: parseInt(item.M_Product_ID) },
              C_UOM_ID:         { id: parseInt(uomId) },
              Qty:              parseFloat(item.Qty),
              ...(item.VendorId ? { C_BPartner_ID: { id: parseInt(item.VendorId) } } : {}),
            }),
          });
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
  }, [docTypeId, description, onError]);

  return { submit, isSubmitting };
}