import { useState, useEffect, useCallback } from 'react';
import { idempiereApi, fkId } from '../utils/idempiereApi';
import { getLoginInfo } from './useLoginInfo';

// ─────────────────────────────────────────────────────────────────────────────
// useWindowAccess.js
// Fetch daftar AD_Window_Access untuk role aktif (dari sesi login), lalu
// bentuk menjadi Map<AD_Window_ID, { isReadWrite, isActive }> agar pengecekan
// O(1) di komponen lain (Sidebar, ProtectedRoute, tombol aksi).
//
// AD_Window_Access adalah child table dari AD_Role — field pentingnya:
//   AD_Role_ID, AD_Window_ID, IsReadWrite, IsActive
//
// Catatan: hanya window yang EXPLICIT terdaftar di AD_Window_Access untuk role
// tsb yang akan punya entry. Window yang tidak terdaftar = role TIDAK punya
// akses (default deny), sesuai perilaku iDempiere standar.
// ─────────────────────────────────────────────────────────────────────────────
export function useWindowAccess() {
  const [accessMap, setAccessMap] = useState(null); // null = belum dimuat
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { roleId } = getLoginInfo();
      if (!roleId) {
        setAccessMap(new Map());
        return;
      }

      const res = await idempiereApi(
        `/models/ad_window_access?$select=AD_Window_ID,IsReadWrite,IsActive&$filter=AD_Role_ID eq ${roleId} and IsActive eq true&$top=1000`
      );
      const records = Array.isArray(res.records) ? res.records : [];

      const map = new Map();
      records.forEach(r => {
        const winId = fkId(r.AD_Window_ID);
        if (winId == null) return;
        map.set(winId, {
          isReadWrite: !!r.IsReadWrite,
          isActive: !!r.IsActive,
        });
      });

      setAccessMap(map);
    } catch (err) {
      setError(err.message);
      // Gagal load = fail-closed: anggap tidak ada akses sama sekali,
      // lebih aman daripada fail-open (yang bisa membocorkan akses).
      setAccessMap(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { accessMap, loading, error, reload: load };
}
