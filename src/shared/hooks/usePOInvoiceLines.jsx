import { useState, useCallback } from 'react';
import { idempiereApi, fkId, fkLabel } from '@/utils/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// usePOInvoiceLines.jsx
// Pengganti useProductSearch.jsx — karena semua pembelian WAJIB lewat PO,
// container ini tidak lagi menampilkan grid produk, tapi grid PO yang SUDAH
// Complete dan MASIH ada sisa qty belum ditagih.
//
// STRATEGI PERHITUNGAN SISA QTY (supaya tidak N+1 request per PO):
//   1. Fetch semua C_Order Complete (IsSOTrx=false, DocStatus='CO') — 1 call.
//   2. Fetch SEMUA C_OrderLine milik PO-PO itu sekaligus — 1 call.
//   3. Fetch SEMUA C_InvoiceLine yg C_OrderLine_ID-nya termasuk di atas,
//      dikecualikan invoice Voided/Reversed — 1 call.
//   4. Agregasi di JS: qtyInvoiced per C_OrderLine_ID, lalu qtyOutstanding
//      per line = QtyOrdered - qtyInvoiced.
//
// ⚠️ Filter nested `C_Invoice_ID.DocStatus notin (...)` BELUM PERNAH DITES
// (Postman lagi down saat ini) — kalau ternyata tidak didukung versi REST
// API Anda, sudah ada fallback try/catch di bawah (ambil semua tanpa filter
// status, sedikit overcount kalau ada invoice voided — cek manual kalau
// sering kejadian). WAJIB dites ulang begitu Postman normal.
//
// PO yang outstanding-nya 0 TETAP di-fetch (browse tidak aneh), tapi
// ditandai `isFullyInvoiced: true` — card-nya di-gray-out, bukan hilang.
// ─────────────────────────────────────────────────────────────────────────────
export function usePOInvoiceLines() {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const fetchPOs = useCallback(async (term = '') => {
    setLoading(true);
    try {
      const t = term.trim();
      const searchFilter = t
        ? ` and (contains(upper(DocumentNo), upper('${t}')) or contains(upper(C_BPartner_ID.Name), upper('${t}')))`
        : '';
      const poRes = await idempiereApi(
        `/models/c_order?$filter=IsSOTrx eq false and DocStatus eq 'CO'${searchFilter}` +
        `&$select=C_Order_ID,DocumentNo,C_BPartner_ID,C_BPartner_Location_ID,DateOrdered,GrandTotal` +
        `&$orderby=DateOrdered desc&$top=100`
      );
      const orders = Array.isArray(poRes.records) ? poRes.records : [];
      if (orders.length === 0) { setPos([]); return; }

      const orderIds = orders.map(o => o.id ?? o.C_Order_ID);
      const orderFilterStr = orderIds.map(id => `C_Order_ID eq ${id}`).join(' or ');

      const linesRes = await idempiereApi(
        `/models/c_orderline?$filter=${orderFilterStr}` +
        `&$select=C_OrderLine_ID,C_Order_ID,M_Product_ID,C_UOM_ID,QtyOrdered,QtyEntered,PriceEntered,PriceActual&$top=1000`
      );
      const lines = Array.isArray(linesRes.records) ? linesRes.records : [];
      if (lines.length === 0) { setPos([]); return; }

      const lineIds = lines.map(l => l.id ?? l.C_OrderLine_ID);
      const lineFilterStr = lineIds.map(id => `C_OrderLine_ID eq ${id}`).join(' or ');

      let invoiceLines = [];
      try {
        const invLinesRes = await idempiereApi(
          `/models/c_invoiceline?$filter=(${lineFilterStr}) and C_Invoice_ID.DocStatus notin ('VO','RE')` +
          `&$select=C_OrderLine_ID,QtyInvoiced&$top=2000`
        );
        invoiceLines = Array.isArray(invLinesRes.records) ? invLinesRes.records : [];
      } catch (err) {
        console.warn('[usePOInvoiceLines] nested filter DocStatus gagal, fallback tanpa filter status:', err.message);
        const invLinesRes = await idempiereApi(
          `/models/c_invoiceline?$filter=${lineFilterStr}&$select=C_OrderLine_ID,QtyInvoiced&$top=2000`
        );
        invoiceLines = Array.isArray(invLinesRes.records) ? invLinesRes.records : [];
      }

      const invoicedByLine = new Map();
      invoiceLines.forEach(il => {
        const olId = fkId(il.C_OrderLine_ID) ?? il.C_OrderLine_ID?.id;
        if (olId == null) return;
        invoicedByLine.set(String(olId), (invoicedByLine.get(String(olId)) || 0) + parseFloat(il.QtyInvoiced || 0));
      });

      const linesByOrder = new Map();
      lines.forEach(l => {
        const oId    = fkId(l.C_Order_ID) ?? l.C_Order_ID?.id;
        const lineId = l.id ?? l.C_OrderLine_ID;
        const qtyOrdered     = parseFloat(l.QtyOrdered ?? l.QtyEntered ?? 0);
        const qtyInvoiced    = invoicedByLine.get(String(lineId)) || 0;
        const qtyOutstanding = Math.max(qtyOrdered - qtyInvoiced, 0);
        if (!linesByOrder.has(oId)) linesByOrder.set(oId, []);
        linesByOrder.get(oId).push({
          C_OrderLine_ID: lineId,
          M_Product_ID: fkId(l.M_Product_ID) ?? l.M_Product_ID?.id,
          ProductName:  fkLabel(l.M_Product_ID) || `Produk #${fkId(l.M_Product_ID)}`,
          C_UOM_ID:     fkId(l.C_UOM_ID) ?? l.C_UOM_ID?.id,
          UomName:      fkLabel(l.C_UOM_ID) || '',
          PriceEntered: parseFloat(l.PriceEntered ?? l.PriceActual ?? 0),
          qtyOrdered, qtyInvoiced, qtyOutstanding,
        });
      });

      const merged = orders.map(o => {
        const oId = o.id ?? o.C_Order_ID;
        const orderLines = linesByOrder.get(oId) || [];
        const totalOutstanding = orderLines.reduce((s, l) => s + l.qtyOutstanding, 0);
        return {
          C_Order_ID: oId,
          DocumentNo: o.DocumentNo,
          C_BPartner_ID: fkId(o.C_BPartner_ID) ?? o.C_BPartner_ID?.id,
          VendorName: fkLabel(o.C_BPartner_ID) || '',
          C_BPartner_Location_ID: fkId(o.C_BPartner_Location_ID) ?? o.C_BPartner_Location_ID?.id,
          DateOrdered: o.DateOrdered,
          GrandTotal: parseFloat(o.GrandTotal ?? 0),
          lines: orderLines,
          isFullyInvoiced: totalOutstanding < 0.01,
        };
      });

      setPos(merged);
    } catch (err) {
      console.error('[usePOInvoiceLines] gagal fetch PO:', err);
      setPos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback((value) => setSearchValue(value), []);

  return { pos, loading, fetchPOs, search, searchValue, setSearchValue };
}
