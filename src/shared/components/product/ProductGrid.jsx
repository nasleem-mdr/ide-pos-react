import { useRef } from 'react';
import ProductCard from './ProductCard';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { COLOR } from '@/utils/styleTokens';

/**
 * Grid produk + infinite scroll, dipakai bareng di
 * RequisitionContainer, PurchasingContainer, GoodsReceiptContainer, InternalUseContainer.
 */
export default function ProductGrid({
  products,
  loading,
  loadingMore,
  hasMore,
  fetchMore,
  onProductClick,
  isDesktop,
  selectedWarehouse,
  emptyHint, // opsional: teks custom saat kosong (beda2 per modul)
}) {
  const scrollContainerRef = useRef(null);

  const sentinelRef = useInfiniteScroll({
    fetchMore,
    hasMore,
    loading: loadingMore,
    rootMargin: '400px',
    rootRef: scrollContainerRef,
  });

  return (
    <div
      ref={scrollContainerRef}
      style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
          <p style={{ margin: 0 }}>Memuat produk...</p>
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📦</div>
          <p style={{ margin: 0 }}>Tidak ada produk ditemukan.</p>
          <p style={{ margin: '6px 0 0', fontSize: '12px' }}>
            {emptyHint ??
              (selectedWarehouse
                ? `Pastikan produk memiliki Default Locator di gudang "${selectedWarehouse.name}".`
                : 'Pastikan produk memiliki vendor aktif di M_ProductPO.')}
          </p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '12px', color: COLOR.textLt, marginBottom: '8px' }}>
            {products.length} produk
            {selectedWarehouse ? ` di gudang ${selectedWarehouse.name}` : ''}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isDesktop
                ? 'repeat(auto-fill, minmax(170px, 1fr))'
                : 'repeat(2, 1fr)',
              gap: '10px',
            }}
          >
            {products.map((p, idx) => (
              <ProductCard key={`${p.M_Product_ID}-${idx}`} product={p} onClick={onProductClick} />
            ))}
          </div>

          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '12px', color: COLOR.textLt, fontSize: '13px' }}>
              Memuat lagi...
            </div>
          )}

          {!hasMore && (
            <div style={{ textAlign: 'center', padding: '12px', color: '#c1c1c1', fontSize: '12px' }}>
              — Semua produk sudah dimuat —
            </div>
          )}
        </>
      )}
    </div>
  );
}