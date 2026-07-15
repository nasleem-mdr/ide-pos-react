import React, { useState, useEffect, useCallback } from 'react';
import { Link } from "react-router-dom";
import ReactDOMServer from "react-dom/server";
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { LogoSMAMerahHitam } from "../components/Icons";
import { idempiereApi, getProductImageBlobUrls } from '../utils/idempiereApi'; // sesuaikan path
import '../App.css';

// ---------- Brand palette (sesuaikan dengan warna resmi Sekupang Logistics) ----------
const BRAND = {
  orange: [246, 166, 35],
  navy: [26, 38, 91],
  white: [255, 255, 255],
  textDark: [30, 30, 30],
};

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const pageSize = 10;
  const [totalRecords, setTotalRecords] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);

  const columns = [
    { key: 'Value', label: 'Search Key' },
    { key: 'Name', label: 'Partner Name' },
    { key: 'UPC', label: 'UPC/EAN' },
  ];

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const fields = 'Name,Value,Description,IsPurchased,IsSold,UPC';
      let url = `/models/m_product?$select=${fields}&$top=${pageSize}&$skip=${offset}`;
      if (search) {
        url += `&$filter=contains(tolower(Name),'${search.toLowerCase()}')`;
      }
      const data = await idempiereApi(url);
      setProducts(data.records || []);
      setTotalRecords(data['row-count'] ?? 0);
    } catch (err) {
      console.error("Fetch Error:", err.message);
      setProducts([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [offset, search]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // ---------- Helpers ----------

  const svgToPngDataUrl = (svgString, width, height) => {
    return new Promise((resolve, reject) => {
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * 2; // 2x untuk hasil lebih tajam di PDF
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

  // Blob URL (dari getProductImageBlobUrls) -> PNG dataURL + dimensi asli,
  // supaya bisa dipakai jsPDF addImage() dan proporsinya tetap terjaga.
  const blobUrlToImageData = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // Semua elemen background/brand digambar dengan shape jsPDF (fill, circle, lines),
  // jadi TIDAK perlu file background terpisah.
  const drawBrandBackground = (doc, pageWidth, pageHeight) => {
    const { orange, navy, white } = BRAND;

    // --- Pita oranye diagonal di pojok kanan atas ---
    doc.setFillColor(...orange);
    doc.triangle(
      pageWidth * 0.45, 0,
      pageWidth, 0,
      pageWidth, 95,
      'F'
    );
    doc.triangle(
      pageWidth * 0.45, 0,
      pageWidth, 95,
      pageWidth * 0.62, 95,
      'F'
    );

    // --- Lengkungan navy di bawah pita oranye (pojok kanan atas) ---
    doc.setFillColor(...navy);
    doc.circle(pageWidth + 10, 130, 140, 'F');

    // --- Badge putih untuk logo, di dalam area navy ---
    doc.setFillColor(...white);
    doc.circle(pageWidth - 55, 60, 28, 'F');

    // --- Lengkungan navy pojok kiri bawah ---
    doc.setFillColor(...navy);
    doc.circle(-30, pageHeight - 110, 130, 'F');

    // --- Pita oranye tipis di bagian paling bawah ---
    doc.setFillColor(...orange);
    doc.rect(0, pageHeight - 16, pageWidth, 16, 'F');
  };

  // ---------- PDF generation ----------

  const generateProductPDF = async (productId) => {
    // 1. Fetch header data
    const product = await idempiereApi(
      `/models/m_product/${productId}` +
      `?$select=Value,Name,Description,UPC,IsPurchased,IsSold,M_Product_Category_ID,UpdatedBy,Updated`
    );

    // 2. Fetch product images (max 2), lalu convert blob url -> dataURL utk jsPDF
    let blobUrls = [];
    let images = [];
    try {
      blobUrls = await getProductImageBlobUrls(productId);
      const first2 = (blobUrls || []).slice(0, 2);
      for (const item of first2) {
        try {
          const imgData = await blobUrlToImageData(item.url);
          images.push(imgData);
        } catch (imgErr) {
          console.error("Gagal memuat gambar produk:", imgErr.message);
        }
      }
    } catch (err) {
      console.error("Gagal fetch gambar produk:", err.message);
    } finally {
      // Bersihkan object URL setelah selesai dipakai (sama seperti ProductDetailSheet)
      (blobUrls || []).forEach((i) => URL.revokeObjectURL(i.url));
    }

    // 3. Generate QR code dari UPC (fallback ke Value jika UPC kosong)
    const qrValue = product.UPC || product.Value || String(productId);
    const qrDataUrl = await QRCode.toDataURL(qrValue, { margin: 1, width: 300 });

    // 4. Logo
    const logoSvgString = ReactDOMServer.renderToStaticMarkup(<LogoSMAMerahHitam />);
    const logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);

    // 5. Build PDF
    const doc = new jsPDF({ unit: "pt", format: "a4" }); // 595 x 842 pt
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 45;
    const marginRight = 45;
    const usableWidth = pageWidth - marginLeft - marginRight;

    // --- Background brand shapes (digambar duluan, di bawah semua konten) ---
    drawBrandBackground(doc, pageWidth, pageHeight);

    // --- Logo di dalam badge putih (pojok kanan atas) ---
    doc.addImage(logoDataUrl, "PNG", pageWidth - 75, 40, 40, 40);

    // --- Title ---
    doc.setTextColor(...BRAND.textDark);
    doc.setFontSize(22).setFont(undefined, "bold");
    doc.text("Catalogue Product/Service", marginLeft, 60);

    let y = 105;

    // --- QR Code (kiri) + Info fields (kanan), sejajar ---
    const qrSize = 90;
    doc.addImage(qrDataUrl, "PNG", marginLeft, y, qrSize, qrSize);

    const categoryLabel = product.M_Product_Category_ID?.identifier || "-";
    const isPurchasedLabel = product.IsPurchased === "Y" ? "Yes" : "No";
    const isSoldLabel = product.IsSold === "Y" ? "Yes" : "No";

    const infoX = marginLeft + qrSize + 25;
    const colonX = infoX + 90;
    const valueX = infoX + 100;
    let infoY = y + 15;
    const lineHeight = 20;

    doc.setFontSize(11);
    const drawField = (label, value) => {
      doc.setFont(undefined, "bold");
      doc.text(label, infoX, infoY);
      doc.text(":", colonX, infoY);
      doc.setFont(undefined, "normal");
      doc.text(String(value ?? "-"), valueX, infoY);
      infoY += lineHeight;
    };

    drawField("Value/Search", product.Value);
    drawField("Name", product.Name);
    drawField("isPurchased", isPurchasedLabel);
    drawField("isSold", isSoldLabel);

    y += qrSize + 30;

    // --- Kotak gambar produk (rounded border hitam, seperti contoh) ---
    const imgAreaHeight = 240;
    const boxRadius = 14;
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(2.5);
    doc.roundedRect(marginLeft, y, usableWidth, imgAreaHeight, boxRadius, boxRadius, 'S');

    const drawImageContained = (img, boxX, boxWidth, boxY, boxHeight) => {
      const ratio = Math.min(boxWidth / img.width, boxHeight / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const drawX = boxX + (boxWidth - drawW) / 2;
      const drawY = boxY + (boxHeight - drawH) / 2;
      doc.addImage(img.dataUrl, "PNG", drawX, drawY, drawW, drawH);
    };

    const innerPad = 18;
    const innerX = marginLeft + innerPad;
    const innerY = y + innerPad;
    const innerWidth = usableWidth - innerPad * 2;
    const innerHeight = imgAreaHeight - innerPad * 2;

    if (images.length === 1) {
      const boxWidth = innerWidth * 0.6;
      const boxX = innerX + (innerWidth - boxWidth) / 2;
      drawImageContained(images[0], boxX, boxWidth, innerY, innerHeight);
    } else if (images.length === 2) {
      const halfWidth = innerWidth / 2;
      drawImageContained(images[0], innerX, halfWidth - 10, innerY, innerHeight);
      drawImageContained(images[1], innerX + halfWidth + 10, halfWidth - 10, innerY, innerHeight);
      // Garis pembatas tipis antar gambar
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(1);
      doc.line(marginLeft + usableWidth / 2, innerY, marginLeft + usableWidth / 2, innerY + innerHeight);
    } else {
      doc.setFont(undefined, "italic").setFontSize(9);
      doc.text("Tidak ada gambar terlampir", pageWidth / 2, y + imgAreaHeight / 2, { align: "center" });
    }

    y += imgAreaHeight + 25;

    // --- Description ---
    doc.setFontSize(11).setFont(undefined, "bold");
    doc.setTextColor(...BRAND.textDark);
    doc.text("Description:", marginLeft, y);
    y += 16;

    doc.setFont(undefined, "normal").setFontSize(10.5);
    const descText = product.Description || "-";
    const descLines = doc.splitTextToSize(descText, usableWidth);
    doc.text(descLines, marginLeft, y);
    y += descLines.length * 14;

    // --- Footer ---
    const updatedBy = product.UpdatedBy?.identifier || "-";
    const updatedDate = product.Updated
      ? new Date(product.Updated).toLocaleDateString("id-ID", {
          day: "2-digit", month: "2-digit", year: "numeric",
        })
      : "-";

    doc.setFont(undefined, "bold").setFontSize(10);
    doc.setTextColor(...BRAND.textDark);
    doc.text(`Update by: ${updatedBy}`, pageWidth / 2, pageHeight - 90, { align: "center" });
    doc.text(`Update Date: ${updatedDate}`, pageWidth / 2, pageHeight - 72, { align: "center" });

    doc.save(`Product-${product.Value || productId}.pdf`);
  };

  const handleDownload = async (item) => {
    const productId = item.id ?? item.M_Product_ID;
    setDownloadingId(productId);
    try {
      await generateProductPDF(productId);
    } catch (err) {
      console.error("Gagal generate PDF:", err.message);
      alert("Gagal membuat dokumen PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const actionRenderer = (item) => {
    const isEditDisabled = item.IsActive === 'N';
    const isDownloading = downloadingId === (item.id ?? item.M_Product_ID);

    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Tombol Download menggantikan tombol View */}
        <button
          onClick={() => !isDownloading && handleDownload(item)}
          disabled={isDownloading}
          className="btn-action-view"
          style={{
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            opacity: isDownloading ? 0.6 : 1,
          }}
        >
          {isDownloading ? '⏳ ...' : '⬇️ Download'}
        </button>

        {/* Kondisi Tombol Edit tetap seperti semula */}
        <Link
          to={isEditDisabled ? '#' : `/product/edit/${item.id}`}
          style={{ pointerEvents: isEditDisabled ? 'none' : 'auto' }}
        >
          <button
            disabled={isEditDisabled}
            className="btn-action-edit"
            style={{
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              opacity: isEditDisabled ? 0.5 : 1,
              cursor: isEditDisabled ? 'not-allowed' : 'pointer',
              backgroundColor: isEditDisabled ? '#6c757d' : '#e0a800'
            }}
          >
            Edit
          </button>
        </Link>
      </div>
    );
  };

  return (
    <div className="card-container">
      <PageHeader
        title="Product / Service"
        onSearch={(val) => { setSearch(val); setOffset(0); }}
      />
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        offset={offset}
        pageSize={pageSize}
        totalRecords={totalRecords}
        onPageChange={(newOffset) => setOffset(newOffset)}
        renderActions={actionRenderer}
      />
    </div>
  );
}

export default ProductList;
1
