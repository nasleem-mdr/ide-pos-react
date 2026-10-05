// src/features/purchasing/report/hooks/usePurchaseOrderDetailExport.js
// Logika Print PDF & Export Excel Laporan Detail Purchase Order (pivot per produk).
// Tidak ada JSX / alert di sini: fungsi mengembalikan { ok, message } supaya
// UI yang memutuskan cara menampilkan pesan.
import { useState, useCallback } from "react";
import * as XLSX from "xlsx"; // npm install xlsx (kalau belum ada di project)
import { renderPivotListPDF } from "@/utils/pdf/renderPivotListPDF"; // khusus laporan grouped/pivot — renderListPDF asli tidak diubah
import { useOrgInfo } from "@/shared/hooks/useOrgInfo";

const fmt = (n) => n.toLocaleString("id-ID");

export default function usePurchaseOrderDetailExport({ groupedByProduct, grandTotal, startDate, endDate }) {
    const { orgInfo } = useOrgInfo();
    const [printing, setPrinting] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);

    // ── Print PDF (pivot per produk) ────────────────────────────────────
    const printPdf = useCallback(async () => {
        if (groupedByProduct.length === 0) return { ok: false, message: "Tidak ada data untuk dicetak." };
        setPrinting(true);
        try {
            const rows = [];
            let no = 0;
            groupedByProduct.forEach((group) => {
                rows.push({
                    no: "",
                    documentNo: "",
                    productName: `${group.productName}  (Qty: ${fmt(group.totalQty)} | Total: ${fmt(group.totalAmount)})`,
                    qty: "",
                    price: "",
                    lineTotal: "",
                    _isGroupHeader: true,
                });
                group.rows.forEach((r) => {
                    no += 1;
                    rows.push({
                        no,
                        documentNo: r.documentNo,
                        productName: r.productName,
                        qty: fmt(r.qty),
                        price: fmt(r.price),
                        lineTotal: fmt(r.lineTotal),
                    });
                });
            });

            await renderPivotListPDF({
                title: "LAPORAN DETAIL PURCHASE ORDER (PER PRODUK)",
                logoDataUrl: orgInfo?.logoUrl,
                orgName: orgInfo?.name,
                orgPhone: orgInfo?.phone,
                orgEmail: orgInfo?.email,
                periodLabel: `PERIODE : ${startDate}  s/d  ${endDate}`,
                columns: [
                    { key: "no", label: "No", width: 25, align: "center" },
                    { key: "documentNo", label: "No. Order", width: 60 },
                    { key: "productName", label: "Produk", width: 165 },
                    { key: "qty", label: "Qty", width: 40, align: "right" },
                    { key: "price", label: "Harga", width: 65, align: "right" },
                    { key: "lineTotal", label: "Total", width: 75, align: "right" },
                ],
                rows,
                totalLabel: "Grand Total",
                totalValue: fmt(grandTotal),
                filenamePrefix: `PURCHASE-ORDER-DETAIL-PER-PRODUK-${startDate}_${endDate}`,
            });
            return { ok: true };
        } catch (err) {
            console.error("Gagal generate PDF:", err.message);
            return { ok: false, message: "Gagal membuat PDF laporan." };
        } finally {
            setPrinting(false);
        }
    }, [groupedByProduct, grandTotal, startDate, endDate, orgInfo]);

    // ── Export Excel (AOA manual supaya baris ringkasan produk bisa
    // disisipkan di antara baris detail, sama dengan layar & PDF) ────────
    const exportExcel = useCallback(() => {
        if (groupedByProduct.length === 0) return { ok: false, message: "Tidak ada data untuk diexport." };
        setExportingExcel(true);
        try {
            const aoa = [
                ["LAPORAN DETAIL PURCHASE ORDER (PER PRODUK)"],
                [`Periode: ${startDate} s/d ${endDate}`],
                [],
                ["No", "No. Order", "Vendor", "Qty", "Harga", "Total"],
            ];

            let no = 0;
            groupedByProduct.forEach((group) => {
                aoa.push([`📦 ${group.productName}`, "", "", group.totalQty, "", group.totalAmount]);
                group.rows.forEach((r) => {
                    no += 1;
                    aoa.push([no, r.documentNo, r.vendorName, r.qty, r.price, r.lineTotal]);
                });
            });

            aoa.push([]);
            aoa.push(["", "", "", "", "Grand Total", grandTotal]);

            const worksheet = XLSX.utils.aoa_to_sheet(aoa);
            worksheet["!cols"] = [
                { wch: 6 },  // No
                { wch: 16 }, // No. Order
                { wch: 26 }, // Vendor
                { wch: 10 }, // Qty
                { wch: 14 }, // Harga
                { wch: 16 }, // Total
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Detail per Produk");
            XLSX.writeFile(workbook, `PURCHASE-ORDER-DETAIL-PER-PRODUK-${startDate}_${endDate}.xlsx`);
            return { ok: true };
        } catch (err) {
            console.error("Gagal export Excel:", err.message);
            return { ok: false, message: "Gagal membuat file Excel." };
        } finally {
            setExportingExcel(false);
        }
    }, [groupedByProduct, grandTotal, startDate, endDate]);

    return { printing, exportingExcel, printPdf, exportExcel };
}
