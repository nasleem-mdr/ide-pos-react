// ─────────────────────────────────────────────────────────────────────────────
// useLoginInfo.js
// Membaca data sesi login iDempiere dari localStorage (diisi saat proses login).
// Dipakai di POS, Requisition, dan modul lain yang butuh AD_User_ID/Org/Warehouse.
//
// Catatan: nilai dibaca ulang setiap kali dipanggil (bukan cached di state),
// karena localStorage bisa berubah di luar React (mis. setelah switch role/login
// di tab lain). Kalau perlu reaktif terhadap perubahan localStorage, panggil
// getLoginInfo() lagi setelah event yang relevan (mis. setelah login ulang).
// ─────────────────────────────────────────────────────────────────────────────
export const getLoginInfo = () => ({
  userId:      parseInt(localStorage.getItem('AD_User_ID'))     || null,
  warehouseId: parseInt(localStorage.getItem('M_Warehouse_ID')) || null,
  orgId:       parseInt(localStorage.getItem('AD_Org_ID'))      || null,
  clientId:    parseInt(localStorage.getItem('AD_Client_ID'))   || null,
  roleId:      parseInt(localStorage.getItem('AD_Role_ID'))     || null,
  userName:    localStorage.getItem('UserName') || localStorage.getItem('Name') || 'User',
});

// Validasi field sesi yang wajib ada sebelum modul boleh beroperasi.
// Mengembalikan array nama field yang hilang (kosong = valid).
export const getMissingSessionFields = (info) => [
  !info.userId      && 'AD_User_ID',
  !info.warehouseId && 'M_Warehouse_ID',
  !info.orgId       && 'AD_Org_ID',
  !info.clientId    && 'AD_Client_ID',
].filter(Boolean);
