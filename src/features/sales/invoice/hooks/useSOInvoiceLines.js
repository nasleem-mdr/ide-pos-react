import { useState, useCallback, useRef } from 'react';
import { idempiereApi, fkId, fkLabel, buildQuery } from '@/api/idempiereApi';

const PAGE_SIZE = 20;

/**
 * Fetches completed Sales Orders (IsSOTrx = 'Y', DocStatus = 'CO') available
 * for invoicing. Mirrors `usePOInvoiceLines` on the AP side.
 *
 * Output shape is intentionally aligned field-for-field with what
 * POCard.jsx / POLineDetailSheet.jsx already expect (DocumentNo, CustomerName,
 * C_BPartner_ID, lines[].qtyOutstanding, etc.) so those components can be
 * reused as-is for Sales — see the generalized POCard/POLineDetailSheet.
 *
 * ASSUMPTION (flag this if wrong): "fully invoiced" / qtyOutstanding is
 * computed here from C_OrderLine.QtyInvoiced vs QtyOrdered directly. If Sales
 * invoicing in this project instead follows a 3-way match off Shipments
 * (M_InOut, IsSOTrx = 'Y') — mirroring PO -> GR -> Invoice on the AP side —
 * swap `mapOrder()`'s qty logic to compare against shipped/invoiced
 * M_InOutLine qty instead, same two-step fetch pattern used for m_inoutline.
 */
export function useSOInvoiceLines() {
  const [sos, setSOs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const skipRef = useRef(0);
  const searchTermRef = useRef('');

  const mapOrder = (o) => {
    const lines = (o.lines || []).map((l) => ({
      C_OrderLine_ID: l.id,
      M_Product_ID: fkId(l.M_Product_ID),
      ProductName: fkLabel(l.M_Product_ID),
      C_UOM_ID: fkId(l.C_UOM_ID),
      UomName: fkLabel(l.C_UOM_ID),
      PriceEntered: l.PriceEntered,
      qtyOutstanding: Math.max(Number(l.QtyOrdered ?? 0) - Number(l.QtyInvoiced ?? 0), 0),
    }));

    return {
      C_Order_ID: o.id,
      DocumentNo: o.DocumentNo,
      C_BPartner_ID: fkId(o.C_BPartner_ID),
      CustomerName: fkLabel(o.C_BPartner_ID),
      C_BPartner_Location_ID: fkId(o.C_BPartner_Location_ID),
      DateOrdered: o.DateOrdered,
      GrandTotal: o.GrandTotal,
      lines,
      isFullyInvoiced: lines.length > 0 && lines.every((l) => l.qtyOutstanding <= 0),
    };
  };

  const fetchPage = useCallback(async (term, skip, append) => {
    const setLoadingFlag = append ? setLoadingMore : setLoading;
    setLoadingFlag(true);
    try {
      // bxservice only reliably supports eq/and/or server-side, so the base
      // status filter goes server-side and the search term is applied
      // client-side — same two-step pattern used for the PO/m_inoutline case.
      const filter = `DocStatus eq 'CO' and IsSOTrx eq 'Y'`;
      const query = buildQuery({
        filter,
        orderBy: 'DateOrdered desc',
        skip,
        top: PAGE_SIZE,
        expand: 'lines',
      });

      const res = await idempiereApi.get(`/models/c_order${query}`);
      const rawRecords = res?.data?.records || res?.records || [];

      let mapped = rawRecords.map(mapOrder);

      if (term) {
        const needle = term.toLowerCase();
        mapped = mapped.filter(
          (so) =>
            so.DocumentNo?.toLowerCase().includes(needle) ||
            so.CustomerName?.toLowerCase().includes(needle)
        );
      }

      setSOs((prev) => (append ? [...prev, ...mapped] : mapped));
      setHasMore(rawRecords.length === PAGE_SIZE);
      skipRef.current = skip + rawRecords.length;
    } catch (err) {
      console.error('[useSOInvoiceLines] fetch failed:', err);
      if (!append) setSOs([]);
      setHasMore(false);
    } finally {
      setLoadingFlag(false);
    }
  }, []);

  const fetchSOs = useCallback(
    async (term = '') => {
      searchTermRef.current = term;
      skipRef.current = 0;
      await fetchPage(term, 0, false);
    },
    [fetchPage]
  );

  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await fetchPage(searchTermRef.current, skipRef.current, true);
  }, [fetchPage, loadingMore, hasMore]);

  const search = useCallback((value) => setSearchValue(value), []);

  return {
    sos,
    loading,
    fetchSOs,
    search,
    searchValue,
    hasMore,
    loadingMore,
    fetchNextPage,
  };
}
