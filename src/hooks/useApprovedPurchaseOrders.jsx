import { useState, useCallback } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useApprovedPurchaseOrders.jsx
// REVISI dari useApprovedRequisitions.jsx — sumber import untuk Goods Receipt
// seharusnya PURCHASE ORDER (C_Order/C_OrderLine), bukan Requisition.
//
// Alasan: proses bisnis di sini punya tahap "Requisition → PO" (Requisition
// dikonversi jadi PO sebelum barang datang). PO adalah komitmen resmi ke
// vendor (harga, qty, C_BPartner_ID final) — sedangkan Requisition cuma
// permintaan internal. Menerima barang harus mengacu ke PO supaya:
//   1. 3-way matching (PO vs Receipt vs Invoice) tetap valid di iDempiere
//      lewat M_InOutLine.C_OrderLine_ID
//   2. QtyOrdered vs QtyDelivered di C_OrderLine ter-update otomatis oleh
//      iDempiere saat M_InOut di-Complete
//   3. Vendor & lokasi pengiriman ikut header PO — tidak perlu input manual
// ─────────────────────────────────────────────────────────────────────────────
const APPROVED_STATUSES = ['CO', 'CL'];

export function useApprovedPurchaseOrders() {
  const [orders, setOrders]           = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [selectedLines, setSelectedLines] = useState([]);
  const [loadingLines, setLoadingLines]   = useState(false);

  // Daftar PO pembelian (IsSOTrx=false) yang sudah Completed/Approved.
  // Opsional filter warehouse tujuan & pencarian DocumentNo.
  const fetchApprovedOrders = useCallback(async ({ warehouseId = null, search = '' } = {}) => {
    setLoadingList(true);
    try {
      const statusFilter = APPROVED_STATUSES.map(s => `DocStatus eq '${s}'`).join(' or ');
      let filter = `IsSOTrx eq false and (${statusFilter})`;

      if (warehouseId) {
        filter += ` and M_Warehouse_ID eq ${warehouseId}`;
      }
      if (search) {
        const safeQ = search.replace(/'/g, "''");
        filter += ` and contains(toupper(DocumentNo),'${safeQ.toUpperCase()}')`;
      }

      const res = await idempiereApi(
        `/models/c_order?$select=C_Order_ID,DocumentNo,DateOrdered,M_Warehouse_ID,DocStatus,C_BPartner_ID,C_BPartner_Location_ID,GrandTotal` +
        `&$filter=${filter}&$orderby=DateOrdered desc&$top=50`
      );
      const records = Array.isArray(res.records) ? res.records : [];

      const list = records.map(o => ({
        C_Order_ID:             fkId(o.C_Order_ID) ?? o.id,
        DocumentNo:             o.DocumentNo,
        DateOrdered:            o.DateOrdered,
        WarehouseName:          fkLabel(o.M_Warehouse_ID),
        DocStatus:              o.DocStatus?.id ?? o.DocStatus,
        C_BPartner_ID:          fkId(o.C_BPartner_ID),
        VendorName:             fkLabel(o.C_BPartner_ID),
        C_BPartner_Location_ID: fkId(o.C_BPartner_Location_ID),
        GrandTotal:             o.GrandTotal ?? 0,
      }));

      setOrders(list);
      return list;
    } catch (err) {
      console.error('[useApprovedPurchaseOrders] fetchApprovedOrders error:', err);
      setOrders([]);
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Ambil lines PO terpilih, hitung sisa qty yang belum diterima
  // (QtyOrdered - QtyDelivered). Line yang sudah diterima penuh (sisa <= 0)
  // di-exclude dari hasil supaya tidak bisa di-import ulang / over-receipt.
  const fetchOrderLines = useCallback(async (orderId) => {
    if (!orderId) return [];
    setLoadingLines(true);
    try {
      const res = await idempiereApi(
        `/models/c_orderline?$filter=C_Order_ID eq ${orderId}` +
        `&$select=C_OrderLine_ID,Line,M_Product_ID,C_UOM_ID,QtyOrdered,QtyDelivered,Description` +
        `&$orderby=Line`
      );
      const records = Array.isArray(res.records) ? res.records : [];

      const allLines = records.map(l => {
        const qtyOrdered  = parseFloat(l.QtyOrdered || 0);
        const qtyDelivered = parseFloat(l.QtyDelivered || 0);
        return {
          C_OrderLine_ID: fkId(l.C_OrderLine_ID) ?? l.id,
          M_Product_ID:   fkId(l.M_Product_ID),
          ProductName:    fkLabel(l.M_Product_ID) || `Produk #${fkId(l.M_Product_ID)}`,
          C_UOM_ID:       fkId(l.C_UOM_ID),
          UomName:        fkLabel(l.C_UOM_ID) || 'EA',
          QtyOrdered:     qtyOrdered,
          QtyDelivered:   qtyDelivered,
          QtyRemaining:   Math.max(qtyOrdered - qtyDelivered, 0),
          Description:    l.Description || '',
        };
      });

      // Line yang sudah fully-received (sisa 0) tidak ditampilkan untuk
      // diimport — tapi tetap dihitung untuk info "X line sudah lengkap".
      const receivableLines = allLines.filter(l => l.QtyRemaining > 0);

      setSelectedLines(receivableLines);
      return { allLines, receivableLines };
    } catch (err) {
      console.error('[useApprovedPurchaseOrders] fetchOrderLines error:', err);
      setSelectedLines([]);
      return { allLines: [], receivableLines: [] };
    } finally {
      setLoadingLines(false);
    }
  }, []);

  // Data untuk recharts: stacked bar "Sudah Diterima" vs "Sisa Belum Diterima"
  // — memberi konteks progres penerimaan, bukan cuma qty flat seperti sebelumnya.
  const buildChartData = useCallback((lines) => {
    return (lines || []).map(l => ({
      name: l.ProductName.length > 14 ? l.ProductName.slice(0, 14) + '…' : l.ProductName,
      fullName: l.ProductName,
      delivered: l.QtyDelivered,
      remaining: l.QtyRemaining,
      uom: l.UomName,
    }));
  }, []);

  // Ubah lines PO menjadi bentuk item cart — default Qty = sisa yang belum
  // diterima (bukan qty order penuh), supaya tidak over-receipt secara default.
  // User tetap bisa koreksi turun di cart kalau barang datang partial.
  const linesToCartItems = useCallback((lines, orderId) => {
    return (lines || []).map(l => ({
      M_Product_ID: l.M_Product_ID,
      Name:         l.ProductName,
      Value:        '',
      C_UOM_ID:     l.C_UOM_ID,
      C_UOM_Name:   l.UomName,
      Qty:          l.QtyRemaining,
      selectedUom:  { C_UOM_ID: l.C_UOM_ID, Name: l.UomName, multiplyRate: 1 },
      uomOptions:   [{ C_UOM_ID: l.C_UOM_ID, Name: l.UomName, multiplyRate: 1 }],
      sourceOrderLineId: l.C_OrderLine_ID, // → dipakai isi M_InOutLine.C_OrderLine_ID
      sourceOrderId: orderId,              // → dipakai isi header M_InOut.C_Order_ID (kalau seragam)
    }));
  }, []);

  return {
    orders, loadingList, fetchApprovedOrders,
    selectedLines, loadingLines, fetchOrderLines,
    buildChartData, linesToCartItems,
  };
}
