import { useState, useCallback } from 'react';
import { idempiereApi, fkId, fkLabel } from '@/api/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useShipmentInvoiceLines.js
// Fetch baris M_InOutLine dari Shipment (M_InOut) Complete sisi Sales
// (IsSOTrx=true) yang BELUM ditagih penuh — padanan usePOInvoiceLines.js
// (sisi Purchasing, PO→Invoice), tapi ini Shipment→Invoice.
//
// HARGA: TIDAK diambil dari M_InOutLine (kolom itu tidak punya harga sama
// sekali secara native) — melainkan dari C_OrderLine yang ter-link via
// M_InOutLine.C_OrderLine_ID, sesuai spesifikasi Anda. Kalau ada baris
// shipment TANPA C_OrderLine_ID (shipment dibuat manual tanpa SO), price
// jatuh ke 0 — ditandai `priceMissing: true` supaya UI bisa kasih warning
// dan user isi manual (tidak silently 0 tanpa keterangan).
//
// OUTSTANDING QTY: MovementQty (qty terkirim) dikurangi SUM(QtyInvoiced)
// dari C_InvoiceLine yang M_InOutLine_ID-nya sama (exclude invoice
// Voided/Reversed — best-effort, fallback tanpa filter status kalau nested
// filter tidak didukung, sama pola seperti usePOInvoiceLines.js).
// ─────────────────────────────────────────────────────────────────────────────
export function useShipmentInvoiceLines() {
  const [shipments, setShipments] = useState([]); // flat: 1 row = 1 M_InOutLine
  const [loading, setLoading] = useState(false);

  const fetchLines = useCallback(async ({ term = '', customerId = null } = {}) => {
    setLoading(true);
    try {
      let filter = `IsSOTrx eq true and DocStatus eq 'CO'`;
      if (customerId) filter += ` and C_BPartner_ID eq ${customerId}`;
      if (term.trim()) {
        filter += ` and (contains(upper(DocumentNo), upper('${term.trim()}')) or contains(upper(C_BPartner_ID.Name), upper('${term.trim()}')))`;
      }

      const shipRes = await idempiereApi(
        `/models/m_inout?$filter=${filter}` +
        `&$select=M_InOut_ID,DocumentNo,MovementDate,C_BPartner_ID` +
        `&$orderby=MovementDate desc&$top=100`
      );
      const shipHeaders = Array.isArray(shipRes.records) ? shipRes.records : [];
      if (shipHeaders.length === 0) { setShipments([]); return; }

      const shipIds = shipHeaders.map(s => s.id ?? s.M_InOut_ID);
      const shipFilterStr = shipIds.map(id => `M_InOut_ID eq ${id}`).join(' or ');

      const lineRes = await idempiereApi(
        `/models/m_inoutline?$filter=${shipFilterStr}` +
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
        const olRecords = Array.isArray(olRes.records) ? olRes.records : [];
        olRecords.forEach(ol => {
          const olId = ol.id ?? ol.C_OrderLine_ID;
          priceByOrderLine.set(String(olId), parseFloat(ol.PriceEntered ?? ol.PriceActual ?? 0));
        });
      }

      // ── Qty sudah ditagih per M_InOutLine ────────────────────────────
      const inOutLineIds = lines.map(l => l.id ?? l.M_InOutLine_ID);
      const invFilterStr = inOutLineIds.map(id => `M_InOutLine_ID eq ${id}`).join(' or ');
      let invoicedByInOutLine = new Map();
      try {
        const invRes = await idempiereApi(
          `/models/c_invoiceline?$filter=(${invFilterStr}) and C_Invoice_ID.DocStatus notin ('VO','RE')` +
          `&$select=M_InOutLine_ID,QtyInvoiced&$top=2000`
        );
        (Array.isArray(invRes.records) ? invRes.records : []).forEach(il => {
          const ioId = fkId(il.M_InOutLine_ID) ?? il.M_InOutLine_ID?.id;
          if (ioId == null) return;
          invoicedByInOutLine.set(String(ioId), (invoicedByInOutLine.get(String(ioId)) || 0) + parseFloat(il.QtyInvoiced || 0));
        });
      } catch (err) {
        console.warn('[useShipmentInvoiceLines] nested filter DocStatus gagal, fallback tanpa filter status:', err.message);
        const invRes = await idempiereApi(
          `/models/c_invoiceline?$filter=${invFilterStr}&$select=M_InOutLine_ID,QtyInvoiced&$top=2000`
        );
        (Array.isArray(invRes.records) ? invRes.records : []).forEach(il => {
          const ioId = fkId(il.M_InOutLine_ID) ?? il.M_InOutLine_ID?.id;
          if (ioId == null) return;
          invoicedByInOutLine.set(String(ioId), (invoicedByInOutLine.get(String(ioId)) || 0) + parseFloat(il.QtyInvoiced || 0));
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
        const invoicedQty = invoicedByInOutLine.get(String(inOutLineId)) || 0;
        const qtyOutstanding = Math.max(movementQty - invoicedQty, 0);
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
          priceMissing: !orderLineId, // tidak ada C_OrderLine sumber → harga tidak bisa ditentukan otomatis
          qtyOutstanding,
        };
      }).filter(l => l.qtyOutstanding > 0);

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
