import { useState, useCallback, useRef, useEffect } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';

export function useProductSearch({ debounceMs = 420 } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const debounceRef = useRef(null);

  // Bersihkan timeout saat komponen unmount untuk menghindari memory leak
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

  // fetchWarehouseLocatorIds
  const fetchWarehouseLocatorIds = useCallback(async (warehouseId) => {
    if (!warehouseId) return null;
    try {
      
      return (data.records || []).map(r => fkId(r.M_Locator_ID)).filter(Boolean);
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
  // Dipakai untuk sort hasil pencarian client-side, karena OData/iDempiere
  // REST API tidak punya relevance ranking bawaan — filter server tetap OR
  // semua field (supaya tidak kehilangan kandidat), tapi urutan tampil
  // ditentukan di sini berdasarkan field mana yang match dan seberapa "kuat".
  const scoreMatch = useCallback((product, safeQ) => {
    if (!safeQ) return 0;

    const value       = (product.Value || '').toUpperCase();
    const name        = (product.Name || '').toUpperCase();
    const upc         = (product.UPC || '').toUpperCase();
    const description = (product.Description || '').toUpperCase();

    let score = 0;

    // Value: exact match tertinggi, lalu starts-with, lalu contains
    if (value === safeQ) score = Math.max(score, 100);
    else if (value.startsWith(safeQ)) score = Math.max(score, 90);
    else if (value.includes(safeQ)) score = Math.max(score, 70);

    // Name: starts-with sedikit di bawah Value exact, contains di bawahnya
    if (name === safeQ) score = Math.max(score, 95);
    else if (name.startsWith(safeQ)) score = Math.max(score, 80);
    else if (name.includes(safeQ)) score = Math.max(score, 60);

    // UPC: biasanya dicari via scan, exact match cukup tinggi
    if (upc === safeQ) score = Math.max(score, 85);
    else if (upc.includes(safeQ)) score = Math.max(score, 50);

    // Description: prioritas paling rendah, hanya fallback
    if (description.includes(safeQ)) score = Math.max(score, 20);

    return score;
  }, []);

  // ── fetch utama (Name / Value / UPC / Description search, debounced) ───────
const fetchProducts = useCallback(async (query = '', warehouseId = null) => {
  try {
    setLoading(true);
    const safeQ = query.toUpperCase().replace(/'/g, "''");

    let productFilter = 'IsPurchased eq true and IsActive eq true';
    if (query) {
      productFilter += ` and (contains(toupper(Name),'${safeQ}') or contains(toupper(Value),'${safeQ}') or contains(toupper(UPC),'${safeQ}') or contains(toupper(Description),'${safeQ}'))`;
    }

    const locatorIds = await fetchWarehouseLocatorIds(warehouseId);
    if (locatorIds !== null && locatorIds.length === 0) {
      setProducts([]);
      return [];
    }

    let rawProducts = [];

    if (locatorIds === null) {
      // Tidak ada warehouse filter — query normal
      const productData = await idempiereApi(
        `/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,M_Locator_ID,Description,Updated` +
        `&$filter=${productFilter}&$orderby=Updated desc&$top=50`
      );
      rawProducts = Array.isArray(productData.records) ? productData.records : [];
    } else {
      // Ada warehouse filter — chunking parallel
      const CHUNK_SIZE = 15;
      const chunks = [];
      for (let i = 0; i < locatorIds.length; i += CHUNK_SIZE) {
        chunks.push(locatorIds.slice(i, i + CHUNK_SIZE));
      }

      const chunkResults = await Promise.all(
        chunks.map(chunk => {
          //const locFilter = chunk.map(id => `M_Locator_ID eq ${id}`).join(' or ');
          const locFilter = chunk.map(id => `M_Locator_ID/id eq ${id}`).join(' or ');
          return idempiereApi(
            `/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,M_Locator_ID,Description,Updated` +
            `&$filter=${productFilter} and (${locFilter})&$orderby=Updated desc&$top=50`
          ).catch(() => ({ records: [] }));
        })
      );

      const seen = new Set();
      rawProducts = chunkResults
        .flatMap(data => Array.isArray(data.records) ? data.records : [])
        .filter(p => {
          const pid = fkId(p.M_Product_ID) ?? p.id;
          if (seen.has(pid)) return false;
          seen.add(pid);
          return true;
        })
        .slice(0, 50);
    }

    if (rawProducts.length === 0) {
      setProducts([]);
      return [];
    }

    // Scope PO & UOM ke produk hasil filter
    const productIds = rawProducts.map(p => fkId(p.M_Product_ID) ?? p.id).filter(Boolean);
    const idScopeFilter = productIds.map(id => `M_Product_ID eq ${id}`).join(' or ');

    const [productPoData, uomConvData] = await Promise.all([
      idempiereApi(`/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true and (${idScopeFilter})`),
      idempiereApi(`/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true and (${idScopeFilter})`),
    ]);

    const poRecords  = Array.isArray(productPoData.records) ? productPoData.records : [];
    const uomRecords = Array.isArray(uomConvData.records)   ? uomConvData.records   : [];

    const finalProducts = buildProducts(rawProducts, poRecords, uomRecords);

    // Urutkan berdasarkan relevansi (Value/Name diprioritaskan di atas
    // UPC/Description) — hanya berlaku kalau ada query, kalau kosong
    // (browse semua produk) urutan dari $orderby=Updated desc tetap dipakai.
    const sortedProducts = query
      ? [...finalProducts].sort((a, b) => scoreMatch(b, safeQ) - scoreMatch(a, safeQ))
      : finalProducts;

    setProducts(sortedProducts);
    return sortedProducts;
  } catch (err) {
    console.error('[useProductSearch] error:', err);
    return [];
  } finally {
    setLoading(false);
  }
}, [buildProducts, fetchWarehouseLocatorIds, scoreMatch]);

  // ── searchByUPC: exact match, tanpa debounce ──────────────────────────────
  const searchByUPC = useCallback(async (upc) => {
    if (!upc) return null;
    try {
      setLoading(true);
      const safeUPC = upc.trim().replace(/'/g, "''");

      const productData = await idempiereApi(`/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,Description&$filter=IsPurchased eq true and IsActive eq true and UPC eq '${safeUPC}'&$top=1`);
      const rawProducts = Array.isArray(productData.records) ? productData.records : [];
      if (rawProducts.length === 0) return null;

      // OPTIMASI: Hanya cari PO & UOM untuk 1 produk spesifik ini
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
      return null; // ← daripada throw ke caller
    } finally {
      setLoading(false);
    }
  }, [buildProducts]);

  const search = useCallback((query) => {
    setSearchValue(query);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(query), debounceMs);
  }, [fetchProducts, debounceMs]);

  const searchImmediate = useCallback((query) => {
    clearTimeout(debounceRef.current);
    setSearchValue(query);
    return fetchProducts(query);
  }, [fetchProducts]);

  return {
    products, loading,
    searchValue, setSearchValue,
    fetchProducts,
    search,
    searchImmediate,
    searchByUPC,
  };
}