import ReactDOMServer from "react-dom/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { svgToPngDataUrl } from "./svgToPngDataUrl";

// ─────────────────────────────────────────────────────────────────────────────
// renderListPDF.js
// Generic list/report PDF renderer (dipakai Daftar Sales, Daftar Purchase
// Invoice, Daftar PO, dst) — partner dari renderDocumentPDF.js (yang untuk
// 1 dokumen). Reuse jsPDF + autoTable + cara render logo yang sama persis
// supaya konsisten visual dgn PDF dokumen tunggal.
//
// Kolom `width: 'flex'` (maksimal 1 kolom) melebar mengisi sisa ruang
// setelah kolom `width: 'auto'` lain dihitung dari lebar konten header-nya —
// dihitung manual di sini karena autoTable tidak native punya konsep ini
// (opsinya cuma fixed pt / 'auto' murni berdasar konten, tanpa constraint
// "1 kolom ambil semua sisa").
//
// Header (logo + title + periode) diulang di SETIAP halaman kalau data
// >1 halaman (lewat `didDrawPage` hook autoTable) — konsisten sama pola
// laporan pada umumnya, bukan cuma di halaman pertama.
//
// Total row (footer) OPSIONAL — hanya dicetak kalau totalValue diberikan.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} config
 * @param {string} config.title            - mis. "DAFTAR SALES"
 * @param {JSX.Element} [config.logo]      - komponen SVG statis, mis. <LogoSMAMerahHitam />
 * @param {string} [config.logoDataUrl]    - alternatif: data URL siap pakai (mis. dari AD_OrgInfo.Logo_ID via useOrgInfo)
 * @param {string} [config.orgName]        - Nama organisasi, mis. dari useOrgInfo().orgInfo?.name
 * @param {string} [config.orgPhone]       - mis. dari useOrgInfo().orgInfo?.phone
 * @param {string} [config.orgEmail]       - mis. dari useOrgInfo().orgInfo?.email
 * @param {string} config.periodLabel      - mis. "PERIODE : 01/01/2026  31/01/2026"
 * @param {Array<{key:string,label:string,width?:'auto'|'flex'|number,align?:'left'|'center'|'right'}>} config.columns
 * @param {Array<Object>} config.rows      - array objek, key sesuai columns[].key
 * @param {string} [config.totalLabel]     - mis. "Total Semua" — opsional
 * @param {string} [config.totalValue]     - mis. "Rp 12.345.000" — opsional; kalau kosong, baris total tidak dicetak
 * @param {string} config.filenamePrefix   - mis. "DAFTAR-SALES"
 */
export async function renderListPDF(config) {
    const {
        title, logo, logoDataUrl: providedLogoDataUrl,
        orgName, orgPhone, orgEmail,
        periodLabel,
        columns, rows,
        totalLabel, totalValue,
        filenamePrefix,
    } = config;

    let logoDataUrl = providedLogoDataUrl || null;
    if (!logoDataUrl && logo) {
        const logoSvgString = ReactDOMServer.renderToStaticMarkup(logo);
        logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 20, marginRight = 20;
    const usableWidth = pageWidth - marginLeft - marginRight;

    const HEADER_HEIGHT = 110; // ruang dicadangkan di tiap halaman utk logo+title+periode

    // ── Hitung lebar kolom: 'flex' ambil sisa setelah semua 'auto' dihitung ─
    // autoTable butuh angka pt eksplisit per kolom di columnStyles supaya
    // kolom 'flex' benar-benar konsisten lebar di setiap baris/halaman
    // (kalau dibiarkan full-auto, autoTable bisa hitung ulang per halaman
    // dan bikin lebar kolom flex "loncat-loncat" antar halaman).
    doc.setFontSize(8);
    const autoWidths = {};
    let flexKey = null;
    columns.forEach(col => {
        if (col.width === 'flex') {
            flexKey = col.key;
        } else if (typeof col.width === 'number') {
            autoWidths[col.key] = col.width;
        } else {
            // 'auto' (default) — perkirakan dari label header + sample isi terpanjang, + padding
            const headerW = doc.getTextWidth(String(col.label));
            const maxBodyW = rows.reduce((m, r) => Math.max(m, doc.getTextWidth(String(r[col.key] ?? ''))), 0);
            autoWidths[col.key] = Math.max(headerW, maxBodyW) + 20;
        }
    });
    const usedByAuto = Object.values(autoWidths).reduce((s, w) => s + w, 0);
    if (flexKey) {
        autoWidths[flexKey] = Math.max(usableWidth - usedByAuto, 60); // minimal 60pt biar tidak collapse
    }

    const columnStyles = {};
    columns.forEach((col, idx) => {
        columnStyles[idx] = {
            cellWidth: autoWidths[col.key],
            halign: col.align || 'left',
        };
    });

    const head = [columns.map(c => c.label)];
    const body = rows.map(r => columns.map(c => String(r[c.key] ?? '-')));
    const foot = (totalLabel && totalValue != null)
        ? [[
            { content: totalLabel, colSpan: columns.length - 1, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: String(totalValue), styles: { halign: columns[columns.length - 1].align || 'right', fontStyle: 'bold' } },
        ]]
        : undefined;

        const drawHeader = () => {
            const headerCenterX = pageWidth / 2;
        
            // Logo — sedikit lebih besar & diberi margin atas lebih proporsional
            if (logoDataUrl) {
                doc.addImage(logoDataUrl, "PNG", marginLeft, 12, 60, 60);
            }
        
            // Baris 1: Nama Organisasi — identitas utama, paling besar & tegas
            doc.setFontSize(15).setFont(undefined, "bold");
            doc.text(orgName || "-", headerCenterX, 26, { align: "center" });
        
            // Baris 2: Kontak — normal (bukan bold), ukuran lebih wajar (9pt),
            // beri jarak lebih lega dari baris nama org (26 → 40, bukan 22 → 34)
            const contactParts = [];
            if (orgPhone) contactParts.push(`Telp: ${orgPhone}`);
            if (orgEmail) contactParts.push(`Email: ${orgEmail}`);
            if (contactParts.length) {
                doc.setFontSize(9).setFont(undefined, "normal");
                doc.text(contactParts.join("   •   "), headerCenterX, 40, { align: "center" });
            }
        
            // Garis pemisah tipis antara blok "identitas Org" dan "identitas laporan"
            // — memberi jeda visual, bukan cuma jarak kosong
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.5);
            doc.line(headerCenterX - 60, 50, headerCenterX + 60, 50);
            doc.setDrawColor(0, 0, 0);
        
            // Baris 3: Judul dokumen — paling menonjol, beri jarak cukup dari garis pemisah
            doc.setFontSize(17).setFont(undefined, "bold");
            doc.text(title, headerCenterX, 68, { align: "center" });
        
            // Baris 4: Periode — sedikit lebih besar dari sebelumnya (10 → 9.5 normal),
            // beri jarak wajar dari judul
            if (periodLabel) {
                doc.setFontSize(9.5).setFont(undefined, "normal");
                doc.text(periodLabel, headerCenterX, 82, { align: "center" });
            }
        
            // Garis pembatas tegas di bawah seluruh blok header, sebelum tabel mulai
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.75);
            doc.line(marginLeft, HEADER_HEIGHT - 15, pageWidth - marginRight, HEADER_HEIGHT - 15);
            doc.setLineWidth(0.5); // reset ke default styles tabel
        };

    autoTable(doc, {
        startY: HEADER_HEIGHT,
        head, body, foot,
        theme: "striped", // zebra striping otomatis (baris genap abu-abu, bawaan jspdf-autotable)
        styles: { fontSize: 8, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5 },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.5, lineColor: [0, 0, 0] },
        footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.5, lineColor: [0, 0, 0] },
        columnStyles,
        margin: { left: marginLeft, right: marginRight, top: HEADER_HEIGHT },
        // Header (logo+title+periode) diulang tiap halaman.
        didDrawPage: () => {
            drawHeader();
        },
    });

    doc.save(`${filenamePrefix}.pdf`);
}
