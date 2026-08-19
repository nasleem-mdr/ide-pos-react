import { useState, useCallback } from 'react';
import { idempiereApi, fkId, fkLabel } from '@/api/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useShipmentInvoiceLines.js
// IsInvoiced ada di M_InOutLine (per baris), BUKAN di header M_InOut —
// jadi filter presisinya di level baris: DocStatus/IsSOTrx/search tetap
// disaring dari header (M_InOut tidak punya kolom itu ganda), tapi
// IsInvoiced eq false disaring saat fetch M_InOutLine, digabung dengan
// filter M_InOut_ID dari shipment header yang sudah lolos.
//
// HARGA: dari C_OrderLine yang ter-link via M_InOutLine.C_OrderLine_ID.
// Baris tanpa C_OrderLine_ID (shipment manual tanpa SO) → price 0,
// ditandai `priceMissing: true`.
// ─────────────────────────────────────────────────────────────────────────────
export function useShipmentInvoiceLines() {
  const [shipments, setShipments] = useState([]); // flat: 1 row = 1 M_InOutLine
  const [loading, setLoading] = useState(false);

  const fetchLines = useCallback(async ({ term = '', customerId = null } = {}) => {
    setLoading(true);
    try {
      // ── 1. Shipment header yang lolos DocStatus/IsSOTrx/search/customer ──
      let headerFilter = `IsSOTrx eq true and DocStatus eq 'CO'`;
      if (customerId) headerFilter += ` and C_BPartner_ID eq ${customerId}`;
      if (term.trim()) {
        headerFilter += ` and (contains(upper(DocumentNo), upper('${term.trim()}')) or contains(upper(C_BPartner_ID.Name), upper('${term.trim()}')))`;
      }

      const shipRes = await idempiereApi(
        `/models/m_inout?$filter=${headerFilter}` +
        `&$select=M_InOut_ID,DocumentNo,MovementDate,C_BPartner_ID` +
        `&$orderby=MovementDate desc&$top=100`
      );
      const shipHeaders = Array.isArray(shipRes.records) ? shipRes.records : [];
      if (shipHeaders.length === 0) { setShipments([]); return; }

      const shipIds = shipHeaders.map(s => s.id ?? s.M_InOut_ID);
      const shipFilterStr = shipIds.map(id => `M_InOut_ID eq ${id}`).join(' or ');

      // ── 2. Baris shipment, filter IsInvoiced=false di SINI (level baris) ─
      const lineRes = await idempiereApi(
        `/models/m_inoutline?$filter=(${shipFilterStr}) and IsInvoiced eq false` +
        `&$select=M_InOutLine_ID,M_InOut_ID,M_Product_ID,QtyEntered,MovementQty,C_UOM_ID,C_OrderLine_ID` +
        `&$top=1000`
      );
      const lines = Array.isArray(lineRes.records) ? lineRes.records : [];
      if (lines.length === 0) { setShipments([]); return; }

      // ── Harga dari C_OrderLine yang ter-link ─────────────────────────
      const orderLineIds = lines.map(l => fkId(l.C_OrderLine_ID) ?? l.C_OrderLine_ID?.id).filter(Boolean);
      let priceByOrderLine = new Map();
      if (orderLineIds.length > 0) {
        const olFilterStr = orderLineIds.map(id => `C_OrderLine_ID eq ${id}`).join(' or ');
        const olRes = await idempiereApi(
          `/models/c_orderline?$filter=${olFilterStr}&$select=C_OrderLine_ID,PriceEntered,PriceActual&$top=1000`
        );
        (Array.isArray(olRes.records) ? olRes.records : []).forEach(ol => {
          const olId = ol.id ?? ol.C_OrderLine_ID;
          priceByOrderLine.set(String(olId), parseFloat(ol.PriceEntered ?? ol.PriceActual ?? 0));
        });
      }

      const shipHeaderById = new Map();
      shipHeaders.forEach(s => shipHeaderById.set(String(s.id ?? s.M_InOut_ID), s));

      const mapped = lines.map(l => {
        const inOutLineId = l.id ?? l.M_InOutLine_ID;
        const shipId = fkId(l.M_InOut_ID) ?? l.M_InOut_ID?.id;
        const header = shipHeaderById.get(String(shipId));
        const orderLineId = fkId(l.C_OrderLine_ID) ?? l.C_OrderLine_ID?.id ?? null;
        const movementQty = parseFloat(l.MovementQty ?? l.QtyEntered ?? 0);
        const price = orderLineId ? (priceByOrderLine.get(String(orderLineId)) ?? 0) : 0;

        return {
          M_InOutLine_ID: inOutLineId,
          M_InOut_ID: shipId,
          ShipmentDocumentNo: header?.DocumentNo || `#${shipId}`,
          MovementDate: header?.MovementDate,
          C_BPartner_ID: fkId(header?.C_BPartner_ID) ?? header?.C_BPartner_ID?.id ?? null,
          CustomerName: fkLabel(header?.C_BPartner_ID) || '',
          M_Product_ID: fkId(l.M_Product_ID) ?? l.M_Product_ID?.id,
          ProductName: fkLabel(l.M_Product_ID) || `Produk #${fkId(l.M_Product_ID)}`,
          C_UOM_ID: fkId(l.C_UOM_ID) ?? l.C_UOM_ID?.id,
          UomName: fkLabel(l.C_UOM_ID) || '',
          C_OrderLine_ID: orderLineId,
          Price: price,
          priceMissing: !orderLineId,
          qtyOutstanding: movementQty, // sudah pasti belum ditagih sama sekali (IsInvoiced=false di baris ini)
        };
      });

      setShipments(mapped);
    } catch (err) {
      console.error('[useShipmentInvoiceLines] gagal fetch:', err);
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { shipments, loading, fetchLines };
}
