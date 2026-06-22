const API_BASE = '/api/v1';

export async function idempiereApi(url, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      msg = d.message || d.Message || d.detail || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  return res.json();
}

export const fkId = (field) => field?.id ?? field ?? null;
export const fkLabel = (field) => field?.identifier || field?.Name || null;

// ─────────────────────────────────────────────────────────────────────────────
// Stock / Available Quantity helpers
// M_Storage menyimpan stok per kombinasi Locator + (lot/attribute-set-instance),
// jadi satu produk bisa punya banyak baris untuk locator yang sama. Helper ini
// mengagregasi per locator, lalu hitung total keseluruhan.
//
// "Available" = QtyOnHand - QtyReserved (qty fisik dikurangi yang sudah
// di-reserve untuk order lain) — definisi umum yang dipakai di iDempiere.
// ─────────────────────────────────────────────────────────────────────────────
export async function getProductAvailability(productId) {
  try {
    const res = await idempiereApi(
      `/models/m_storage?$filter=M_Product_ID eq ${productId}&$select=M_Locator_ID,QtyOnHand,QtyReserved,QtyOrdered&$top=500`
    );
    const records = Array.isArray(res.records) ? res.records : [];

    // Agregasi per locator — beberapa baris bisa berbagi locator yang sama
    // (lot/attribute-set-instance berbeda), jadi dijumlahkan, bukan diambil
    // satu per locator.
    const byLocator = new Map();
    records.forEach(r => {
      const locId   = fkId(r.M_Locator_ID);
      const locName = fkLabel(r.M_Locator_ID) || `Locator #${locId}`;
      const onHand  = r.QtyOnHand ?? 0;
      const reserved = r.QtyReserved ?? 0;
      const ordered  = r.QtyOrdered ?? 0;

      if (!byLocator.has(locId)) {
        byLocator.set(locId, { locatorId: locId, locatorName: locName, qtyOnHand: 0, qtyReserved: 0, qtyOrdered: 0 });
      }
      const entry = byLocator.get(locId);
      entry.qtyOnHand   += onHand;
      entry.qtyReserved += reserved;
      entry.qtyOrdered  += ordered;
    });

    const perLocator = Array.from(byLocator.values()).map(l => ({
      ...l,
      qtyAvailable: l.qtyOnHand - l.qtyReserved,
    }));

    const totals = perLocator.reduce((acc, l) => ({
      qtyOnHand:    acc.qtyOnHand + l.qtyOnHand,
      qtyReserved:  acc.qtyReserved + l.qtyReserved,
      qtyOrdered:   acc.qtyOrdered + l.qtyOrdered,
      qtyAvailable: acc.qtyAvailable + l.qtyAvailable,
    }), { qtyOnHand: 0, qtyReserved: 0, qtyOrdered: 0, qtyAvailable: 0 });

    return { perLocator, totals };
  } catch (err) {
    return { perLocator: [], totals: { qtyOnHand: 0, qtyReserved: 0, qtyOrdered: 0, qtyAvailable: 0 } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachment helpers — untuk produk yang gambarnya disimpan sebagai
// AD_Attachment (file menempel ke record), bukan field kolom URL biasa.
//
// Alur: 1) GET .../attachments → daftar {name, contentType}
//       2) GET .../attachments/{name} → binary file (dipakai langsung sbg <img src>)
// ─────────────────────────────────────────────────────────────────────────────

// Ambil daftar metadata attachment untuk satu record M_Product.
// Return: array [{ name, contentType }, ...] — kosong kalau tidak ada attachment.
export async function getProductAttachments(productId) {
  try {
    const res = await idempiereApi(`/models/m_product/${productId}/attachments`);
    return Array.isArray(res.attachments) ? res.attachments : [];
  } catch (err) {
    // 404/tidak ada attachment bukan error fatal — anggap saja kosong
    return [];
  }
}

// Cari attachment pertama yang content type-nya gambar, lalu bentuk URL
// binary-nya. URL ini memakai token dari localStorage sebagai query param
// karena <img src="..."> tidak bisa mengirim header Authorization secara
// langsung — endpoint REST iDempiere harus mendukung token lewat query
// param untuk ini berfungsi (umum didukung; kalau tidak, perlu fetch+blob,
// lihat getProductImageBlobUrl di bawah sebagai alternatif).
export async function getProductImageUrl(productId) {
  const attachments = await getProductAttachments(productId);
  const image = attachments.find(a => a.contentType?.startsWith('image/'));
  if (!image) return null;

  const token = localStorage.getItem('token');
  return `/api/v1/models/m_product/${productId}/attachments/${encodeURIComponent(image.name)}?token=${encodeURIComponent(token)}`;
}

// Alternatif lebih aman (tidak menaruh token di URL): fetch sebagai blob lalu
// buat object URL lokal. Gunakan ini kalau endpoint tidak mendukung token via
// query param, atau kalau ingin menghindari token tampil di Network tab URL.
// PENTING: pemanggil WAJIB memanggil URL.revokeObjectURL(url) saat selesai
// (mis. di useEffect cleanup) untuk mencegah memory leak.
export async function getProductImageBlobUrl(productId) {
  const attachments = await getProductAttachments(productId);
  const image = attachments.find(a => a.contentType?.startsWith('image/'));
  if (!image) return null;

  const token = localStorage.getItem('token');
  const res = await fetch(`/api/v1/models/m_product/${productId}/attachments/${encodeURIComponent(image.name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
