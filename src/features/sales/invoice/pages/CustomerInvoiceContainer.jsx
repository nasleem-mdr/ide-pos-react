import React, { useState, useEffect, useRef, useCallback } from 'react';

import {
  Dialog,
  CartFab
} from '@/shared/components';

import {
  useIsDesktop,
  getLoginInfo,
  getMissingSessionFields,
  useInfiniteScroll
} from '@/shared/hooks';

import {
  POCard,
  POLineDetailSheet,
  POCartSidebar,
  POCartPanel
} from '@/features/purchasing/shared/components';

import { InvoiceSubmitModal } from '@/features/sales/invoice/components';
// TODO: success modal — reuse VendorInvoiceSuccessModal if generic enough,
// otherwise a thin SalesInvoiceSuccessModal copy. Not included here since
// its source wasn't shared yet.
import { VendorInvoiceSuccessModal as SalesInvoiceSuccessModal } from '@/features/purchasing/invoice/components';

import {
  useSalesInvoiceSubmit,
  useSOInvoiceLines,
  useSalesInvoiceCart
} from '@/features/sales/invoice/hooks';

import { COLOR, RADIUS } from '@/utils/styleTokens';
import { resolveDocTypeId, DOC_BASE_TYPE, IS_SO_TRX } from '@/utils/docTypeResolver';
import { ShoppingCartIcon } from '@/shared/components/icon';
import { useAccess } from '@/context/AccessContext';
import '@/css/Header.css';

const INVOICE_CONFIG = { DESCRIPTION: 'Sales Invoice via Web' };

const CustomerInvoiceContainer = () => {
  const isDesktop = useIsDesktop();
  const [cartOpen, setCartOpen] = useState(false);
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '' });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSO, setSelectedSO] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [invoiceDocTypeId, setInvoiceDocTypeId] = useState(null);

  const searchRef = useRef(null);
  const alert = (message, title = 'Perhatian') => setDialog({ isOpen: true, title, message });

  const { cart, addItems, removeItem, updateQty, updatePrice, clearCart, totalItems, totalAmount, customerGroups } = useSalesInvoiceCart();
  const { canEdit } = useAccess();
  const canSubmitInvoice = canEdit('sales'); // ⚠️ SESUAIKAN kalau access key-nya beda

  const { submit: submitInvoice, isSubmitting: invoiceSubmitting } = useSalesInvoiceSubmit({
    invoiceDocTypeId, defaultDescription: INVOICE_CONFIG.DESCRIPTION, onError: alert,
  });

  const {
    sos, loading: sosLoading, fetchSOs,
    search, searchValue,
    hasMore, loadingMore, fetchNextPage,
  } = useSOInvoiceLines();

  const [showFullyInvoiced, setShowFullyInvoiced] = useState(false);
  const outstandingSOs = sos.filter(so => !so.isFullyInvoiced);
  const visibleSOs = showFullyInvoiced ? sos : outstandingSOs;
  const hiddenCount = sos.length - outstandingSOs.length;

  const sentinelRef = useInfiniteScroll({
    fetchMore: fetchNextPage,
    hasMore,
    loading: loadingMore,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const info = getLoginInfo();
        const missing = getMissingSessionFields(info);
        if (missing.length) {
          alert(`Data sesi tidak lengkap:\n${missing.map(k => `• ${k}`).join('\n')}\n\nSilakan login kembali.`, 'Sesi Tidak Valid');
          return;
        }
        try {
          const invDt = await resolveDocTypeId(DOC_BASE_TYPE.AR_INVOICE, { orgId: info.orgId, isSOTrx: IS_SO_TRX.SALES });
          resolveDocTypeId(DOC_BASE_TYPE.PURCHASE_ORDER,   { orgId: info.orgId }),
          setInvoiceDocTypeId(invDt);
        } catch (err) {
          alert(err.message, 'Document Type Tidak Ditemukan');
        }
        await fetchSOs('');
      } catch (err) {
        alert('Gagal inisialisasi: ' + err.message, 'Error');
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSODetail  = useCallback((so) => { setSelectedSO(so); setDetailOpen(true); }, []);
  const closeSODetail = useCallback(() => { setDetailOpen(false); setSelectedSO(null); }, []);
  const handleAddLines  = useCallback((chosenLines) => addItems(chosenLines), [addItems]);
  const handleClearCart = useCallback(() => { clearCart(); setDescription(''); }, [clearCart]);

  const handleModalDraft = async () => {
    setSubmitModalOpen(false);
    const { results, hadError } = await submitInvoice(cart, { description, submitMode: 'draft' });
    if (!results) return;
    setSuccessData(results);
    setSuccessOpen(true);
    if (!hadError) { clearCart(); setDescription(''); fetchSOs(searchValue); }
  };

  const handleModalComplete = async () => {
    setSubmitModalOpen(false);
    const { results, hadError } = await submitInvoice(cart, { description, submitMode: 'complete' });
    if (!results) return;
    setSuccessData(results);
    setSuccessOpen(true);
    if (!hadError) { clearCart(); setDescription(''); fetchSOs(searchValue); }
  };

  // Bayar (AR Receipt + allocation) belum diimplementasikan — invoice dulu.
  // Kalau nanti ditambah: mirror handleModalBayar dari VendorInvoiceContainer,
  // pakai useReceiptAllocationSubmit (AR_RECEIPT), dan pass onBayar + bankAccounts
  // ke InvoiceSubmitModal lagi (section itu sudah otomatis muncul kalau onBayar ada).

  const cartSummaryRight = `🧾 ${totalItems} baris`;

  return (
    <div style={{ flex: 1, minHeight: 0, background: COLOR.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <Dialog isOpen={dialog.isOpen} title={dialog.title} message={dialog.message} onClose={() => setDialog({ isOpen: false, title: '', message: '' })} />

      <POLineDetailSheet isOpen={detailOpen} po={selectedSO} onClose={closeSODetail} onConfirm={handleAddLines} />

      <InvoiceSubmitModal
        isOpen={submitModalOpen} onClose={() => setSubmitModalOpen(false)}
        onDraft={handleModalDraft} onComplete={handleModalComplete}
        title="Submit Sales Invoice"
        isSubmitting={invoiceSubmitting} totalAmount={totalAmount}
      />

      <SalesInvoiceSuccessModal isOpen={successOpen} data={successData} onClose={() => { setSuccessOpen(false); setSuccessData(null); }} />

      <div className='header-purchasing'>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', flex: 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ShoppingCartIcon /><span>Sales Invoice</span>
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          <div style={{ padding: '12px 14px', background: COLOR.surface, borderBottom: `1px solid ${COLOR.border}`, display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>🔍</span>
              <input
                ref={searchRef} type="text" value={searchValue}
                onChange={e => search(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchSOs(searchValue.trim()); } }}
                placeholder="Cari No. SO / nama customer..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 34px', border: `1.5px solid ${COLOR.border}`, borderRadius: RADIUS.md, fontSize: '14px', color: COLOR.textDk, background: COLOR.bg, outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', paddingBottom: (!isDesktop && cart.length > 0) ? '80px' : '14px' }}>
            {sosLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div><p style={{ margin: 0 }}>Memuat SO...</p>
              </div>
            ) : sos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: COLOR.textLt }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🧾</div><p style={{ margin: 0 }}>Tidak ada SO Complete ditemukan.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: COLOR.textMd, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showFullyInvoiced}
                      onChange={e => setShowFullyInvoiced(e.target.checked)}
                    />
                    Tampilkan semua ({hiddenCount > 0 ? `${hiddenCount} SO lunas disembunyikan` : 'tidak ada yang disembunyikan'})
                  </label>
                </div>

                {visibleSOs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: COLOR.textLt }}>
                    {showFullyInvoiced ? 'Tidak ada SO ditemukan.' : 'Tidak ada SO dengan sisa tagihan.'}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(200px, 1fr))' : 'repeat(2, 1fr)', gap: '10px' }}>
                      {visibleSOs.map(so => <POCard key={so.C_Order_ID} po={so} onClick={openSODetail} />)}
                    </div>

                    {hasMore && (
                      <div ref={sentinelRef} style={{ height: '1px' }} />
                    )}

                    {loadingMore && (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: COLOR.textLt, fontSize: '13px' }}>
                        ⏳ Memuat SO lainnya...
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {isDesktop && (
          <POCartSidebar
            isOpen={cartOpen} onClose={() => setCartOpen(false)} title="🧾 Daftar Tagihan (Invoice)"
            vendorGroups={customerGroups} onRemove={removeItem} onQtyChange={updateQty} onPriceChange={updatePrice}
            onClearCart={canSubmitInvoice ? handleClearCart : undefined}
            totalItems={totalItems} totalAmount={totalAmount} summaryRight={cartSummaryRight}
            onSubmit={canSubmitInvoice ? () => setSubmitModalOpen(true) : undefined}
            isSubmitting={invoiceSubmitting}
            description={description} onDescriptionChange={canSubmitInvoice ? setDescription : undefined}
            descriptionPlaceholder={INVOICE_CONFIG.DESCRIPTION}
            partnerIcon="🏢" partnerLabel="customer" docLabel="Invoice"
          />
        )}
      </div>

      {!isDesktop && totalItems > 0 && !cartOpen && (
        <CartFab count={totalItems} label="Daftar Tagihan" icon="🧾" onClick={() => setCartOpen(true)} />
      )}

      {!isDesktop && (
        <POCartPanel
          isOpen={cartOpen} onClose={() => setCartOpen(false)} title="🧾 Daftar Tagihan (Invoice)"
          vendorGroups={customerGroups} onRemove={removeItem} onQtyChange={updateQty} onPriceChange={updatePrice}
          onClearCart={canSubmitInvoice ? handleClearCart : undefined}
          totalItems={totalItems} totalAmount={totalAmount} summaryRight={cartSummaryRight}
          onSubmit={canSubmitInvoice ? () => setSubmitModalOpen(true) : undefined}
          isSubmitting={invoiceSubmitting}
          partnerIcon="🏢" partnerLabel="customer" docLabel="Invoice"
        />
      )}

      {!canSubmitInvoice && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fef3c7', color: '#92400e', fontSize: '12px', padding: '8px 14px', textAlign: 'center', zIndex: 150 }}>
          ⚠ Role Anda hanya memiliki akses lihat (read-only) untuk Sales Invoice.
        </div>
      )}
    </div>
  );
};

export default CustomerInvoiceContainer;
