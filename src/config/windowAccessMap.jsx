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
  dashboard:            null,   // null = selalu boleh diakses (tidak dicek ke AD_Window_Access)
  businessPartner:      117,    // contoh AD_Window_ID untuk window Business Partner (ganti sesuai instance Anda)
  businessPartnerEdit:  117,    // window sama dengan list, tapi action 'edit' yang dicek readwrite-nya
  pos:                  167,
  salesOrder:           167,    // contoh: Sales Order standar iDempiere
  product:              null,
  requisition:          null, // contoh: window Purchase Requisition custom Anda
  goodsReceipt:         null,
  purchasing:           null,
  internalUse:          null,
};

// Helper: ambil AD_Window_ID dari key, atau null kalau tidak terdaftar/tidak dibatasi.
export const getWindowId = (key) => {
  const id = WINDOW_ACCESS_MAP[key];
  return (id === null || id === undefined) ? null : id;
};
