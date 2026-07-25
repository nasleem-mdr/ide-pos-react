import { useState, useCallback, useRef, useEffect } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';

const PAGE_SIZE = 20;          // jumlah produk per "halaman" infinite scroll
const NO_WH_TOP = PAGE_SIZE;   // top per fetch saat tanpa filter warehouse (server-paginated asli)
const WH_POOL_CAP = 150;       // cap total produk yang di-fetch sekali untuk mode warehouse-filtered

export function useProductSearch({ debounceMs = 420 } = {}) {
  const [products, setProducts]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const debounceRef = useRef(null);

  // Menyimpan parameter pencarian terakhir + state pagination internal
  const lastParamsRef = useRef({ query: '', warehouseId: null });
  const skipRef       = useRef(0);        // untuk mode tanpa-warehouse (server-side skip)
  const poolRef        = useRef([]);      // untuk mode warehouse-filtered (client-side slice pool)
  const visibleCountRef = useRef(PAGE_SIZE);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // ── shared helper: build product objects dari raw API records ──────────────
  const buildProducts = useCallback((rawProducts, poRecords, uomRecords) => {
    const vendorMap = new Map();
    poRecords.forEach(po => {
      const pid = fkId(po.M_Product_ID);
      if (pid && !vendorMap.has(pid)) {
        vendorMap.set(pid, {
          vendorId:   fkId(po.C_BPartner_ID),
          vendorName: fkLabel(po.C_BPartner_ID),
        });
      }
    });

    const uomConvMap = new Map();
    uomRecords.forEach(conv => {
      const pid       = fkId(conv.M_Product_ID);
      const fromUomId = fkId(conv.C_UOM_ID);
      const toUomId   = fkId(conv.C_UOM_To_ID);
      const toUomName = fkLabel(conv.C_UOM_To_ID);
      const fromName  = fkLabel(conv.C_UOM_ID);

      if (!pid) return;
      if (!uomConvMap.has(pid)) uomConvMap.set(pid, []);
      const list = uomConvMap.get(pid);

      if (fromUomId && !list.find(u => u.C_UOM_ID === fromUomId)) {
        list.push({ C_UOM_ID: fromUomId, Name: fromName || `UOM#${fromUomId}`, multiplyRate: 1 });
      }
      if (toUomId && !list.find(u => u.C_UOM_ID === toUomId)) {
        list.push({ C_UOM_ID: toUomId, Name: toUomName || `UOM#${toUomId}`, multiplyRate: conv.MultiplyRate ?? 1 });
      }
    });

    return rawProducts
      .filter(p => vendorMap.has(fkId(p.M_Product_ID) ?? p.id))
      .map(p => {
        const pid       = fkId(p.M_Product_ID) ?? p.id;
        const vendor    = vendorMap.get(pid);
        const baseUomId = fkId(p.C_UOM_ID);
        const baseUom   = { C_UOM_ID: baseUomId, Name: fkLabel(p.C_UOM_ID) || 'EA', multiplyRate: 1 };
        const convUoms  = uomConvMap.get(pid) || [];
        const allUoms   = [baseUom, ...convUoms.filter(u => u.C_UOM_ID !== baseUomId)];

        return {
          M_Product_ID: pid,
          Name:         p.Name,
          Value:        p.Value,
          UPC:          p.UPC || null,
          C_UOM_ID:     baseUomId,
          C_UOM_Name:   baseUom.Name,
          Description:  p.Description || null,
          VendorId:     vendor?.vendorId,
          VendorName:   vendor?.vendorName,
          uomOptions:   allUoms,
        };
      });
  }, []);

  // fetchWarehouseLocatorIds — FIXED: dead-code return sebelum fetch dihapus
  const fetchWarehouseLocatorIds = useCallback(async (warehouseId) => {
    if (!warehouseId) return null;
    try {
      const data = await idempiereApi(
        `/models/m_locator?$select=M_Locator_ID&$filter=M_Warehouse_ID eq ${warehouseId} and IsActive eq true&$top=500`
      );
      return (data.records || []).map(r => fkId(r.M_Locator_ID)).filter(Boolean);
    } catch (err) {
      console.warn('[useProductSearch] fetchWarehouseLocatorIds error:', err);
      return null;
    }
  }, []);

  // ── scoring: prioritas Value/Name di atas UPC/Description ──────────────────
  const scoreMatch = useCallback((product, safeQ) => {
    if (!safeQ) return 0;

    const value       = (product.Value || '').toUpperCase();
    const name        = (product.Name || '').toUpperCase();
    const upc         = (product.UPC || '').toUpperCase();
    const description = (product.Description || '').toUpperCase();

    let score = 0;

    if (value === safeQ) score = Math.max(score, 100);
    else if (value.startsWith(safeQ)) score = Math.max(score, 90);
    else if (value.includes(safeQ)) score = Math.max(score, 70);

    if (name === safeQ) score = Math.max(score, 95);
    else if (name.startsWith(safeQ)) score = Math.max(score, 80);
    else if (name.includes(safeQ)) score = Math.max(score, 60);

    if (upc === safeQ) score = Math.max(score, 85);
    else if (upc.includes(safeQ)) score = Math.max(score, 50);

    if (description.includes(safeQ)) score = Math.max(score, 20);

    return score;
  }, []);

  // ── enrich: ambil PO + UOM untuk sekumpulan rawProducts, lalu build+sort ───
  const enrichAndSort = useCallback(async (rawProducts, query, safeQ) => {
    if (rawProducts.length === 0) return [];

    const productIds = rawProducts.map(p => fkId(p.M_Product_ID) ?? p.id).filter(Boolean);
    const idScopeFilter = productIds.map(id => `M_Product_ID eq ${id}`).join(' or ');

    const [productPoData, uomConvData] = await Promise.all([
      idempiereApi(`/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true and (${idScopeFilter})`),
      idempiereApi(`/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true and (${idScopeFilter})`),
    ]);

    const poRecords  = Array.isArray(productPoData.records) ? productPoData.records : [];
    const uomRecords = Array.isArray(uomConvData.records)   ? uomConvData.records   : [];

    const finalProducts = buildProducts(rawProducts, poRecords, uomRecords);

    return query
      ? [...finalProducts].sort((a, b) => scoreMatch(b, safeQ) - scoreMatch(a, safeQ))
      : finalProducts;
  }, [buildProducts, scoreMatch]);

  // ── path A: tanpa filter warehouse — server-side skip/top asli ─────────────
  const fetchNoWarehousePage = useCallback(async (query, skip) => {
    const safeQ = query.toUpperCase().replace(/'/g, "''");
    let productFilter = 'IsPurchased eq true and IsActive eq true';
    if (query) {
      productFilter += ` and (contains(toupper(Name),'${safeQ}') or contains(toupper(Value),'${safeQ}') or contains(toupper(UPC),'${safeQ}') or contains(toupper(Description),'${safeQ}'))`;
    }

    const productData = await idempiereApi(
      `/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,M_Locator_ID,Description,Updated` +
      `&$filter=${productFilter}&$orderby=Updated desc&$top=${NO_WH_TOP}&$skip=${skip}`
    );
    const rawProducts = Array.isArray(productData.records) ? productData.records : [];
    const page = await enrichAndSort(rawProducts, query, safeQ);
    return { page, rawCount: rawProducts.length };
  }, [enrichAndSort]);

  // ── path B: dengan filter warehouse — fetch pool sekali, lalu slice ─────────
  const fetchWarehousePool = useCallback(async (query, warehouseId) => {
    const safeQ = query.toUpperCase().replace(/'/g, "''");
    let productFilter = 'IsPurchased eq true and IsActive eq true';
    if (query) {
      productFilter += ` and (contains(toupper(Name),'${safeQ}') or contains(toupper(Value),'${safeQ}') or contains(toupper(UPC),'${safeQ}') or contains(toupper(Description),'${safeQ}'))`;
    }

    const locatorIds = await fetchWarehouseLocatorIds(warehouseId);
    if (locatorIds !== null && locatorIds.length === 0) return [];

    if (locatorIds === null) {
      // fallback locator gagal diambil — treat sama seperti path A tapi dengan cap pool
      const productData = await idempiereApi(
        `/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,M_Locator_ID,Description,Updated` +
        `&$filter=${productFilter}&$orderby=Updated desc&$top=${WH_POOL_CAP}`
      );
      const rawProducts = Array.isArray(productData.records) ? productData.records : [];
      return enrichAndSort(rawProducts, query, safeQ);
    }

    const CHUNK_SIZE = 15;
    const chunks = [];
    for (let i = 0; i < locatorIds.length; i += CHUNK_SIZE) {
      chunks.push(locatorIds.slice(i, i + CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map(chunk => {
        const locFilter = chunk.map(id => `M_Locator_ID/id eq ${id}`).join(' or ');
        return idempiereApi(
          `/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,M_Locator_ID,Description,Updated` +
          `&$filter=${productFilter} and (${locFilter})&$orderby=Updated desc&$top=${WH_POOL_CAP}`
        ).catch(() => ({ records: [] }));
      })
    );

    const seen = new Set();
    const rawProducts = chunkResults
      .flatMap(data => Array.isArray(data.records) ? data.records : [])
      .filter(p => {
        const pid = fkId(p.M_Product_ID) ?? p.id;
        if (seen.has(pid)) return false;
        seen.add(pid);
        return true;
      })
      .slice(0, WH_POOL_CAP);

    return enrichAndSort(rawProducts, query, safeQ);
  }, [enrichAndSort, fetchWarehouseLocatorIds]);

  // ── fetchProducts: reset ke halaman pertama ─────────────────────────────────
  const fetchProducts = useCallback(async (query = '', warehouseId = null) => {
    lastParamsRef.current = { query, warehouseId };
    setLoading(true);
    try {
      if (warehouseId) {
        const pool = await fetchWarehousePool(query, warehouseId);
        poolRef.current = pool;
        visibleCountRef.current = PAGE_SIZE;
        setProducts(pool.slice(0, PAGE_SIZE));
        setHasMore(pool.length > PAGE_SIZE);
      } else {
        skipRef.current = 0;
        const { page, rawCount } = await fetchNoWarehousePage(query, 0);
        skipRef.current = rawCount;
        poolRef.current = []; // tidak dipakai di path ini
        setProducts(page);
        setHasMore(rawCount === NO_WH_TOP);
      }
      return true;
    } catch (err) {
      console.error('[useProductSearch] fetchProducts error:', err);
      setProducts([]);
      setHasMore(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchWarehousePool, fetchNoWarehousePage]);

  // ── loadMore: dipanggil sentinel infinite scroll ────────────────────────────
  const loadMore = useCallback(async () => {
    const { query, warehouseId } = lastParamsRef.current;

    if (warehouseId) {
      // client-side slice, tidak ada network call baru
      const nextCount = visibleCountRef.current + PAGE_SIZE;
      visibleCountRef.current = nextCount;
      setProducts(poolRef.current.slice(0, nextCount));
      setHasMore(poolRef.current.length > nextCount);
      return;
    }

    // path tanpa warehouse: fetch halaman berikut dari server
    setLoadingMore(true);
    try {
      const { page, rawCount } = await fetchNoWarehousePage(query, skipRef.current);
      skipRef.current += rawCount;
      setProducts(prev => [...prev, ...page]);
      setHasMore(rawCount === NO_WH_TOP);
    } catch (err) {
      console.error('[useProductSearch] loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchNoWarehousePage]);

  // ── searchByUPC: exact match, tanpa debounce, tidak terpengaruh pagination ──
  const searchByUPC = useCallback(async (upc) => {
    if (!upc) return null;
    try {
      setLoading(true);
      const safeUPC = upc.trim().replace(/'/g, "''");

      const productData = await idempiereApi(`/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,Description&$filter=IsPurchased eq true and IsActive eq true and UPC eq '${safeUPC}'&$top=1`);
      const rawProducts = Array.isArray(productData.records) ? productData.records : [];
      if (rawProducts.length === 0) return null;

      const targetProductId = fkId(rawProducts[0].M_Product_ID) ?? rawProducts[0].id;

      const [productPoData, uomConvData] = await Promise.all([
        idempiereApi(`/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true and M_Product_ID eq ${targetProductId}`),
        idempiereApi(`/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true and M_Product_ID eq ${targetProductId}`),
      ]);

      const poRecords  = Array.isArray(productPoData.records) ? productPoData.records : [];
      const uomRecords = Array.isArray(uomConvData.records)   ? uomConvData.records   : [];

      const results = buildProducts(rawProducts, poRecords, uomRecords);
      return results[0] ?? null;
    } catch (err) {
      console.error('[useProductSearch] searchByUPC error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [buildProducts]);

  const search = useCallback((query, warehouseId = null) => {
    setSearchValue(query);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(query, warehouseId), debounceMs);
  }, [fetchProducts, debounceMs]);

  const searchImmediate = useCallback((query, warehouseId = null) => {
    clearTimeout(debounceRef.current);
    setSearchValue(query);
    return fetchProducts(query, warehouseId);
  }, [fetchProducts]);

  return {
    products, loading, loadingMore, hasMore,
    searchValue, setSearchValue,
    fetchProducts,
    loadMore,
    search,
    searchImmediate,
    searchByUPC,
  };
}