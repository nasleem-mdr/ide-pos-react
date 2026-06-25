import React, { useState, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import QtyStepper from '../common/QtyStepper';
import { COLOR, RADIUS } from '../../utils/styleTokens';
import { getProductImageBlobUrl, getProductAvailability } from '../../utils/idempiereApi';
import '../../css/ProductDetailSheet.css';

const ProductDetailSheet = ({
  isOpen,
  product,
  onClose,
  onConfirm,
  confirmLabel = 'Tambah ke Keranjang',
}) => {
  const [qty, setQty] = useState(1);
  const [uom, setUom] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [stock, setStock] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setQty(1);
      setUom({ C_UOM_ID: product.C_UOM_ID, Name: product.C_UOM_Name, multiplyRate: 1 });
    }
  }, [product]);

  useEffect(() => {
    let currentUrl = null;
    let cancelled = false;

    if (isOpen && product?.M_Product_ID) {
      setImageLoading(true);
      setImageUrl(null);
      getProductImageBlobUrl(product.M_Product_ID)
        .then(url => {
          if (cancelled) { if (url) URL.revokeObjectURL(url); return; }
          currentUrl = url;
          setImageUrl(url);
        })
        .finally(() => { if (!cancelled) setImageLoading(false); });
    }

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [isOpen, product?.M_Product_ID]);

  useEffect(() => {
    let cancelled = false;

    if (isOpen && product?.M_Product_ID) {
      setStockLoading(true);
      setStock(null);
      getProductAvailability(product.M_Product_ID)
        .then(data => { if (!cancelled) setStock(data); })
        .finally(() => { if (!cancelled) setStockLoading(false); });
    }

    return () => { cancelled = true; };
  }, [isOpen, product?.M_Product_ID]);

  if (!product) return null;

  const hasMultiUom = product.uomOptions && product.uomOptions.length > 1;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="90dvh">
      <div className="pds-wrapper">

        {/* Header */}
        <div className="pds-header">
          <div className="pds-header-info">
            <div className="pds-product-name" style={{ color: COLOR.textDk }}>
              {product.Name}
            </div>
            <div className="pds-meta-row">
              <span className="pds-product-value" style={{ color: COLOR.textLt }}>
                {product.Value}
              </span>
              {product.VendorName && (
                <span
                  className="pds-vendor-badge"
                  style={{ color: COLOR.vendor, background: COLOR.vendorBg }}
                >
                  🏭 Vendor : {product.VendorName}
                </span>
              )}
            </div>
          </div>
          <button
            className="pds-close-btn"
            onClick={onClose}
            style={{ color: COLOR.textMd }}
          >
            ✕
          </button>
        </div>

        {/* Scroll Area */}
        <div className="pds-scroll-area">

          {/* Image */}
          {imageLoading && (
            <div
              className="pds-image-placeholder"
              style={{ background: COLOR.bg, color: COLOR.textLt }}
            >
              Memuat gambar...
            </div>
          )}
          {!imageLoading && imageUrl && (
            <div className="pds-image-container" style={{ background: COLOR.bg }}>
              <img src={imageUrl} alt={product.Name} />
            </div>
          )}

          {/* Description */}
          {product.Description && (
            <div
              className="pds-description"
              style={{ color: COLOR.textMd, background: COLOR.bg }}
            >
              {product.Description}
            </div>
          )}

          {/* Stock Loading */}
          {stockLoading && (
            <div className="pds-stock-loading" style={{ color: COLOR.textLt }}>
              Memuat ketersediaan stok...
            </div>
          )}

          {/* Stock Box */}
          {!stockLoading && stock && (
            <div
              className="pds-stock-box"
              style={{ border: `1px solid ${COLOR.border}` }}
            >
              <div
                className="pds-stock-header"
                style={{ background: stock.totals.qtyAvailable > 0 ? COLOR.successLt : COLOR.dangerLt }}
              >
                <span className="pds-stock-label" style={{ color: COLOR.textMd }}>
                  📦 Produk tersedia di gudang
                </span>
                <span
                  className="pds-stock-qty"
                  style={{ color: stock.totals.qtyAvailable > 0 ? COLOR.success : COLOR.danger }}
                >
                  {stock.totals.qtyAvailable.toLocaleString('id-ID')} {product.C_UOM_Name || 'EA'}
                </span>
              </div>

              {stock.perLocator.length > 0 && (
                <div className="pds-stock-locators">
                  {stock.perLocator.map(loc => (
                    <div key={loc.locatorId} className="pds-stock-locator-row" style={{ color: COLOR.textMd }}>
                      <span style={{ color: COLOR.textLt }}>{loc.locatorName}</span>
                      <span>
                        {loc.qtyAvailable.toLocaleString('id-ID')} {product.C_UOM_Name || 'EA'}
                        {loc.qtyReserved > 0 && (
                          <span style={{ color: COLOR.textLt }}>
                            {' '}(reserved: {loc.qtyReserved.toLocaleString('id-ID')})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Qty + UoM */}
          <div className="pds-qty-uom-row">
            <div className="pds-qty-col">
              <div className="pds-field-label" style={{ color: COLOR.textMd }}>Jumlah</div>
              <QtyStepper value={qty} onChange={setQty} size="sm" />
            </div>

            <div className="pds-uom-col">
              <div className="pds-field-label" style={{ color: COLOR.textMd }}>Satuan (UoM)</div>
              {hasMultiUom ? (
                <select
                  className="pds-uom-select"
                  value={uom?.C_UOM_ID}
                  onChange={e => {
                    const chosen = product.uomOptions.find(
                      u => String(u.C_UOM_ID) === e.target.value
                    );
                    if (chosen) setUom(chosen);
                  }}
                  style={{
                    color: COLOR.textDk,
                    background: COLOR.bg,
                    borderColor: COLOR.border,
                  }}
                >
                  {product.uomOptions.map(u => (
                    <option key={u.C_UOM_ID} value={String(u.C_UOM_ID)}>{u.Name}</option>
                  ))}
                </select>
              ) : (
                <div
                  className="pds-uom-display"
                  style={{
                    color: COLOR.textDk,
                    background: COLOR.bg,
                    borderColor: COLOR.border,
                  }}
                >
                  {product.C_UOM_Name || 'EA'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="pds-footer"
          style={{ borderTopColor: COLOR.border, background: COLOR.surface }}
        >
          <button
            className="pds-confirm-btn"
            onClick={() => { if (qty > 0) onConfirm(product, qty, uom); }}
            style={{ background: COLOR.primary, borderRadius: RADIUS.md }}
          >
            ➕ {confirmLabel}
          </button>
        </div>

      </div>
    </BottomSheet>
  );
};

export default ProductDetailSheet;
