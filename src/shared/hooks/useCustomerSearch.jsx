import { useState, useCallback, useRef, useEffect } from 'react';
import { idempiereApi, fkId } from '@/api/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useCustomerSearch.jsx
// Padanan useVendorSearch — BEDA-nya cuma filter `IsCustomer eq true` (bukan
// `IsVendor eq true`). Dipakai oleh CustomerPickerModal.jsx.
//
// - search(query)             → debounced (300ms), auto-update state `customers`
// - getDefaultBPLocation(id)  → resolve C_BPartner_Location_ID aktif pertama
//                                milik customer tsb (dipakai saat user pilih
//                                customer, supaya CustomerPickerModal tidak
//                                perlu fetch lokasi terpisah di komponennya)
//
// Kalau instance kamu punya konsep "default/primary" location (mis. flag
// IsBillTo / IsShipTo), sesuaikan $filter di getDefaultBPLocation di bawah.
// ─────────────────────────────────────────────────────────────────────────────
export function useCustomerSearch() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (query) => {
    const q = (query || '').trim();
    if (!q) {
      setCustomers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await idempiereApi(
        `/models/c_bpartner?$select=C_BPartner_ID,Name,Value,IsCustomer` +
        `&$orderby=Name&$top=500`
      );
      const records = Array.isArray(res.records) ? res.records : [];
  
      const qLower = q.toLowerCase();
      const filtered = records.filter(r =>
        r.IsCustomer === true &&
        r.Name?.toLowerCase().includes(qLower)
      );
  
      setCustomers(filtered.slice(0, 20).map(r => ({
        C_BPartner_ID: fkId(r.C_BPartner_ID) ?? r.id ?? r.C_BPartner_ID,
        Name:  r.Name,
        Value: r.Value,
      })));
    } catch (err) {
      console.error('Gagal mencari customer:', err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce supaya tidak nembak API tiap keystroke.
  const search = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
  }, [runSearch]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const getDefaultBPLocation = useCallback(async (bpartnerId) => {
    try {
      const res = await idempiereApi(
        `/models/c_bpartner_location?$select=C_BPartner_Location_ID` +
        `&$filter=C_BPartner_ID eq ${bpartnerId} and IsActive eq true&$top=1`
      );
      const records = Array.isArray(res.records) ? res.records : [];
      if (records.length === 0) return null;
      return fkId(records[0].C_BPartner_Location_ID) ?? records[0].id ?? null;
    } catch (err) {
      console.error('Gagal fetch lokasi customer:', err.message);
      return null;
    }
  }, []);

  return { customers, loading, search, getDefaultBPLocation };
}