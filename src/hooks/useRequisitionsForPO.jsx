import { useState, useCallback } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';
import { useProductVendorInfo } from './useProductVendorInfo';

// ─────────────────────────────────────────────────────────────────────────────
// useRequisitionsForPO.jsx (REVISI — selaras dengan RequisitionPOCreate.java)
// Sumber import untuk modul Purchasing: FPB (M_Requisition) berstatus
// Completed. Setelah membaca source resmi iDempiere
// (org.compiere.process.RequisitionPOCreate), 2 penyesuaian dilakukan:
//
// 1. FILTER "sudah di-PO-kan" pakai C_OrderLine_ID IS NULL — field NATIVE
//    (ada sejak iDempiere 13), BINER (bukan akumulasi qty). Proses resmi
//    iDempiere sendiri cuma cek `getC_OrderLine_ID() == 0` untuk skip baris
//    yang sudah diproses — tidak ada tracking qty parsial sama sekali, jadi
//    kita ikuti pola yang sama persis (lebih simpel dari desain awal kita).
//
// 2. PRIORITAS VENDOR per baris — persis urutan di method newLine() proses
//    resmi:
//      a. M_RequisitionLine.C_BPartner_ID kalau baris FPB itu SENDIRI sudah
//         py vendor spesifik (field native, prioritas TERTINGGI)
//      b. M_Product_PO yang ditandai IsCurrentVendor
//      c. M_Product_PO pertama yang ditemukan (fallback)
//      d. Tidak ada apa pun → user wajib pilih manual
// ─────────────────────────────────────────────────────────────────────────────
const APPROVED_STATUSES = ['CO'];

export function useRequisitionsForPO() {
  const [requisitions, setRequisitions] = useState([]);
  const [loadingList, setLoadingList]   = useState(false);

  const [selectedLines, setSelectedLines] = useState([]);
  const [loadingLines, setLoadingLines]   = useState(false);

  const { fetchVendorOptionsBatch, fetchListPrice } = useProductVendorInfo();

  const fetchApprovedRequisitions = useCallback(async ({ search = '' } = {}) => {
    setLoadingList(true);
    try {
      const statusFilter = APPROVED_STATUSES.map(s => `DocStatus eq '${s}'`).join(' or ');
      // TIDAK difilter per warehouse — Purchasing bersifat sentral (staf
      // pengadaan bisa memproses FPB dari gudang manapun).
      let filter = `(${statusFilter})`;
      if (search) {
        const safeQ = search.replace(/'/g, "''");
        filter += ` and contains(toupper(DocumentNo),'${safeQ.toUpperCase()}')`;
      }

      const res = await idempiereApi(
        `/models/m_requisition?$select=M_Requisition_ID,DocumentNo,DateDoc,M_Warehouse_ID,DocStatus,TotalLines,Description` +
        `&$filter=${filter}&$orderby=DateDoc desc&$top=50`
      );
      const records = Array.isArray(res.records) ? res.records : [];
      
      let list = records.map(r => ({
        M_Requisition_ID: fkId(r.M_Requisition_ID) ?? r.id,
        DocumentNo:       r.DocumentNo,
        DateDoc:          r.DateDoc,
        WarehouseName:    fkLabel(r.M_Warehouse_ID),
        DocStatus:        r.DocStatus?.id ?? r.DocStatus,
        TotalLines:       r.TotalLines ?? 0,
        Description:      r.Description || '',
      }));

      // ── Sembunyikan FPB yang SEMUA line-nya sudah C_OrderLine_ID terisi ──
      // Query per-FPB secara paralel (bukan 1 filter besar) — pola yang
      // sama dipakai di modul Goods Receipt untuk menghindari filter OData
      // yang terlalu panjang. Kalau query gagal untuk 1 FPB tertentu (mis.
      // versi iDempiere lama yang belum punya kolom ini), FPB itu tetap
      // ditampilkan (fail-safe), bukan malah hilang dari daftar.
      if (list.length > 0) {
        const results = await Promise.all(list.map(async (req) => {
          try {
            const lineRes = await idempiereApi(
              `/models/m_requisitionline?$filter=M_Requisition_ID eq ${req.M_Requisition_ID}` +
              `&$select=M_RequisitionLine_ID,C_OrderLine_ID`
            );
            const lineRecords = Array.isArray(lineRes.records) ? lineRes.records : [];
            const openCount = lineRecords.filter(l => !fkId(l.C_OrderLine_ID)).length;
            return { ...req, OpenLineCount: openCount, _queryOk: true };
          } catch (err) {
            console.error(`[useRequisitionsForPO] gagal cek C_OrderLine_ID FPB ${req.DocumentNo}:`, err);
            return { ...req, OpenLineCount: null, _queryOk: false };
          }
        }));
        list = results.filter(r => !r._queryOk || r.OpenLineCount > 0);
      }

      setRequisitions(list);
      return list;
    } catch (err) {
      console.error('[useRequisitionsForPO] fetchApprovedRequisitions error:', err);
      setRequisitions([]);
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchRequisitionLines = useCallback(async (requisitionId) => {
    if (!requisitionId) return [];
    setLoadingLines(true);
    try {
      const res = await idempiereApi(
        `/models/m_requisitionline?$filter=M_Requisition_ID eq ${requisitionId}` +
        `&$select=M_RequisitionLine_ID,Line,M_Product_ID,C_UOM_ID,Qty,C_BPartner_ID,C_OrderLine_ID,Description&$orderby=Line`
      );
      const records = Array.isArray(res.records) ? res.records : [];

      const allLines = records.map(l => ({
        M_RequisitionLine_ID: fkId(l.M_RequisitionLine_ID) ?? l.id,
        M_Product_ID:  fkId(l.M_Product_ID),
        ProductName:   fkLabel(l.M_Product_ID) || `Produk #${fkId(l.M_Product_ID)}`,
        C_UOM_ID:      fkId(l.C_UOM_ID),
        UomName:       fkLabel(l.C_UOM_ID) || 'EA',
        Qty:           parseFloat(l.Qty || 0),
        // Vendor yang SUDAH ditentukan di level FPB line itu sendiri
        // (kalau ada) — prioritas tertinggi, persis urutan resolusi vendor
        // di RequisitionPOCreate.java.
        LineBPartnerId:   fkId(l.C_BPartner_ID),
        LineBPartnerName: fkLabel(l.C_BPartner_ID),
        isOrdered:        !!fkId(l.C_OrderLine_ID), // sudah pernah di-PO-kan?
      }));

      // Baris yang sudah punya C_OrderLine_ID (sudah di-PO-kan) disembunyikan
      // dari daftar import — cegah baris yang sama di-PO-kan dua kali.
      const openLines = allLines.filter(l => !l.isOrdered);

      // Untuk baris yang FPB line-nya SENDIRI belum punya vendor spesifik,
      // baru cari suggestion dari M_Product_PO.
      const needVendorLookup = openLines.filter(l => !l.LineBPartnerId);
      const vendorMap = await fetchVendorOptionsBatch(needVendorLookup.map(l => l.M_Product_ID));

      const enriched = await Promise.all(openLines.map(async (line) => {
        // Prioritas 1: vendor yang sudah di-set di M_RequisitionLine itu sendiri.
        // Vendor sudah pasti, tapi M_Product_PO tidak selalu punya entry untuk
        // kombinasi ini — harga tetap diambil dari M_PriceList (via
        // PO_PriceList_ID vendor, fallback ke Purchase Price List default),
        // BUKAN di-hardcode 0.
        if (line.LineBPartnerId) {
          const price = await fetchListPrice(line.M_Product_ID, line.LineBPartnerId);
          return {
            ...line,
            vendorOptions: [{ C_BPartner_ID: line.LineBPartnerId, VendorName: line.LineBPartnerName, Price: price, isCurrent: true }],
            C_BPartner_ID: line.LineBPartnerId,
            VendorName:    line.LineBPartnerName,
            Price:         price,
          };
        }
        // Prioritas 2 & 3: suggestion dari M_Product_PO (IsCurrentVendor dulu, lalu fallback pertama)
        // — harga tiap opsi vendor sudah dilengkapi lewat M_PriceList di useProductVendorInfo.
        const vendorOptions = vendorMap[line.M_Product_ID] || [];
        const def = vendorOptions.find(v => v.isCurrent) || vendorOptions[0] || null;
        return {
          ...line,
          vendorOptions,
          C_BPartner_ID: def?.C_BPartner_ID ?? null,
          VendorName:    def?.VendorName ?? '',
          Price:         def?.Price ?? 0,
        };
      }));

      setSelectedLines(enriched);
      return enriched;
    } catch (err) {
      console.error('[useRequisitionsForPO] fetchRequisitionLines error:', err);
      setSelectedLines([]);
      return [];
    } finally {
      setLoadingLines(false);
    }
  }, [fetchVendorOptionsBatch, fetchListPrice]);

  return {
    requisitions, loadingList, fetchApprovedRequisitions,
    selectedLines, loadingLines, fetchRequisitionLines,
  };
}
