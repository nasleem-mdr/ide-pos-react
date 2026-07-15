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
    const marginLeft = 40;
    const marginRight = 40;
    const usableWidth = pageWidth - marginLeft - marginRight;

    // --- Header ---
    doc.addImage(logoDataUrl, "PNG", 20, 15, 70, 42);
    doc.setFontSize(16).setFont(undefined, "bold");
    doc.text("PRODUCT / JASA", pageWidth / 2, 38, { align: "center" });
    doc.setLineWidth(1);
    doc.line(20, 65, pageWidth - 20, 65);

    // --- QR Code (centered) ---
    const qrSize = 110;
    const qrX = pageWidth / 2 - qrSize / 2;
    let y = 85;
    doc.addImage(qrDataUrl, "PNG", qrX, y, qrSize, qrSize);
    y += qrSize + 15;
    doc.line(20, y, pageWidth - 20, y);
    y += 25;

    // --- Info fields ---
    const categoryLabel = product.M_Product_Category_ID?.identifier || "-";
    const isPurchasedLabel = product.IsPurchased === "Y" ? "Yes" : "No";
    const isSoldLabel = product.IsSold === "Y" ? "Yes" : "No";

    doc.setFontSize(10).setFont(undefined, "normal");
    const labelX = marginLeft;
    const colonX = marginLeft + 90;
    const valueX = marginLeft + 100;
    const lineHeight = 16;

    const drawField = (label, value) => {
      doc.setFont(undefined, "bold");
      doc.text(label, labelX, y);
      doc.setFont(undefined, "normal");
      doc.text(":", colonX, y);
      doc.text(String(value ?? "-"), valueX, y);
      y += lineHeight;
    };

    drawField("Value/Search", product.Value);
    drawField("Name", product.Name);
    drawField("Category", categoryLabel);
    drawField("isPurchase", isPurchasedLabel);
    drawField("isSold", isSoldLabel);

    // Description (multi-line wrap)
    doc.setFont(undefined, "bold");
    doc.text("Description", labelX, y);
    doc.setFont(undefined, "normal");
    doc.text(":", colonX, y);
    const descText = product.Description || "-";
    const descLines = doc.splitTextToSize(descText, usableWidth - 100);
    doc.text(descLines, valueX, y);
    y += descLines.length * 13 + 10;

    y += 10;
    doc.line(20, y, pageWidth - 20, y);
    y += 20;

    // --- Images section ---
    const imgAreaTop = y;
    const imgAreaHeight = 220;

    const drawImageContained = (img, boxX, boxWidth, boxY, boxHeight) => {
      const ratio = Math.min(boxWidth / img.width, boxHeight / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const drawX = boxX + (boxWidth - drawW) / 2;
      const drawY = boxY + (boxHeight - drawH) / 2;
      doc.addImage(img.dataUrl, "PNG", drawX, drawY, drawW, drawH);
    };

    if (images.length === 1) {
      // Satu gambar, diposisikan di tengah
      const boxWidth = usableWidth * 0.6;
      const boxX = marginLeft + (usableWidth - boxWidth) / 2;
      drawImageContained(images[0], boxX, boxWidth, imgAreaTop, imgAreaHeight);
    } else if (images.length === 2) {
      // Dua gambar, komposisi 50% x 50%
      const halfWidth = usableWidth / 2;
      drawImageContained(images[0], marginLeft, halfWidth - 10, imgAreaTop, imgAreaHeight);
      drawImageContained(images[1], marginLeft + halfWidth + 10, halfWidth - 10, imgAreaTop, imgAreaHeight);
      // Garis pembatas putus-putus antar gambar
      doc.setLineDashPattern([2, 2], 0);
      doc.line(pageWidth / 2, imgAreaTop, pageWidth / 2, imgAreaTop + imgAreaHeight);
      doc.setLineDashPattern([], 0);
    } else {
      doc.setFont(undefined, "italic").setFontSize(9);
      doc.text("Tidak ada gambar terlampir", pageWidth / 2, imgAreaTop + imgAreaHeight / 2, { align: "center" });
    }

    y = imgAreaTop + imgAreaHeight + 15;
    doc.line(20, y, pageWidth - 20, y);

    // --- Footer ---
    const pageHeight = doc.internal.pageSize.getHeight();
    const updatedBy = product.UpdatedBy?.identifier || "-";
    const updatedDate = product.Updated
      ? new Date(product.Updated).toLocaleDateString("id-ID")
      : "-";
    doc.setFont(undefined, "normal").setFontSize(8);
    doc.text(`Update by : ${updatedBy}`, marginLeft, pageHeight - 25);
    doc.text(`Update Date : ${updatedDate}`, pageWidth - marginRight, pageHeight - 25, { align: "right" });

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
