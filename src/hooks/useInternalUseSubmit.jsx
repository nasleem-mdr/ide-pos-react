import { useState, useCallback } from 'react';
import { idempiereApi } from '../utils/idempiereApi';
import { getLoginInfo } from './useLoginInfo';

// ─────────────────────────────────────────────────────────────────────────────
// useInternalUseSubmit.jsx
// Window iDempiere "Inventory Decrease/Increase" → tabel M_Inventory /
// M_InventoryLine. Untuk kasus Internal Use (bukan physical count penuh),
// field yang relevan di tiap line:
//   • QtyBook   — qty sistem saat ini (informatif, hasil resolve stok, UOM DASAR)
//   • QtyCount  — disamakan dengan QtyBook (TIDAK ada selisih/variance,
//                 karena ini bukan stock opname, cuma pengambilan langsung)
//   • QtyInternalUse — qty yang benar-benar diambil, UOM DASAR
//   • C_Charge_ID    — MANDATORY, akun/alasan pemakaian (di-suggest dari
//                       M_Product.C_Charge_ID kalau ada)
//
// ⚠️ M_InventoryLine TIDAK punya kolom C_UOM_ID (dikonfirmasi dari struktur
// tabel) — SEMUA field qty di atas WAJIB dalam UOM dasar produk. Kalau user
// entry qty dalam UOM lain (mis. "Dus" via UomSelector di cart), konversi ke
// UOM dasar dilakukan di frontend sebelum submit — lihat useUomConversion.jsx
// dan perhitungan qtyBase di bawah.
//
// ⚠️ M_InventoryLine dipakai bersama oleh 2 jenis dokumen: Physical
// Inventory (MMI>PI) dan Internal Use (MMO>IU). Untuk Physical Inventory,
// QtyBook (stok sistem) dan QtyCount (hasil hitung fisik) memang harus
// diisi nilai riil karena itu intinya stock opname (selisihnya jadi
// variance). TAPI untuk Internal Use, iDempiere HANYA memproses
// QtyInternalUse — QtyBook dan QtyCount cukup diisi 0 (bukan resolve stok
// sistem), karena bukan proses opname dan tidak menghasilkan variance.
// Jangan resolve/fetch QtyOnHand untuk transaksi ini — cukup hardcode 0.
//
// ⚠️ MULTI-WAREHOUSE (baru): 1 dokumen M_Inventory (header) cuma boleh punya
// 1 M_Warehouse_ID, dan M_Locator_ID tiap line HARUS berada di dalam
// warehouse header itu. Karena user sekarang bisa pilih gudang berbeda per
// item di cart (lihat InternalUseCartItem → onWarehouseChange), submit()
// di sini MENGELOMPOKKAN cart per item.M_Warehouse_ID dan membuat SATU
// dokumen M_Inventory terpisah untuk tiap kelompok gudang.
//
// Partial success: kalau salah satu kelompok gagal (mis. error validasi di
// tengah proses Complete), kelompok gudang lain yang SUDAH berhasil
// Complete TETAP dianggap sukses — proses tidak dihentikan di tengah jalan.
// Item pada kelompok yang gagal dikembalikan lewat field `failed` supaya
// Container bisa membiarkannya tetap di cart untuk di-retry, alih-alih
// menghapus semuanya begitu saja.
// ─────────────────────────────────────────────────────────────────────────────
export function useInternalUseSubmit({ docTypeId, description, onError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (cart, { warehouseId: fallbackWarehouseId } = {}) => {
    if (cart.length === 0) {
      onError?.('Daftar pengambilan barang masih kosong!');
      return null;
    }

    const missingCharge = cart.filter(i => !i.C_Charge_ID);
    if (missingCharge.length > 0) {
      onError?.(
        `${missingCharge.length} produk belum ditentukan Charge (alasan pemakaian):\n` +
        missingCharge.map(i => `• ${i.Name}`).join('\n'),
        'Charge Belum Lengkap'
      );
      return null;
    }

    const missingLocator = cart.filter(i => !i.M_Locator_ID);
    if (missingLocator.length > 0) {
      onError?.(
        `${missingLocator.length} produk tidak punya lokasi stok yang valid:\n` +
        missingLocator.map(i => `• ${i.Name}`).join('\n'),
        'Lokasi Stok Tidak Ditemukan'
      );
      return null;
    }

    // fallbackWarehouseId (gudang default sesi login) dipakai HANYA kalau
    // ada item yang entah kenapa belum punya M_Warehouse_ID sendiri (mis.
    // cart lama sebelum fitur pilih-gudang-per-item ada). Item yang
    // ditambahkan lewat alur baru selalu bawa M_Warehouse_ID masing-masing.
    const missingWarehouse = cart.filter(i => !i.M_Warehouse_ID && !fallbackWarehouseId);
    if (missingWarehouse.length > 0) {
      onError?.(
        `${missingWarehouse.length} produk belum punya gudang sumber stok:\n` +
        missingWarehouse.map(i => `• ${i.Name}`).join('\n'),
        'Gudang Belum Ditentukan'
      );
      return null;
    }

    if (!docTypeId) {
      onError?.('Document Type belum siap. Muat ulang halaman.', 'Error');
      return null;
    }

    const { orgId, clientId } = getLoginInfo();
    if (!orgId || !clientId) {
      onError?.('Data sesi tidak lengkap.\nSilakan login kembali.', 'Error');
      return null;
    }

    // ── Kelompokkan cart per M_Warehouse_ID ───────────────────────────
    const groups = new Map(); // warehouseId -> { warehouseId, warehouseName, items: [] }
    for (const item of cart) {
      const whId = item.M_Warehouse_ID ?? fallbackWarehouseId;
      if (!groups.has(whId)) {
        groups.set(whId, { warehouseId: whId, warehouseName: item.WarehouseName, items: [] });
      }
      groups.get(whId).items.push(item);
    }

    setIsSubmitting(true);
    const todayISO = new Date().toISOString().split('T')[0];
    const documents = [];
    const failed = [];

    for (const group of groups.values()) {
      try {
        // ── 1. Header M_Inventory ────────────────────────────────────
        const headerRes = await idempiereApi('/models/m_inventory', {
          method: 'POST',
          body: JSON.stringify({
            AD_Client_ID:   { id: clientId },
            AD_Org_ID:      { id: orgId },
            C_DocType_ID:   { id: docTypeId },
            M_Warehouse_ID: { id: parseInt(group.warehouseId) },
            MovementDate:   todayISO,
            Description:    description,
            IsActive:       true,
          }),
        });
        const inventoryId = headerRes.id ?? headerRes.M_Inventory_ID;
        if (!inventoryId) throw new Error('Gagal mendapatkan M_Inventory_ID dari server.');

        // ── 2. Lines M_InventoryLine ───────────────────────────────
        // ⚠️ M_InventoryLine TIDAK punya kolom C_UOM_ID — field qty di
        // tabel ini SELALU dalam UOM DASAR produk. Konversi dari UOM entry
        // (mis. "Dus") ke UOM dasar dilakukan DI SINI, pakai multiplyRate
        // dari C_UOM_Conversion (lihat useUomConversion.jsx).
        //
        // QtyBook/QtyCount di-hardcode 0 — untuk Internal Use iDempiere
        // tidak memakai nilai ini untuk apa pun (tidak dihitung sebagai
        // variance, tidak memengaruhi hasil Complete). Yang benar-benar
        // diproses cuma QtyInternalUse. Field NOT NULL di tabel terpenuhi
        // dengan angka 0 eksplisit, bukan hasil resolve stok yang tidak
        // perlu (dan sebelumnya jadi sumber kebingungan).
        for (const item of group.items) {
          const qtyBase = parseFloat(item.Qty || 0) * (item.selectedUom?.multiplyRate ?? 1);
          await idempiereApi('/models/m_inventoryline', {
            method: 'POST',
            body: JSON.stringify({
              AD_Org_ID:        { id: orgId },
              M_Inventory_ID:   { id: inventoryId },
              M_Product_ID:     { id: parseInt(item.M_Product_ID) },
              M_Locator_ID:     { id: parseInt(item.M_Locator_ID) },
              QtyBook:          0,
              QtyCount:         0,
              QtyInternalUse:   qtyBase,
              C_Charge_ID:      { id: parseInt(item.C_Charge_ID) },
            }),
          });
        }

        // ── 3. Complete dokumen ─────────────────────────────────────
        const completedRes = await idempiereApi(`/models/m_inventory/${inventoryId}`, {
          method: 'PUT',
          body: JSON.stringify({ 'doc-action': 'CO' }),
        });

        documents.push({
          documentNo:    completedRes.DocumentNo || `IU-${inventoryId}`,
          warehouseId:   group.warehouseId,
          warehouseName: group.warehouseName,
          date:          new Date().toLocaleString('id-ID'),
          items:         group.items,
        });
      } catch (err) {
        // Kelompok gudang ini gagal — LANJUT ke kelompok berikutnya,
        // jangan hentikan seluruh proses (partial success, bukan
        // all-or-nothing), supaya dokumen yang sudah ter-Complete di
        // kelompok lain tidak "hilang" dari sisi user.
        failed.push({
          warehouseId:   group.warehouseId,
          warehouseName: group.warehouseName,
          items:         group.items,
          error:         err.message,
        });
      }
    }

    setIsSubmitting(false);

    if (documents.length === 0) {
      // Semua kelompok gagal.
      onError?.(
        'Gagal membuat dokumen Internal Use:\n\n' +
        failed.map(f => `• Gudang ${f.warehouseName || f.warehouseId}: ${f.error}`).join('\n'),
        'Error'
      );
      return null;
    }

    if (failed.length > 0) {
      onError?.(
        `${failed.length} dari ${groups.size} dokumen gagal dibuat, sisanya berhasil:\n\n` +
        failed.map(f =>
          `• Gudang ${f.warehouseName || f.warehouseId}: ${f.error}\n  Produk: ${f.items.map(i => i.Name).join(', ')}`
        ).join('\n\n') +
        '\n\nProduk yang gagal tetap ada di daftar pengambilan untuk dicoba lagi.',
        'Sebagian Dokumen Gagal'
      );
    }

    return { documents, failed };
  }, [docTypeId, description, onError]);

  return { submit, isSubmitting };
}
