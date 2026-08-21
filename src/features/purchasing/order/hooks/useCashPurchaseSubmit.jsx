import { useState, useCallback } from 'react';
import { idempiereApi, fkId } from '@/api/idempiereApi';
import { getLoginInfo } from '@/shared/hooks/useLoginInfo';
import { useAPPaymentSubmit } from '@/features/purchasing/order/hooks/useAPPaymentSubmit';
import { waitForDocStatus } from '@/utils/docStatusWaiter';
import { useUomConversion } from '@/shared/hooks/useUomConversion';

// ─────────────────────────────────────────────────────────────────────────────
// useCashPurchaseSubmit.jsx
// Otomasi penuh: PO → Receipt → Invoice → Payment → Allocation, tanpa jeda
// approval manusia — untuk skenario pembelian TUNAI di lokasi (vendor datang
// langsung, barang diterima saat itu juga, dibayar saat itu juga).
//
// PENTING — beda dari POS:
//   - POS: C_Order sisi SALES (IsSOTrx=true), engine iDempiere auto-generate
//     shipment+invoice saat Complete karena C_POS_ID terisi.
//   - Ini: C_Order sisi PURCHASE (IsSOTrx=false) — TIDAK ada auto-generate
//     bawaan, jadi tiap dokumen kita buat & Complete manual secara eksplisit,
//     sambil tetap mengisi field penghubung yang sama seperti kalau proses
//     ini dilakukan manual oleh staff (C_OrderLine_ID, M_InOutLine_ID, dst)
//     — supaya 3-way matching & AP Aging tetap akurat.
//   - TAHAP PAYMENT memakai pola yang SAMA dengan usePOSPaymentSubmit (AR):
//     resolve DocType via DocBaseType, bank account dari pilihan user (fallback
//     auto-resolve), isi C_Invoice_ID di Payment supaya Complete otomatis
//     membuat Allocation. Lihat useAPPaymentSubmit.jsx.
//
// Kalau ada step yang gagal di tengah jalan, proses BERHENTI di situ dan
// mengembalikan info dokumen mana saja yang SUDAH berhasil dibuat — supaya
// tidak ada transaksi "hilang tanpa jejak" dan staff bisa lanjutkan manual
// dari titik yang gagal (lihat bagian error handling di bawah).
//
// ── UOM/PRICE — DISAMAKAN DENGAN usePurchaseOrderSubmit.jsx (versi yang
// SUDAH TERBUKTI BENAR) ────────────────────────────────────────────────────
// Sebelumnya hook ini percaya begitu saja pada `item.selectedUOM.multiplyRate`
// yang nempel di objek cart (kadang undefined/tidak sinkron dengan
// `item.C_UOM_ID` → diam-diam fallback ke rate 1 → qty tidak terkonversi).
// Sekarang konversi di-fetch FRESH dari server tiap submit lewat
// `useUomConversion` (sama seperti hook PO normal):
//   1. `resolveLineUom(item)` cari baris C_UOM_Conversion yang cocok untuk
//      M_Product_ID + C_UOM_ID yang dipilih user (return null kalau item
//      sudah dalam UOM dasar, atau kalau conversion tidak ditemukan).
//   2. `toBaseQty(qtyEntered, selectedUom)` → QtyOrdered (UOM dasar).
//   3. `priceOrdered` DITURUNKAN dari rasio qty (priceEntered × qtyEntered
//      ÷ qtyOrdered) — BUKAN dari multiplyRate terpisah — supaya price dan
//      qty selalu konsisten satu sama lain walau ada pembulatan di
//      C_UOM_Conversion.
// `C_UOM_ID` yang dikirim ke server SELALU `item.C_UOM_ID` (satu sumber),
// bukan field dari objek UOM lain, supaya UOM yang tersimpan selalu sama
// dengan UOM yang dipakai untuk menghitung konversi.
// ─────────────────────────────────────────────────────────────────────────────
export function useCashPurchaseSubmit({ poDocTypeId, receiptDocTypeId, invoiceDocTypeId, description, onError, onStepUpdate }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(null); // 'po' | 'receipt' | 'invoice' | 'payment' | 'allocation'

  const { submitPaymentAllocation } = useAPPaymentSubmit();
  const { fetchUomOptions, toBaseQty } = useUomConversion();

  // Cari objek UOM (untuk toBaseQty) — dipanggil per item saat submit,
  // sama pola dengan resolveSelectedUom di usePurchaseOrderSubmit.jsx.
  //
  // LOGGING: dipertebal sementara untuk debugging kenapa qty tidak
  // terkonversi — hapus/kecilkan lagi kalau sudah confirmed beres.
  const resolveLineUom = useCallback(async (item) => {
    const enteredUomId = parseInt(item.C_UOM_ID);
    const baseUomId = parseInt(item.BaseUOM_ID || item.C_UOM_ID);

    console.log('[UOM-DEBUG] ── item mentah dari cart ──', {
      Name: item.Name,
      M_Product_ID: item.M_Product_ID,
      C_UOM_ID: item.C_UOM_ID,
      BaseUOM_ID: item.BaseUOM_ID,
      selectedUOM: item.selectedUOM, // cek isinya, siapa tau masih ada sisa pemakaian lama
      enteredUomId_parsed: enteredUomId,
      baseUomId_parsed: baseUomId,
    });

    if (!baseUomId) {
      console.warn('[UOM-DEBUG] baseUomId kosong/NaN → item.BaseUOM_ID dan item.C_UOM_ID dua-duanya tidak ada. Konversi dilewati (dianggap tidak perlu).');
      return null;
    }
    if (enteredUomId === baseUomId) {
      console.log('[UOM-DEBUG] enteredUomId === baseUomId → item memang sudah dalam UOM dasar, tidak perlu konversi. Ini NORMAL kalau produk memang selalu dijual dalam UOM dasar.');
      return null;
    }

    console.log(`[UOM-DEBUG] Memanggil fetchUomOptions(M_Product_ID=${item.M_Product_ID}, baseUomId=${baseUomId}, null)...`);
    let options;
    try {
      options = await fetchUomOptions(item.M_Product_ID, baseUomId, null);
    } catch (err) {
      console.error('[UOM-DEBUG] fetchUomOptions MELEMPAR ERROR:', err);
      throw err;
    }
    console.log('[UOM-DEBUG] Hasil fetchUomOptions (daftar C_UOM_Conversion yang ditemukan):', options);

    if (!Array.isArray(options) || options.length === 0) {
      console.warn(
        `[UOM-DEBUG] fetchUomOptions mengembalikan array KOSONG untuk produk #${item.M_Product_ID}. ` +
        `Kemungkinan: (a) tidak ada baris C_UOM_Conversion untuk produk ini sama sekali di iDempiere, ` +
        `atau (b) endpoint/hook useUomConversion mengembalikan struktur data yang beda dari yang diharapkan.`
      );
    }

    const match = options.find(o => o.C_UOM_ID === enteredUomId);
    console.log(`[UOM-DEBUG] Mencari C_UOM_ID === ${enteredUomId} (tipe: ${typeof enteredUomId}) di antara options. Tipe C_UOM_ID di options[0]:`, options[0]?.C_UOM_ID, typeof options[0]?.C_UOM_ID);

    if (!match) {
      console.warn(
        `[UOM-DEBUG] TIDAK ADA MATCH untuk C_UOM_ID=${enteredUomId} di antara ${options.length} opsi yang ditemukan. ` +
        `Opsi yang ada: ${JSON.stringify(options.map(o => o.C_UOM_ID))}. ` +
        `→ Qty TIDAK dikonversi (fallback ke qtyEntered apa adanya) untuk produk #${item.M_Product_ID} — CEK MANUAL.`
      );
      return null;
    }

    console.log('[UOM-DEBUG] MATCH ditemukan:', match);
    return match;
  }, [fetchUomOptions]);

  const submit = useCallback(async (cart, {
    warehouseId,
    locatorId,
    vendorId,
    vendorLocationId,
    vendorName,
    paymentTenderType = 'K', // 'K' = Cash, sesuaikan dengan tender type kamu
    bankAccountId,           // C_BankAccount_ID pilihan user untuk C_Payment (opsional — fallback auto-resolve kalau kosong)
  } = {}) => {
    if (cart.length === 0) {
      onError?.('Keranjang pembelian masih kosong!');
      return null;
    }

    const { orgId, clientId } = getLoginInfo();

    if (!vendorId || !vendorLocationId) {
      onError?.('Vendor belum ditentukan.', 'Data Belum Lengkap');
      return null;
    }
    if (!warehouseId || !locatorId) {
      onError?.('Gudang/lokasi tujuan belum ditentukan.', 'Data Belum Lengkap');
      return null;
    }
    if (!poDocTypeId || !receiptDocTypeId || !invoiceDocTypeId) {
      onError?.('Document Type (PO/Receipt/Invoice) belum ter-resolve.', 'Konfigurasi Tidak Lengkap');
      return null;
    }

    // ── VALIDASI HARGA DI DEPAN ──────────────────────────────────────────
    // Root cause "/ by zero" di server, kemungkinan besar: kode ini tadinya
    // baca item.PriceActual / item.PriceEntered — field yang TIDAK PERNAH ADA
    // di objek cart. Cart Anda (lihat handleConfirmAddToCart di
    // PurchasingContainer.jsx) menyimpan harga di field `Price`. Akibatnya
    // C_OrderLine.PriceActual tersimpan 0 ke iDempiere walau di UI harga
    // sudah diisi — lalu proses matching PO/Receipt/Invoice di server
    // (dipicu karena Invoice line di-link ke C_OrderLine_ID + M_InOutLine_ID)
    // menghitung variance harga dan membagi dengan angka 0 itu. Sekarang
    // dibaca dari `item.Price` (field yang benar-benar ada), dan ditolak di
    // sini SEBELUM PO dibuat kalau memang masih 0, supaya tidak nyangkut
    // dokumen setengah jadi lagi.
    const zeroLinePriceItems = cart.filter(
      item => parseFloat(item.PriceEntered ?? item.Price ?? 0) <= 0
    );
    if (zeroLinePriceItems.length > 0) {
      const names = zeroLinePriceItems.map(i => i.Name || `#${i.M_Product_ID}`).join(', ');
      onError?.(
        `Item berikut belum punya harga (Rp 0) di cart: ${names}.\n` +
        `Isi harga manual dulu di cart (kolom harga per item) sebelum submit Cash Purchase.`,
        'Harga Item Kosong'
      );
      return null;
    }

    setIsSubmitting(true);
    setProgressStep(null);
    // Dilacak via variabel lokal, BUKAN state `progressStep` — closure `submit`
    // di-capture sekali per render, jadi `setProgressStep('x')` di dalam fungsi
    // yang sedang berjalan TIDAK langsung terlihat oleh variabel `progressStep`
    // di closure yang sama (baru kelihatan di render berikutnya). Kalau
    // catch/finally di bawah ini baca state `progressStep`, yang kebaca justru
    // nilai lama dari run sebelumnya (biasanya `null`, sisa reset di finally
    // run sebelumnya) — makanya kemarin errornya keluar sebagai
    // 'Gagal pada tahap "null"' padahal sebenarnya gagal di tahap invoice.
    let currentStep = null;
    const setStep = (step) => { currentStep = step; setProgressStep(step); };
    const created = { poId: null, receiptId: null, invoiceId: null, paymentId: null, invoiceLinesCreated: 0 };

    try {
      const todayISO = new Date().toISOString().split('T')[0];

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 1 — Purchase Order
      // ═══════════════════════════════════════════════════════════════════
      setStep('po');
      onStepUpdate?.('po', 'pending');
      const poRes = await idempiereApi('/models/c_order', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID:  { id: clientId },
          AD_Org_ID:     { id: orgId },
          C_DocType_ID:  { id: poDocTypeId },
          C_DocTypeTarget_ID: { id: poDocTypeId },
          C_BPartner_ID: { id: parseInt(vendorId) },
          C_BPartner_Location_ID: { id: parseInt(vendorLocationId) },
          M_Warehouse_ID: { id: parseInt(warehouseId) },
          DateOrdered:   todayISO,
          DatePromised:  todayISO,
          IsSOTrx:       false,
          PaymentRule:   'P', // Immediate Payment
          Description:   description,
        }),
      });
      const poId = fkId(poRes.id) ?? poRes.id ?? poRes.C_Order_ID;
      if (!poId) throw new Error('Gagal mendapatkan C_Order_ID (PO).');
      created.poId = poId;

      const poLineIds = [];
      for (const item of cart) {
        const qtyEntered   = parseFloat(item.Qty ?? item.QtyEntered ?? 1);
        // Fallback ke `item.Price` tetap dipertahankan (itu yang bikin Cash
        // Purchase kepakai harganya kemarin) untuk jaga-jaga kalau item tidak
        // punya `PriceEntered`.
        const priceEntered = parseFloat(item.PriceEntered ?? item.Price ?? 0);

        // Konversi UOM di-fetch FRESH dari server (C_UOM_Conversion), sama
        // pola dengan usePurchaseOrderSubmit.jsx — bukan baca field mentah
        // dari cart yang bisa tidak sinkron.
        const selectedUom = await resolveLineUom(item);
        const qtyOrdered   = toBaseQty(qtyEntered, selectedUom);
        // Price DITURUNKAN dari rasio qty (bukan dikali multiplyRate
        // terpisah) supaya price & qty selalu konsisten satu sama lain.
        const priceOrdered = qtyOrdered > 0 ? (priceEntered * qtyEntered) / qtyOrdered : priceEntered;

        console.log('[UOM-DEBUG] ── hasil akhir per line ──', {
          Name: item.Name,
          qtyEntered,
          selectedUom,
          qtyOrdered,
          priceEntered,
          priceOrdered,
          '⚠️ qtyOrdered === qtyEntered?': qtyOrdered === qtyEntered
            ? 'YA — kalau UOM seharusnya beda dari base, ini tandanya konversi TIDAK jalan'
            : 'tidak (beda, berarti konversi jalan)',
        });

        const orderLinePayload = {
          AD_Org_ID:    { id: orgId },
          C_Order_ID:   { id: poId },
          M_Product_ID: { id: parseInt(item.M_Product_ID) },
          C_UOM_ID:     { id: parseInt(item.C_UOM_ID) }, // satu sumber, konsisten dgn resolveLineUom
          QtyEntered:   qtyEntered,
          QtyOrdered:   qtyOrdered,
          PriceActual:  priceOrdered,
          PriceEntered: priceEntered,
        };
        console.log('[UOM-DEBUG] Payload POST /models/c_orderline:', orderLinePayload);

        const lineRes = await idempiereApi('/models/c_orderline', {
          method: 'POST',
          body: JSON.stringify(orderLinePayload),
        });
        console.log('[UOM-DEBUG] Response c_orderline (cek QtyOrdered/PriceActual yang benar-benar TERSIMPAN di server):', lineRes);
        poLineIds.push({
          orderLineId: fkId(lineRes.id) ?? lineRes.id,
          productId:   item.M_Product_ID,
          uom: { C_UOM_ID: item.C_UOM_ID }, // dipakai lagi di Receipt/Invoice line di bawah
          // Disimpan LENGKAP (entered & ordered/base) supaya Receipt & Invoice
          // di bawah tinggal PAKAI, bukan hitung ulang dengan rumus berbeda
          // (sumber ketidaksinkronan sebelumnya).
          qtyEntered,
          qtyOrdered,
          priceEntered,
          priceOrdered,
        });
      }

      await idempiereApi(`/models/c_order/${poId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });
      const poStatus = await waitForDocStatus('c_order', poId);
      if (!poStatus.success) throw new Error(`PO gagal Complete (status: ${poStatus.status})`);
      onStepUpdate?.('po', 'success', { id: poId, documentNo: poStatus.documentNo });
      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 2 — Material Receipt (link ke C_OrderLine_ID per baris)
      // ═══════════════════════════════════════════════════════════════════
      setStep('receipt');
      onStepUpdate?.('receipt', 'pending');
      const receiptRes = await idempiereApi('/models/m_inout', {
        method: 'POST',
        body: JSON.stringify({
          AD_Client_ID: { id: clientId },
          AD_Org_ID:    { id: orgId },
          C_DocType_ID: { id: receiptDocTypeId },
          C_Order_ID:   { id: poId }, // 1 PO = 1 Receipt di alur tunai ini
          C_BPartner_ID: { id: parseInt(vendorId) },
          C_BPartner_Location_ID: { id: parseInt(vendorLocationId) },
          M_Warehouse_ID: { id: parseInt(warehouseId) },
          MovementDate: todayISO,
          IsSOTrx:      false,
          Description:  description,
        }),
      });
      const receiptId = fkId(receiptRes.id) ?? receiptRes.id ?? receiptRes.M_InOut_ID;
      if (!receiptId) throw new Error('Gagal mendapatkan M_InOut_ID (Receipt).');
      created.receiptId = receiptId;

      const inOutLineIds = [];
      for (const line of poLineIds) {
        const lineRes = await idempiereApi('/models/m_inoutline', {
          method: 'POST',
          body: JSON.stringify({
            AD_Org_ID:      { id: orgId },
            M_InOut_ID:     { id: receiptId },
            M_Product_ID:   { id: parseInt(line.productId) },
            M_Locator_ID:   { id: parseInt(locatorId) },
            C_UOM_ID:       { id: parseInt(line.uom.C_UOM_ID) },
            QtyEntered:     line.qtyEntered,
            MovementQty:    line.qtyOrdered, // pakai hasil TAHAP 1, jangan hitung ulang dgn rumus berbeda
            C_OrderLine_ID: { id: line.orderLineId }, // ← kunci 3-way matching
          }),
        });
        inOutLineIds.push({
          inOutLineId: fkId(lineRes.id) ?? lineRes.id,
          orderLineId: line.orderLineId,
        });
      }

      await idempiereApi(`/models/m_inout/${receiptId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });
      const receiptStatus = await waitForDocStatus('m_inout', receiptId);
      if (!receiptStatus.success) throw new Error(`Receipt gagal Complete (status: ${receiptStatus.status})`);
      onStepUpdate?.('receipt', 'success', { id: receiptId, documentNo: receiptStatus.documentNo });

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 3 — Vendor Invoice (link ke C_OrderLine_ID + M_InOutLine_ID)
      // ═══════════════════════════════════════════════════════════════════
      setStep('invoice');
      onStepUpdate?.('invoice', 'pending');

      const invoicePayload = {
        AD_Client_ID: { id: clientId },
        AD_Org_ID:    { id: orgId },
        C_DocType_ID: { id: invoiceDocTypeId },
        C_DocTypeTarget_ID: { id: invoiceDocTypeId },
        C_Order_ID:   { id: poId },
        C_BPartner_ID: { id: parseInt(vendorId) },
        C_BPartner_Location_ID: { id: parseInt(vendorLocationId) },
        DateInvoiced: todayISO,
        IsSOTrx:      false,
        PaymentRule:  'P',
        Description:  description,
      };
      console.log('[CashPurchase] POST /models/c_invoice — payload:', invoicePayload);

      let invoiceRes;
      try {
        invoiceRes = await idempiereApi('/models/c_invoice', {
          method: 'POST',
          body: JSON.stringify(invoicePayload),
        });
        console.log('[CashPurchase] POST /models/c_invoice — response:', invoiceRes);
      } catch (err) {
        console.error('[CashPurchase] POST /models/c_invoice — GAGAL. Payload:', invoicePayload);
        console.error('[CashPurchase] Error object lengkap:', err);
        console.error('[CashPurchase] Error.message:', err?.message);
        console.error('[CashPurchase] Error.response:', err?.response);
        console.error('[CashPurchase] Error.body / Error.data:', err?.body ?? err?.data);
        throw err;
      }

      const invoiceId = fkId(invoiceRes.id) ?? invoiceRes.id ?? invoiceRes.C_Invoice_ID;
      if (!invoiceId) throw new Error('Gagal mendapatkan C_Invoice_ID.');
      created.invoiceId = invoiceId;

      for (const [idx, line] of poLineIds.entries()) {
        const matchedInOutLine = inOutLineIds.find(io => io.orderLineId === line.orderLineId);
        const invoiceLinePayload = {
          AD_Org_ID:      { id: orgId },
          C_Invoice_ID:   { id: invoiceId },
          M_Product_ID:   { id: parseInt(line.productId) },
          C_UOM_ID:       { id: parseInt(line.uom.C_UOM_ID) },
          QtyEntered:     line.qtyEntered, // FIX: sebelumnya tidak dikirim sama sekali → LineNetAmt/GrandTotal kosong
          QtyInvoiced:    line.qtyOrdered, // FIX: harus qty di UOM DASAR (= hasil toBaseQty), bukan qty entered
          PriceActual:    line.priceOrdered,
          PriceEntered:   line.priceEntered,
          C_OrderLine_ID: { id: line.orderLineId },
          ...(matchedInOutLine ? { M_InOutLine_ID: { id: matchedInOutLine.inOutLineId } } : {}),
        };
        console.log(`[CashPurchase] POST /models/c_invoiceline — baris ${idx + 1}/${poLineIds.length}, payload:`, invoiceLinePayload);
        console.log('[CashPurchase]   ↳ raw line source (dari cart/PO):', line);
        console.log('[CashPurchase]   ↳ matchedInOutLine:', matchedInOutLine);

        try {
          const lineRes = await idempiereApi('/models/c_invoiceline', {
            method: 'POST',
            body: JSON.stringify(invoiceLinePayload),
          });
          console.log(`[CashPurchase] POST /models/c_invoiceline — baris ${idx + 1} SUKSES, response:`, lineRes);
        } catch (err) {
          console.error(`[CashPurchase] POST /models/c_invoiceline — baris ${idx + 1} GAGAL. Payload:`, invoiceLinePayload);
          console.error('[CashPurchase] Error object lengkap:', err);
          console.error('[CashPurchase] Error.message:', err?.message);
          console.error('[CashPurchase] Error.response:', err?.response);
          console.error('[CashPurchase] Error.body / Error.data:', err?.body ?? err?.data);
          // Kalau idempiereApi menyimpan Response object mentah, coba baca teks-nya juga.
          if (err?.response?.text) {
            try { console.error('[CashPurchase] Error.response.text():', await err.response.text()); } catch { /* no-op */ }
          }
          throw err;
        }
        created.invoiceLinesCreated++; // supaya kalau gagal di baris ke-N, doneList di catch tahu berapa yang sempat masuk
      }

      const completedInvoice = await idempiereApi(`/models/c_invoice/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify({ 'doc-action': 'CO' }),
      });

      const invoiceGrandTotal = parseFloat(completedInvoice.GrandTotal ?? 0);
      if (!invoiceGrandTotal) {
        console.warn('GrandTotal invoice tidak terbaca dari response Complete — payment mungkin perlu jumlah manual.');
      }

      onStepUpdate?.('invoice', 'success', { id: invoiceId, documentNo: completedInvoice.DocumentNo });

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 4 — Payment (pola sama dengan usePOSPaymentSubmit / AR)
      // ═══════════════════════════════════════════════════════════════════
      setStep('payment');
      onStepUpdate?.('payment', 'pending');
      const paymentResult = await submitPaymentAllocation(
        [{ invoiceId, grandTotal: invoiceGrandTotal }],
        { vendorId, bankAccountId, paymentTenderType }
      );
      if (!paymentResult || !paymentResult.paymentId) {
        throw new Error('Payment/Allocation gagal — lihat detail error sebelumnya.');
      }
      created.paymentId = paymentResult.paymentId;
      onStepUpdate?.('payment', 'success', { id: paymentResult.paymentId, documentNo: paymentResult.documentNo });

      // ═══════════════════════════════════════════════════════════════════
      // TAHAP 5 — Allocation (bukan request terpisah — sudah otomatis terjadi
      // saat Payment di-CO karena C_Invoice_ID diisi. Di sini kita cuma
      // memverifikasi, bukan membuat, supaya baris "Allocation" di progress
      // modal tidak berbohong kalau ternyata gagal auto-allocate).
      // ═══════════════════════════════════════════════════════════════════
      if (paymentResult.allocated) {
        onStepUpdate?.('allocation', 'success', { documentNo: paymentResult.documentNo });
      } else {
        onStepUpdate?.('allocation', 'error', {
          message: 'Payment sudah Complete tapi Allocation belum terverifikasi. Cek manual di window "Payment Allocation".',
        });
      }
      // ═══════════════════════════════════════════════════════════════════

      return {
        poId,
        receiptId,
        invoiceId,
        paymentId: created.paymentId, // FIX: sebelumnya `paymentId` bare — tidak pernah dideklarasikan, ReferenceError
        grandTotal: invoiceGrandTotal,
        vendorName: vendorName || `#${vendorId}`,
        date: new Date().toLocaleString('id-ID'),
        items: [...cart],
      };

    } catch (err) {
      // Jangan biarkan user mengira SEMUA gagal — kasih tahu step mana yang
      // sukses, supaya bisa dilanjutkan manual dari titik itu di iDempiere.
      const doneList = Object.entries(created)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      onError?.(
        `Gagal pada tahap "${currentStep}": ${err.message}` +
        (doneList ? `\n\nDokumen yang SUDAH berhasil dibuat (perlu ditindaklanjuti manual):\n${doneList}` : ''),
        'Proses Terhenti'
      );
      onStepUpdate?.(currentStep, 'error', { message: err.message });
      return null;
    } finally {
      setIsSubmitting(false);
      setProgressStep(null);
    }
  }, [poDocTypeId, receiptDocTypeId, invoiceDocTypeId, description, onError, onStepUpdate, submitPaymentAllocation, resolveLineUom, toBaseQty]);

  return { submit, isSubmitting, progressStep };
}
