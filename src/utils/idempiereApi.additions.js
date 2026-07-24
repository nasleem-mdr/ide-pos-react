// ─────────────────────────────────────────────────────────────────────────────
// TAMBAHKAN BLOK INI KE FILE src/utils/idempiereApi.jsx YANG SUDAH ADA
// (paste di bagian bawah, setelah fkId/fkLabel — reuse fungsi idempiereApi()
// yang sudah ada di atas, jadi auth/error-handling-nya otomatis konsisten)
// ─────────────────────────────────────────────────────────────────────────────

// Generic model CRUD helper — dipakai untuk modul baru (S_Resource, S_Booking, dst)
// supaya tidak perlu tulis ulang pola fetch + query string setiap kali.
// Mengikuti konvensi yang sama seperti getProductAvailability(): query string
// di-embed langsung di URL, TIDAK di-encode (server/proxy kamu sudah terbukti
// jalan dengan format ini di modul stock).

function buildQuery(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

// GET list. tableName huruf kecil (mis. "s_resource", "s_booking").
// Return: response asli dari server, yaitu { records: [...] }
export async function getModelRecords(tableName, params = {}) {
  return idempiereApi(`/models/${tableName.toLowerCase()}${buildQuery(params)}`);
}

// GET satu record by ID.
export async function getModelRecord(tableName, id) {
  return idempiereApi(`/models/${tableName.toLowerCase()}/${id}`);
}

// POST create record baru. Return: record yang baru dibuat (termasuk ID-nya).
export async function createModelRecord(tableName, data) {
  return idempiereApi(`/models/${tableName.toLowerCase()}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// PUT update record.
export async function updateModelRecord(tableName, id, data) {
  return idempiereApi(`/models/${tableName.toLowerCase()}/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// DELETE record.
export async function deleteModelRecord(tableName, id) {
  return idempiereApi(`/models/${tableName.toLowerCase()}/${id}`, {
    method: "DELETE",
  });
}
