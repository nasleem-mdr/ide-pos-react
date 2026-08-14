import ReactDOMServer from "react-dom/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

const svgToPngDataUrl = (svgString, width, height) => {
    return new Promise((resolve, reject) => {
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = url;
    });
};

/**
 * Generic document PDF renderer (dipakai PO, PI, SI, dst).
 *
 * @param {Object} config
 * @param {string} config.title              - Judul dokumen, mis. "PURCHASE INVOICE (PI)"
 * @param {string} config.subtitle           - Teks kecil di bawah judul
 * @param {JSX.Element} config.logo          - Komponen logo SVG (mis. <LogoSMAMerahHitam />)
 * @param {Array<[string,string]>} config.infoLeft   - [[label, value], ...]
 * @param {Array<[string,string]>} config.infoRight  - [[label, value], ...]
 * @param {Object} config.table              - { head: [[...]], body: [[...]] }
 * @param {Array}  config.history            - [{ nodeName, userName, date }]
 * @param {string} config.verifyUrl          - URL untuk QR code
 * @param {string} config.verifyCaption      - Caption di bawah QR (boleh pakai {documentNo})
 * @param {string} config.filenamePrefix     - mis. "PO" / "PI"
 * @param {string} config.documentNo
 */
export async function renderDocumentPDF(config) {
    const {
        title, subtitle, logo,logoDataUrl: providedLogoDataUrl,
        infoLeft = [], infoRight = [],
        table, history = [],
        verifyUrl, verifyCaption,
        filenamePrefix, documentNo,
    } = config;

    //const logoSvgString = ReactDOMServer.renderToStaticMarkup(logo);
    //const logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let logoDataUrl = providedLogoDataUrl || null;
    if (!logoDataUrl && logo) {
        const logoSvgString = ReactDOMServer.renderToStaticMarkup(logo);
        logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);
    }
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 20, 5, 70, 42);
    }
    doc.setFontSize(14).setFont(undefined, "bold");
    doc.text(title, pageWidth / 2, 30, { align: "center" });
    doc.setFontSize(9).setFont(undefined, "italic");
    doc.text(subtitle, pageWidth / 2, 44, { align: "center" });
    doc.line(20, 55, pageWidth - 20, 55);

    // Info fields
    doc.setFont(undefined, "normal").setFontSize(9);
    let y = 75;
    infoLeft.forEach(([label, val], i) => {
        doc.text(label, 20, y + i * 16);
        doc.text(String(val), 100, y + i * 16);
    });
    infoRight.forEach(([label, val], i) => {
        doc.text(label, 320, y + i * 16);
        doc.text(String(val), 400, y + i * 16);
    });

    // Tabel item
    autoTable(doc, {
        startY: y + Math.max(infoLeft.length, infoRight.length) * 16 + 20,
        head: table.head,
        body: table.body,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: table.columnStyles || {},   // ← FIX: sebelumnya tidak pernah diteruskan
        margin: { left: 20, right: 20 },
        tableWidth: pageWidth - 40,
    });
    // Histori Approval
    let finalY = doc.lastAutoTable.finalY + 20;
    doc.setFont(undefined, "bold").setFontSize(10);
    doc.text("Histori Approval / Workflow", 20, finalY);
    doc.line(20, finalY + 6, pageWidth - 20, finalY + 6);
    finalY += 20;

    const marginLeft = 20, marginRight = 20;
    const usableWidth = pageWidth - marginLeft - marginRight;
    const colCount = 5;
    const colWidth = usableWidth / colCount;
    const rowHeight = 65;

    history.forEach((h, idx) => {
        const col = idx % colCount;
        const row = Math.floor(idx / colCount);
        const x = marginLeft + col * colWidth;
        const yy = finalY + row * rowHeight;

        if (row > 0 && col === 0) {
            doc.setLineDashPattern([2, 2], 0);
            doc.setDrawColor(150, 150, 150);
            doc.line(20, yy - 10, pageWidth - 20, yy - 10);
            doc.setLineDashPattern([], 0);
            doc.setDrawColor(0, 0, 0);
        }

        const maxTextWidth = colWidth - 5;
        doc.setFont(undefined, "bold").setFontSize(7.5);
        const splitNode = doc.splitTextToSize(h.nodeName || "-", maxTextWidth);
        doc.text(splitNode, x, yy);
        const nodeHeightOffset = (splitNode.length - 1) * 9;

        doc.setFont(undefined, "normal").setFontSize(7.5);
        const splitUser = doc.splitTextToSize(h.userName || "-", maxTextWidth);
        const userY = yy + 22 + nodeHeightOffset;
        doc.text(splitUser, x, userY);

        const textWidth = doc.getTextWidth(splitUser[0] || "");
        doc.line(x, userY + 2, x + Math.min(textWidth, maxTextWidth), userY + 2);

        const userHeightOffset = (splitUser.length - 1) * 9;
        doc.text(h.date || "-", x, userY + 15 + userHeightOffset);
    });

    const totalRows = Math.ceil(history.length / colCount);
    finalY += totalRows * rowHeight + 20;

    // QR
    finalY += 20;
    doc.setFont(undefined, "bold").setFontSize(9);
    doc.text("Verifikasi Dokumen Digital", pageWidth / 2, finalY, { align: "center" });
    doc.addImage(qrDataUrl, "PNG", pageWidth / 2 - 30, finalY + 10, 60, 60);
    doc.setFont(undefined, "normal").setFontSize(6.5);
    doc.text(verifyCaption.replace("{documentNo}", documentNo), pageWidth / 2, finalY + 80, { align: "center" });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(undefined, "italic").setFontSize(7);
    doc.text(
        `Dokumen ini dicetak otomatis dari sistem dan sah tanpa tanda tangan basah selama status approval di atas terverifikasi pada sistem - dicetak ${new Date().toLocaleDateString("id-ID")}`,
        pageWidth / 2, pageHeight - 20, { align: "center" }
    );

    doc.save(`${filenamePrefix}-${documentNo}.pdf`);
}