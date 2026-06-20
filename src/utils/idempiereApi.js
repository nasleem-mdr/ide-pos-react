// ─────────────────────────────────────────────────────────────────────────────
// idempiereApi.js
// Wrapper fetch generic untuk iDempiere REST API (OData v1/models/...).
// Sebelumnya `api()` didefinisikan inline di dalam RequisitionContainer via
// useCallback — dipindah ke sini supaya POS, Workflow, dan modul lain bisa
// pakai instance yang sama tanpa duplikasi logic auth header & error parsing.
//
// Penggunaan:
//   import { idempiereApi } from '../utils/idempiereApi';
//   const wh = await idempiereApi(`/models/m_warehouse/${id}?$select=Name`);
//   await idempiereApi('/models/m_requisition', { method: 'POST', body: JSON.stringify({...}) });
// ─────────────────────────────────────────────────────────────────────────────
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
    } catch (_) {
      // response bukan JSON, biarkan msg default
    }
    throw new Error(msg);
  }

  return res.json();
}

// Helper kecil untuk normalisasi field FK iDempiere yang bisa berbentuk
// `{ id, identifier }` (REST API) atau angka langsung (data lokal/mock).
// Dipakai berulang kali di fetchProducts, jadi diekspor agar tidak duplikasi.
export const fkId = (field) => field?.id ?? field ?? null;
export const fkLabel = (field) => field?.identifier || field?.Name || null;
