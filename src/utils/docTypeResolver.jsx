import { idempiereApi } from './idempiereApi';
import { getLoginInfo } from '../hooks/useLoginInfo';

// ─────────────────────────────────────────────────────────────────────────────
// docTypeResolver.jsx
// Menggantikan pola lama "C_DOCTYPE_ID: 1000019 // GANTI sesuai instance Anda"
// yang ada di GoodsReceiptContainer.jsx / PurchasingContainer.jsx (dan
// sebaiknya juga RequisitionContainer.jsx kalau masih hardcode serupa).
//
// MASALAH: C_DocType_ID adalah angka PK yang di-generate per baris data, dan
// selalu di-scope ke AD_Client_ID. Kalau 1 instance iDempiere melayani lebih
// dari 1 Client, angka hardcode dari Client A pasti salah (atau malah nyasar
// ke doc type Client lain) begitu user dari Client B login.
//
// SOLUSI: setiap C_DocType WAJIB punya DocBaseType (nilai standar iDempiere,
// SAMA di semua Client — mis. 'POO' utk Purchase Order, 'MMR' utk Material
// Receipt, 'POR' utk Purchase Requisition, 'MMM' utk Movement). Jadi alih-alih
// hardcode ID, kita cari C_DocType yang DocBaseType-nya cocok DAN
// AD_Client_ID-nya sama dengan client user yang sedang login — resolusinya
// otomatis benar untuk client manapun, sama seperti cara iDempiere sendiri
// menentukan "default doc type" (lihat MDocType.get() di core iDempiere).
//
// Preferensi urutan pemilihan kalau ada beberapa C_DocType yang cocok:
//   1. Yang AD_Org_ID-nya = org user login (override khusus org tsb)
//   2. Yang ditandai IsDefault = true
//   3. Fallback: yang pertama aktif ditemukan
// ─────────────────────────────────────────────────────────────────────────────

// Cache di memori per sesi browser — key: `${clientId}_${docBaseType}_${orgId}`.
// Dibersihkan otomatis saat reload halaman; tidak perlu invalidasi manual
// kecuali Anda ubah konfigurasi Document Type saat aplikasi sedang terbuka.
const _cache = new Map();

/**
 * Resolve C_DocType_ID berdasarkan DocBaseType standar iDempiere.
 *
 * @param {string} docBaseType - mis. 'POO' (Purchase Order), 'MMR' (Material
 *   Receipt/Vendor Receipt), 'POR' (Purchase Requisition), 'MMM' (Movement).
 * @param {{ orgId?: number }} opts - orgId opsional untuk preferensi doc type
 *   khusus org tertentu (kalau organisasi Anda punya doc type berbeda per org).
 * @returns {Promise<number>} C_DocType_ID yang sesuai untuk client user login.
 */
export async function resolveDocTypeId(docBaseType, { orgId = null } = {}) {
  const { clientId } = getLoginInfo();
  if (!clientId) {
    throw new Error('AD_Client_ID tidak ditemukan di sesi login — silakan login kembali.');
  }

  const cacheKey = `${clientId}_${docBaseType}_${orgId ?? 0}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  const res = await idempiereApi(
    `/models/c_doctype?$select=C_DocType_ID,Name,AD_Org_ID,IsDefault` +
    `&$filter=DocBaseType eq '${docBaseType}' and AD_Client_ID eq ${clientId} and IsActive eq true` +
    `&$orderby=IsDefault desc`
  );
  const records = Array.isArray(res.records) ? res.records : [];

  if (records.length === 0) {
    throw new Error(
      `Tidak ditemukan Document Type aktif dengan DocBaseType='${docBaseType}' ` +
      `untuk Client ini (AD_Client_ID=${clientId}).\n` +
      `Buat/aktifkan Document Type-nya dulu di iDempiere: Window "Document Type", ` +
      `set Document Base Type = ${docBaseType} dan centang "Default".`
    );
  }

  const orgSpecific = orgId
    ? records.find(r => (r.AD_Org_ID?.id ?? r.AD_Org_ID) === orgId)
    : null;
  const defaultOne = records.find(r => r.IsDefault);
  const chosen = orgSpecific || defaultOne || records[0];

  const docTypeId = chosen.C_DocType_ID?.id ?? chosen.id ?? chosen.C_DocType_ID;
  _cache.set(cacheKey, docTypeId);
  return docTypeId;
}

// Dipanggil manual kalau Anda perlu paksa refetch (mis. setelah admin
// mengubah konfigurasi Document Type tanpa reload aplikasi).
export function clearDocTypeCache() {
  _cache.clear();
}

// Referensi nilai DocBaseType standar iDempiere yang dipakai di aplikasi ini
// — supaya tidak perlu hardcode string di banyak tempat.
export const DOC_BASE_TYPE = {
  PURCHASE_REQUISITION: 'POR', // FPB — Requisition
  PURCHASE_ORDER:        'POO', // Purchasing
  MATERIAL_RECEIPT:      'MMR', // Goods Receipt (Vendor Receipt)
  MATERIAL_MOVEMENT:     'MMM', // Internal Use (Pengambilan Barang Gudang)
};
