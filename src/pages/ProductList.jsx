import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from "react-router-dom";
import ReactDOMServer from "react-dom/server";
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { LogoSMAMerahHitam, LogoSMA20 } from "../components/Icons";
import { idempiereApi, getProductImageBlobUrls, getFirstProductImageBlobUrl } from '../utils/idempiereApi';
import '../App.css';

// ---------- Brand palette (sesuaikan dengan warna resmi Sekupang Logistics) ----------
const BRAND = {
  orange: [246, 166, 35],
  navy: [26, 38, 91],
  white: [255, 255, 255],
  grey: [128, 128, 128],
  textDark: [30, 30, 30],
};

const thumbBoxStyle = {
  width: 44, height: 44, borderRadius: 6, overflow: 'hidden',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const pageSize = 10;
  const [totalRecords, setTotalRecords] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const thumbUrlsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;

    const loadThumbnails = async () => {
      thumbUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      thumbUrlsRef.current = [];

      const entries = await Promise.all(
        products.map(async (p) => {
          const productId = p.id ?? p.M_Product_ID;
          try {
            const url = await getFirstProductImageBlobUrl(productId);
            if (url) thumbUrlsRef.current.push(url);
            return [productId, url];
          } catch {
            return [productId, null];
          }
        })
      );

      if (!cancelled) setThumbnails(Object.fromEntries(entries));
    };

    if (products.length > 0) loadThumbnails();
    else setThumbnails({});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  useEffect(() => {
    return () => {
      thumbUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  const columns = [
    { key: 'Thumbnail', label: '' },
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

  function isYes(val) {
    return val === true || val === 'Y' || val === 'true';
  }

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

  const drawBrandBackground = (doc, pageWidth, pageHeight) => {
    const { orange, navy, grey, white } = BRAND;
    doc.setFillColor(...orange);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setFillColor(...white);
    doc.triangle(pageWidth * 0.44, 0, pageWidth, 0, pageWidth, 65, 'F');
    doc.triangle(pageWidth * 0.44, 0, pageWidth, 65, pageWidth * 0.61, 65, 'F');
    doc.setFillColor(...orange);
    doc.triangle(pageWidth * 0.45, 0, pageWidth, 0, pageWidth, 65, 'F');
    doc.triangle(pageWidth * 0.45, 0, pageWidth, 65, pageWidth * 0.62, 65, 'F');
    doc.setFillColor(...white);
    doc.circle(pageWidth - 12, 2, 112, 'F');
    doc.setFillColor(...navy);
    doc.circle(pageWidth - 10, 0, 110, 'F');
    doc.setFillColor(...white);
    doc.circle(pageWidth - 45, 40, 32, 'F');
    doc.setFillColor(...grey);
    const opacity50 = new doc.GState({ opacity: 0.5 });
    doc.setGState(opacity50);
    doc.circle(400, pageHeight - 20, 150, 'F');
    const opacityFull = new doc.GState({ opacity: 1.0 });
    doc.setGState(opacityFull);
    doc.setFillColor(...white);
    doc.circle(420, pageHeight - 30, 130, 'F');
    doc.setFillColor(...orange);
    doc.rect(0, pageHeight - 20, pageWidth, 40, 'F');
    doc.setFillColor(...white);
    doc.circle(-33, pageHeight + 27, 140, 'F');
    doc.setFillColor(...navy);
    doc.circle(-35, pageHeight + 30, 140, 'F');
  };

  const generateProductPDF = async (productId) => {
    const product = await idempiereApi(
      `/models/m_product/${productId}` +
      `?$select=Value,Name,Description,UPC,IsPurchased,IsSold,M_Product_Category_ID,UpdatedBy,Updated`
    );

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
      (blobUrls || []).forEach((i) => URL.revokeObjectURL(i.url));
    }

    const qrValue = product.UPC || product.Value || String(productId);
    const qrDataUrl = await QRCode.toDataURL(qrValue, { margin: 1, width: 300 });

    const logoSvgString = ReactDOMServer.renderToStaticMarkup(<LogoSMAMerahHitam />);
    const logoDataUrl = await svgToPngDataUrl(logoSvgString, 70, 42);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 55;
    const marginRight = 40;
    const usableWidth = pageWidth - marginLeft - marginRight;

    drawBrandBackground(doc, pageWidth, pageHeight);
    doc.addImage(logoDataUrl, "PNG", pageWidth - 75, 20, 58, 38);

    doc.setTextColor(...BRAND.textDark);
    doc.setFontSize(22).setFont(undefined, "bold");
    doc.text("Catalogue Product/Service", marginLeft, 60);

    let y = 105;
    const qrSize = 90;
    doc.addImage(qrDataUrl, "PNG", marginLeft, y, qrSize, qrSize);

    const isPurchasedLabel = isYes(product.IsPurchased) ? "Yes" : "No";
    const isSoldLabel = isYes(product.IsSold) ? "Yes" : "No";
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
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(1);
      doc.line(marginLeft + usableWidth / 2, innerY, marginLeft + usableWidth / 2, innerY + innerHeight);
    } else {
      doc.setFont(undefined, "italic").setFontSize(9);
      doc.text("Tidak ada gambar terlampir", pageWidth / 2, y + imgAreaHeight / 2, { align: "center" });
    }

    y += imgAreaHeight + 25;

    doc.setFontSize(11).setFont(undefined, "bold");
    doc.setTextColor(...BRAND.textDark);
    doc.text("Description:", marginLeft, y);
    y += 16;

    doc.setFont(undefined, "normal").setFontSize(10.5);
    const descText = product.Description || "-";
    const descLines = doc.splitTextToSize(descText, usableWidth);
    doc.text(descLines, marginLeft, y);
    y += descLines.length * 14;

    const updatedBy = product.UpdatedBy?.identifier || "-";
    const updatedDate = product.Updated
      ? new Date(product.Updated).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "-";

    doc.setFont(undefined, "bold").setFontSize(10);
    doc.setTextColor(...BRAND.textDark);
    doc.text(`Update by: ${updatedBy}`, 350, pageHeight - 52, { align: "left" });
    doc.text(`Update Date: ${updatedDate}`, 350, pageHeight - 32, { align: "left" });
    doc.text(`www.sekupanglogistics.com`, pageWidth / 2 + 10, pageHeight - 6, { align: "center" });

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
        <button
          onClick={() => !isDownloading && handleDownload(item)}
          disabled={isDownloading}
          className="btn-action-view"
          style={{ cursor: isDownloading ? 'not-allowed' : 'pointer', opacity: isDownloading ? 0.6 : 1 }}
        >
          {isDownloading ? '⏳ ...' : '⬇️ Download'}
        </button>

        <Link
          to={isEditDisabled ? '#' : `/product/edit/${item.id}`}
          style={{ pointerEvents: isEditDisabled ? 'none' : 'auto' }}
        >
          <button
            disabled={isEditDisabled}
            className="btn-action-edit"
            style={{
              color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px',
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

  const tableData = products.map((p) => {
    const productId = p.id ?? p.M_Product_ID;
    const url = thumbnails[productId];

    return {
      ...p,
      Thumbnail: url ? (
        <div style={{ ...thumbBoxStyle, background: '#f1f5f9' }}>
          <img src={url} alt={p.Name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <div style={{ ...thumbBoxStyle, background: '#1a1a2e' }}>
          <LogoSMA20 />
        </div>
      ),
    };
  });

  return (
    <div className="card-container">
      <PageHeader
        title="Product / Service"
        onSearch={(val) => { setSearch(val); setOffset(0); }}
      />
      <DataTable
        columns={columns}
        data={tableData}
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