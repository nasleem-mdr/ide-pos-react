import React, { useState, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import QtyStepper from '../common/QtyStepper';
import { COLOR, RADIUS } from '../../utils/styleTokens';
import { getProductImageBlobUrl, getProductAvailability } from '../../utils/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailSheet.jsx
// Layout diubah agar tombol "Tambah ke Keranjang" SELALU terlihat tanpa
// scroll — area konten (gambar, deskripsi, vendor, UoM/qty) dipisah jadi
// scroll container sendiri dengan maxHeight, sementara footer tombol berada
// DI LUAR area scroll itu, jadi posisinya tetap (sticky) di bagian bawah
// modal apa pun panjang kontennya.
//
// Penataan info juga dipadatkan:
//   - Value & Vendor sejajar dalam satu baris (Value di kiri, Vendor di kanan)
//   - Jumlah (qty) & UoM sejajar dalam satu baris (UoM di kiri, qty di kanan)
// ─────────────────────────────────────────────────────────────────────────────
const ProductDetailSheet = ({ isOpen, product, onClose, onConfirm, confirmLabel = 'Tambah ke Keranjang' }) => {
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

  // Fetch gambar dari attachment setiap kali produk yang dipilih berubah.
  // Object URL lama di-revoke sebelum diganti/saat unmount, supaya tidak
  // menumpuk memory leak setiap kali user buka-tutup detail produk.
  useEffect(() => {
    let currentUrl = null;
    let cancelled = false;

    if (isOpen && product?.M_Product_ID) {
      setImageLoading(true);
      setImageUrl(null);
      getProductImageBlobUrl(product.M_Product_ID)
        .then(url => {
          if (cancelled) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
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

  // Fetch ketersediaan stok (M_Storage) setiap kali produk berubah — sama
  // seperti gambar, dilakukan on-demand saat detail dibuka, bukan di grid.
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
      {/* Wrapper kolom: area scroll konten + footer tombol terpisah,
          supaya footer tidak ikut ter-scroll bersama konten. */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '90dvh' }}>

        {/* Header — tetap di luar area scroll juga, supaya nama produk selalu terlihat */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '12px 18px 10px', flexShrink: 0,
        }}>
          <div style={{ flex: 1, marginRight: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: '17px', color: COLOR.textDk, lineHeight: 1.35 }}>
              {product.Name}
            </div>
            {/* Value & Vendor sejajar dalam satu baris */}
            <div style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap',
              gap: '8px', marginTop: '4px',
            }}>
              <span style={{ fontSize: '12px', color: COLOR.textLt, letterSpacing: '0.03em' }}>
                {product.Value}
              </span>
              {product.VendorName && (
                <span style={{
                  fontSize: '11px', color: COLOR.vendor, background: COLOR.vendorBg,
                  borderRadius: RADIUS.sm, padding: '2px 8px',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px',
                }}>
                  🏭 Vendor : {product.VendorName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLOR.textMd, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
            }}
          >✕</button>
        </div>

        {/* Area scroll: gambar, deskripsi, UoM+qty. Footer tombol TIDAK ikut di sini. */}
        <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '0 18px 14px', flex: '1 1 auto', minHeight: 0, width: '100%', boxSizing: 'border-box' }}>

          {/* Image */}
          {imageLoading && (
            <div style={{
              width: '100%', height: '160px', borderRadius: RADIUS.md,
              marginBottom: '12px', background: COLOR.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLOR.textLt, fontSize: '12px',
            }}>
              Memuat gambar...
            </div>
          )}
          {!imageLoading && imageUrl && (
            <div style={{
              width: '100%', height: '160px', borderRadius: RADIUS.md,
              overflow: 'hidden', marginBottom: '12px', background: COLOR.bg,
            }}>
              <img
                src={imageUrl}
                alt={product.Name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          {/* Description */}
          {product.Description && (
            <div style={{
              fontSize: '13px', color: COLOR.textMd, lineHeight: 1.6,
              marginBottom: '12px', background: COLOR.bg,
              borderRadius: RADIUS.sm, padding: '10px 12px',
            }}>
              {product.Description}
            </div>
          )}

          {/* Stock Availability — total + breakdown per locator/gudang */}
          {stockLoading && (
            <div style={{ fontSize: '12px', color: COLOR.textLt, marginBottom: '12px' }}>
              Memuat ketersediaan stok...
            </div>
          )}
          {!stockLoading && stock && (
            <div style={{
              marginBottom: '12px', border: `1px solid ${COLOR.border}`,
              borderRadius: RADIUS.sm, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: stock.totals.qtyAvailable > 0 ? COLOR.successLt : COLOR.dangerLt,
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: COLOR.textMd }}>
                  📦 Produk tersedia di gudang
                </span>
                <span style={{
                  fontSize: '15px', fontWeight: 700,
                  color: stock.totals.qtyAvailable > 0 ? COLOR.success : COLOR.danger,
                }}>
                  {stock.totals.qtyAvailable.toLocaleString('id-ID')} {product.C_UOM_Name || 'EA'}
                </span>
              </div>

              {stock.perLocator.length > 0 && (
                <div style={{ padding: '6px 12px' }}>
                  {stock.perLocator.map(loc => (
                    <div
                      key={loc.locatorId}
                      style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: '12px', padding: '4px 0', color: COLOR.textMd,
                      }}
                    >
                      <span style={{ color: COLOR.textLt }}>{loc.locatorName}</span>
                      <span>
                        {loc.qtyAvailable.toLocaleString('id-ID')} {product.C_UOM_Name || 'EA'}
                        {loc.qtyReserved > 0 && (
                          <span style={{ color: COLOR.textLt }}> (reserved: {loc.qtyReserved.toLocaleString('id-ID')})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Jumlah & UoM sejajar dalam satu baris — Jumlah duluan (kiri), UoM mengikuti (kanan) */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: COLOR.textMd, marginBottom: '6px' }}>
                Jumlah
              </div>
              <QtyStepper value={qty} onChange={setQty} size="sm" />
            </div>

            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: COLOR.textMd, marginBottom: '6px' }}>
                Satuan (UoM)
              </div>
              {hasMultiUom ? (
                <select
                  value={uom?.C_UOM_ID}
                  onChange={e => {
                    const chosen = product.uomOptions.find(u => String(u.C_UOM_ID) === e.target.value);
                    if (chosen) setUom(chosen);
                  }}
                  style={{
                    width: '100%', boxSizing: 'border-box', fontSize: '14px',
                    color: COLOR.textDk, background: COLOR.bg,
                    border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.md,
                    padding: '10px 8px', outline: 'none',
                  }}
                >
                  {product.uomOptions.map(u => (
                    <option key={u.C_UOM_ID} value={String(u.C_UOM_ID)}>{u.Name}</option>
                  ))}
                </select>
              ) : (
                <div style={{
                  fontSize: '14px', color: COLOR.textDk, background: COLOR.bg,
                  border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.md,
                  padding: '10px 8px', textAlign: 'center', boxSizing: 'border-box',
                }}>
                  {product.C_UOM_Name || 'EA'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer: tombol konfirmasi — di LUAR area scroll, selalu terlihat */}
        <div style={{
          flexShrink: 0, padding: '12px 18px max(12px, env(safe-area-inset-bottom))',
          borderTop: `1px solid ${COLOR.border}`, background: COLOR.surface,
        }}>
          <button
            onClick={() => { if (qty > 0) onConfirm(product, qty, uom); }}
            style={{
              background: COLOR.primary, color: '#fff', border: 'none',
              padding: '14px', width: '100%', borderRadius: RADIUS.md,
              fontWeight: 700, fontSize: '15px', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ➕ {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default ProductDetailSheet;
