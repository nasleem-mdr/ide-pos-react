import { useState, useCallback } from 'react';
import { idempiereApi } from '../../utils/idempiereApi';
import { getLoginInfo } from '../../hooks/useLoginInfo';

// ─────────────────────────────────────────────────────────────────────────────
// useRequisitionSubmit.js
// Spesifik requisition: encapsulate alur create M_Requisition header → insert
// M_RequisitionLine per item cart → Complete (doc-action CO). Dipisah dari
// RequisitionContainer supaya container fokus ke render, dan logic submit
// bisa di-unit-test terpisah tanpa perlu mounting komponen UI.
//
// Penggunaan:
//   const { submit, isSubmitting } = useRequisitionSubmit({ docTypeId: 320, description: '...' });
//   const result = await submit(cart, requesterName); // null kalau gagal (alert via onError)
// ─────────────────────────────────────────────────────────────────────────────
export function useRequisitionSubmit({ docTypeId, description, onError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (cart, requesterName) => {
    if (cart.length === 0) {
      onError?.('Daftar permintaan masih kosong!');
      return null;
    }

    const { userId, warehouseId, orgId, clientId } = getLoginInfo();
    if (!userId || !warehouseId || !orgId || !clientId) {
      onError?.('Data sesi tidak lengkap.\nSilakan login kembali.', 'Error');
      return null;
    }

    setIsSubmitting(true);
    try {
      const todayISO = new Date().toISOString().split('T')[0];

      const headerRes = await idempiereApi('/models/m_requisition', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID:   { id: clientId },
          AD_Org_ID:      { id: orgId },
          C_DocType_ID:   { id: docTypeId },
          M_Warehouse_ID: { id: warehouseId },
          AD_User_ID:     { id: userId },
          DateRequired:   todayISO,
          Description:    description,
          IsActive:       true,
        }),
      });

      const reqId = headerRes.id ?? headerRes.M_Requisition_ID;
      if (!reqId) throw new Error('Gagal mendapatkan M_Requisition_ID dari server.');

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

      const completedRes = await idempiereApi(`/models/m_requisition/${reqId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });

      const docNo = completedRes.DocumentNo || `REQ-${reqId}`;
      return {
        documentNo:    docNo,
        date:          new Date().toLocaleString('id-ID'),
        requesterName,
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
