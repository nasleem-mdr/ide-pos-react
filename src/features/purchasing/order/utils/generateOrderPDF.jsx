import { idempiereApi } from "@/api/idempiereApi";
import { renderDocumentPDF } from "@/utils/pdf/renderDocumentPDF";
import { cleanIdentifier } from "@/utils/pdf/formatIdentifier";

const C_ORDER_AD_TABLE_ID = 259;

const STATUS_MAP = {
  DR: "Draft",
  IP: "Dalam Proses Approval",
  CO: "Selesai / Disetujui",
  CL: "Ditutup",
  VO: "Dibatalkan",
  NA: "Ditolak",
};

const VERIFY_BASE_URL = "https://192.168.0.126:8432/view/order";

const numberFormatter = new Intl.NumberFormat("en-US");
const fmtRp = (n) => ` ${Math.round(n || 0).toLocaleString("id-ID")}`;

export async function generateOrderPDF(orderId, documentNo, orgInfo) {
  const header = await idempiereApi(
    `/models/c_order/${orderId}` +
      `?$select=DocumentNo,DateOrdered,Description,DocStatus,AD_Org_ID,CreatedBy,C_BPartner_ID,M_Warehouse_ID,GrandTotal,C_Order_UU`
  );

  const linesRes = await idempiereApi(
    `/models/c_orderline` +
      `?$filter=C_Order_ID eq ${orderId}` +
      `&$select=Line,M_Product_ID,QtyOrdered,C_UOM_ID,PriceActual,LineNetAmt,Description` +
      `&$orderby=Line`
  );
  const lines = linesRes.records || [];

  const historyRes = await idempiereApi(
    `/models/ad_wf_eventaudit` +
      `?$filter=AD_Table_ID eq ${C_ORDER_AD_TABLE_ID} and Record_ID eq ${orderId}` +
      `&$select=AD_WF_Node_ID,AD_User_ID,Updated` +
      `&$orderby=Updated asc`
  );

  const history = (historyRes.records || [])
    .filter(
      (h) =>
        ![
          "(start)",
          "(docauto)",
          "(completedocument)",
        ].includes((h.AD_WF_Node_ID?.identifier || "").toLowerCase())
    )
    .map((h) => ({
      nodeName: h.AD_WF_Node_ID?.identifier || "-",
      userName: h.AD_User_ID?.identifier || "-",
      date: h.Updated ? new Date(h.Updated).toLocaleDateString("id-ID") : "-",
    }));

  const statusCode = header.DocStatus?.id ?? header.DocStatus;

  await renderDocumentPDF({
    title: "PURCHASE ORDER (PO)",
    subtitle: "Dokumen ini sah dengan histori approval terlampir",
    orgInfo,
    infoLeft: [
      ["No. Dokumen", ": " + header.DocumentNo],
      ["Vendor", ": " + (header.C_BPartner_ID?.identifier || "-")],
      ["Gudang Tujuan", ": " + (header.M_Warehouse_ID?.identifier || "-")],
      ["Keterangan", ": " + (header.Description || "-")],
    ],
    infoRight: [
      ["Tanggal", ": " + new Date(header.DateOrdered).toLocaleDateString("id-ID")],
      ["Departemen", ": " + (header.AD_Org_ID?.identifier || "-")],
      ["Status", ": " + (STATUS_MAP[statusCode] || statusCode)],
      ["Grand Total", ": " + fmtRp(header.GrandTotal)],
    ],
    table: {
      head: [["No", "Nama Barang", "Qty", "UOM", "Harga", "Line Amount"]],
      body: lines.map((l, idx) => [
        idx + 1,
        l.Description || cleanIdentifier(l.M_Product_ID?.identifier) || "-",
        numberFormatter.format(l.QtyOrdered ?? 0),
        l.C_UOM_ID?.identifier || "-",
        numberFormatter.format(l.PriceActual ?? 0),
        numberFormatter.format(l.LineNetAmt ?? 0),
      ]),
      // Penambahan foot pada Order PDF
      foot: [
        [
          { content: "Grand Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
          { content: numberFormatter.format(header.GrandTotal ?? 0), styles: { halign: "right", fontStyle: "bold" } },
        ],
      ],
      columnStyles: {
        0: { cellWidth: 30, halign: "center" },
        1: { cellWidth: 200 },
        2: { cellWidth: 50, halign: "right" },
        3: { cellWidth: 50 },
        4: { cellWidth: 80, halign: "right" },
        5: { cellWidth: 85, halign: "right" },
      },
    },
    history,
    verifyUrl: `${VERIFY_BASE_URL}/${header.C_Order_UU || header.uid || orderId}`,
    verifyCaption: "Scan untuk verifikasi keaslian & status approval dokumen {documentNo}",
    filenamePrefix: "PO",
    documentNo: header.DocumentNo,
  });
}