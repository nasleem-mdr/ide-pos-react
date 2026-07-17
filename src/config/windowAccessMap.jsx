// ─────────────────────────────────────────────────────────────────────────────
// windowAccessMap.js
// Pemetaan "kunci halaman" (dipakai di route & komponen React) ke AD_Window_ID
// iDempiere. Ini satu-satunya tempat yang perlu diisi manual — cek nilai
// AD_Window_ID lewat menu System Admin > Window, atau query:
//   GET /api/v1/models/ad_window?$select=AD_Window_ID,Name&$filter=contains(Name,'Requisition')
//
// Kalau sebuah halaman TIDAK terdaftar di sini, defaultnya dianggap
// "tidak butuh AD_Window_Access" (lihat hasAccess() di AccessContext) —
// jadi pastikan semua halaman yang ingin dibatasi role didaftarkan.
// ─────────────────────────────────────────────────────────────────────────────
export const WINDOW_ACCESS_MAP = {
  dashboard:            null,
  businessPartner:      117,
  businessPartnerEdit:  117,
  pos:                  167,
  salesOrder:           167,
  product:              140,
  requisition:          322,
  goodsReceipt:         184,
  purchasing:           181,
  internalUse:          341,

  // ===== List / Report =====
  requisitionList:      322, 
  purchasingList:       181,
  goodsReceiptList:     184,
  internalUseList:      341,
};

// Helper: ambil AD_Window_ID dari key, atau null kalau tidak terdaftar/tidak dibatasi.
export const getWindowId = (key) => {
  const id = WINDOW_ACCESS_MAP[key];
  return (id === null || id === undefined) ? null : id;
};
