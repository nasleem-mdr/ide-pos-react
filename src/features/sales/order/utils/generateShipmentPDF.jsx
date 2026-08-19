import { idempiereApi } from '@/api/idempiereApi';
import { renderDocumentPDF } from '@/utils/pdf/renderDocumentPDF';
import { cleanIdentifier } from '@/utils/pdf/formatIdentifier';

// ─────────────────────────────────────────────────────────────────────────────
// generateShipmentPDF.js
// Wrapper tipis: fetch data Customer Shipment (M_InOut + M_InOutLine + histori
// workflow), delegasikan rendering ke renderDocumentPDF — pola sama persis
// dengan generateInvoicePDF.js. Dipakai setelah Sales Order Complete →
// Shipment otomatis dibuat (lihat useSalesShipmentSubmit.js).
// ─────────────────────────────────────────────────────────────────────────────

// Verifikasi dulu di instance kamu:
// GET /models/ad_table?$select=AD_Table_ID&$filter=TableName eq 'M_InOut'
const M_INOUT_AD_TABLE_ID = 319; // standar dictionary iDempiere — CEK ULANG sebelum pakai

const STATUS_MAP = {
  DR: "Draft",
  IP: "Dalam Proses Approval",
  CO: "Selesai / Disetujui",
  CL: "Ditutup",
  VO: "Dibatalkan",
  RE: "Ditolak",
};

const VERIFY_BASE_URL = "https://192.168.0.126:8432/view/shipment"; // sesuaikan / buat route publik kalau belum ada

const numberFormatter = new Intl.NumberFormat('en-US');

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d) ? "-" : d.toLocaleDateString("id-ID");
};

/**
 * @param {number} shipmentId    - M_InOut_ID
 * @param {string} documentNo
 * @param {string} [logoDataUrl] - mis. dari useOrgInfo().orgInfo?.logoUrl
 */
export async function generateShipmentPDF(shipmentId, documentNo, logoDataUrl) {
  const header = await idempiereApi(
    `/models/m_inout/${shipmentId}` +
    `?$select=DocumentNo,MovementDate,Description,DocStatus,AD_Org_ID,CreatedBy,C_BPartner_ID,M_Warehouse_ID,C_Order_ID`
  );

  const linesRes = await idempiereApi(
    `/models/m_inoutline` +
    `?$filter=M_InOut_ID eq ${shipmentId}` +
    `&$select=Line,M_Product_ID,QtyEntered,MovementQty,C_UOM_ID,Description` +
    `&$orderby=Line`
  );
  const lines = linesRes.records || [];

  const historyRes = await idempiereApi(
    `/models/ad_wf_eventaudit` +
    `?$filter=AD_Table_ID eq ${M_INOUT_AD_TABLE_ID} and Record_ID eq ${shipmentId}` +
    `&$select=AD_WF_Node_ID,AD_User_ID,Updated` +
    `&$orderby=Updated asc`
  );
  const history = (historyRes.records || [])
    .filter(h => !["(start)", "(docauto)", "(completedocument)"].includes((h.AD_WF_Node_ID?.identifier || "").toLowerCase()))
    .map(h => ({
      nodeName: h.AD_WF_Node_ID?.identifier || "-",
      userName: h.AD_User_ID?.identifier || "-",
      date: h.Updated ? new Date(h.Updated).toLocaleDateString("id-ID") : "-",
    }));

  const statusCode = header.DocStatus?.id ?? header.DocStatus;

  await renderDocumentPDF({
    title: "SURAT JALAN / SHIPMENT",
    subtitle: "Dokumen ini sah dengan histori approval terlampir",
    logoDataUrl,
    infoLeft: [
      ["No. ",        ": " + header.DocumentNo],
      ["Customer",    ": " + (header.C_BPartner_ID?.identifier || "-")],
      ["Ref. Order",  ": " + (header.C_Order_ID?.identifier || "-")],
      ["Description", ": " + (header.Description || "-")],
    ],
    infoRight: [
      ["Date",   ": " + formatDate(header.MovementDate)],
      ["Status", ": " + (STATUS_MAP[statusCode] || statusCode)],
      ["Gudang", ": " + (header.M_Warehouse_ID?.identifier || "-")],
    ],
    table: {
      head: [["No", "Produk", "Qty Order", "UOM", "Qty Dikirim", "Keterangan"]],
      body: lines.map((l, idx) => [
        l.Line ?? idx + 1,
        cleanIdentifier(l.M_Product_ID?.identifier) || "-",
        numberFormatter.format(l.QtyEntered ?? 0),
        l.C_UOM_ID?.identifier || "-",
        numberFormatter.format(l.MovementQty ?? 0),
        l.Description || "-",
      ]),
      columnStyles: {
        0: { cellWidth: 30,  halign: 'center' },
        1: { cellWidth: 200 },
        2: { cellWidth: 65,  halign: 'right' },
        3: { cellWidth: 50 },
        4: { cellWidth: 70,  halign: 'right' },
        5: { cellWidth: 130 },
      },
    },
    history,
    verifyUrl: `${VERIFY_BASE_URL}/${header.uid}`,
    verifyCaption: "Scan untuk verifikasi keaslian & status dokumen {documentNo}",
    filenamePrefix: "DO", // Delivery Order — sesuaikan kalau ada konvensi lain
    documentNo: header.DocumentNo,
  });
}
