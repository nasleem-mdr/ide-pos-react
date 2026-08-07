import { useState, useCallback, useRef } from 'react';
import { idempiereApi } from '@/api/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useCustomerSearch.js
// Padanan hook pencarian vendor inline di GoodsReceiptContainer, tapi untuk
// C_BPartner sisi Customer (IsCustomer = true). Debounce ringan (250ms)
// supaya tidak nembak request di tiap keystroke.
// ─────────────────────────────────────────────────────────────────────────────
export function useCustomerSearch() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const searchCustomer = useCallback((term) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = term.trim();
    if (q.length < 2) { setCustomers([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await idempiereApi(
          `/models/c_bpartner?$filter=IsCustomer eq true and IsActive eq true and contains(upper(Name), upper('${q}'))` +
          `&$select=C_BPartner_ID,Name,Value&$orderby=Name&$top=20`
        );
        setCustomers(Array.isArray(res.records) ? res.records : []);
      } catch (err) {
        console.error('[useCustomerSearch] gagal cari customer:', err.message);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  return { customers, loading, searchCustomer };
}