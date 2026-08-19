import { idempiereApi } from '@/api/idempiereApi';
import { renderDocumentPDF } from '@/utils/pdf/renderDocumentPDF';
import { cleanIdentifier } from '@/utils/pdf/formatIdentifier';

// ─────────────────────────────────────────────────────────────────────────────
// generateInvoicePDF.js
// Wrapper tipis: fetch data spesifik Sales Invoice (header + lines + histori
// workflow), lalu delegasikan seluruh rendering PDF ke renderDocumentPDF —
// pola sama seperti generateRequisitionPDF.js. TIDAK membangun jsPDF manual.
//
// idempiereApi (bukan fetch+token manual) sudah otomatis baca token dari
// localStorage, jadi tidak perlu parameter token terpisah di sini.
// ─────────────────────────────────────────────────────────────────────────────

const C_INVOICE_AD_TABLE_ID = 318; // GET /models/ad_table?$select=AD_Table_ID&$filter=TableName eq 'C_Invoice'

const STATUS_MAP = {
  DR: "Draft",
  IP: "Dalam Proses Approval",
  CO: "Selesai / Disetujui",
  CL: "Ditutup",
  VO: "Dibatalkan",
  RE: "Ditolak",
};

const VERIFY_BASE_URL = "https://192.168.0.126:8432/view/invoice";

const numberFormatter = new Intl.NumberFormat('en-US');
const fmtRp = (n) => ` ${Math.round(n || 0).toLocaleString("id-ID")}`;

const formatDateService = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return "-";
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * @param {number} invoiceId
 * @param {string} documentNo
 * @param {string} [logoDataUrl]  - mis. dari useOrgInfo().orgInfo?.logoUrl
 */
export async function generateInvoicePDF(invoiceId, documentNo, logoDataUrl) {
  const header = await idempiereApi(
    `/models/c_invoice/${invoiceId}` +
    `?$select=DocumentNo,DateInvoiced,POReference,Description,DocStatus,AD_Org_ID,CreatedBy,C_BPartner_ID,GrandTotal`
  );

  const linesRes = await idempiereApi(
    `/models/c_invoiceline` +
    `?$filter=C_Invoice_ID eq ${invoiceId}` +
    `&$select=Line,M_Product_ID,QtyEntered,C_UOM_ID,PriceActual,LineNetAmt,Description,DateService` +
    `&$orderby=Line`
  );
  const lines = linesRes.records || [];

  const historyRes = await idempiereApi(
    `/models/ad_wf_eventaudit` +
    `?$filter=AD_Table_ID eq ${C_INVOICE_AD_TABLE_ID} and Record_ID eq ${invoiceId}` +
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
    title: "SALES INVOICE",
    subtitle: "Dokumen ini sah dengan histori approval terlampir",
    logoDataUrl, 
    infoLeft: [
      ["No. ",        ": " + header.DocumentNo],
      ["Customer",    ": " + (header.C_BPartner_ID?.identifier || "-")],
      ["Description", ": " + (header.Description || "-")],
    ],
    infoRight: [
      ["Date",        ": " + new Date(header.DateInvoiced).toLocaleDateString("id-ID")],
      ["Status",      ": " + (STATUS_MAP[statusCode] || statusCode)],
      ["Grand Total", ": " + fmtRp(header.GrandTotal)],
    ],
    table: {
      head: [["Date of Service", "Type of Service", "No of Unit", "Unit", "Price", "Amount"]],
      body: lines.map((l) => [
        formatDateService(l.DateService),
        l.Description || cleanIdentifier(l.M_Product_ID?.identifier),
        numberFormatter.format(l.QtyEntered ?? 0),
        l.C_UOM_ID?.identifier || "-",
        numberFormatter.format(l.PriceActual ?? 0),
        numberFormatter.format(l.LineNetAmt ?? 0),
      ]),
      columnStyles: {
        0: { cellWidth: 75 },
        1: { cellWidth: 215 },
        2: { cellWidth: 55, halign: 'right' },
        3: { cellWidth: 45 },
        4: { cellWidth: 75, halign: 'right' },
        5: { cellWidth: 80, halign: 'right' },
      },
    },
    history,
    verifyUrl: `${VERIFY_BASE_URL}/${header.uid}`,
    verifyCaption: "Scan untuk verifikasi keaslian & status approval dokumen {documentNo}",
    filenamePrefix: "PI",
    documentNo: header.DocumentNo,
  });
}
