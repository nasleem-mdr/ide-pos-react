import { useState, useCallback, useRef } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';

export function useProductSearch({ debounceMs = 420 } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const debounceRef = useRef(null);

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
          UPC:          p.UPC || null,   // ← tambahan
          C_UOM_ID:     baseUomId,
          C_UOM_Name:   baseUom.Name,
          Description:  p.Description || null,
          VendorId:     vendor?.vendorId,
          VendorName:   vendor?.vendorName,
          uomOptions:   allUoms,
        };
      });
  }, []);

  // ── fetch utama (Name / Value search, debounced) ───────────────────────────
  const fetchProducts = useCallback(async (query = '') => {
    try {
      setLoading(true);
      const safeQ = query.toUpperCase().replace(/'/g, "''");

      let productFilter = 'IsPurchased eq true and IsActive eq true';
      if (query) {
        productFilter += ` and (contains(toupper(Name),'${safeQ}') or contains(toupper(Value),'${safeQ}') or contains(toupper(UPC),'${safeQ}'))`;
      }

       const [productData, productPoData, uomConvData] = await Promise.all([
         idempiereApi(`/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,Description,Updated&$filter=${productFilter}&$orderby=Updated desc&$top=100`),
         idempiereApi(`/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true&$top=2000`),
         idempiereApi(`/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true&$top=2000`),
       ]);
      // // Step 1: ambil produk dulu
      // const productData = await idempiereApi(
      //   `/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,Description&$filter=${productFilter}&$orderby=Name&$top=100`
      // );
      // console.log('productData:', productData);
      // console.log('records:', productData?.records);
      // console.log('productIds:', productData?.records?.map(p => p.M_Product_ID));

      // const productIds = productData.records.map(p => p.M_Product_ID);

      // if (productIds.length === 0) {
      //   // tidak ada produk, skip query berikutnya
      //   return;
      // }

      // // Step 2: query 2 & 3 paralel, filter by product IDs
      // const idFilter = productIds.map(id => `M_Product_ID eq ${id}`).join(' or ');

      // const [productPoData, uomConvData] = await Promise.all([
      //   idempiereApi(
      //     `/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true and (${idFilter})&$top=200`
      //   ),
      //   idempiereApi(
      //     `/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true and (${idFilter})&$top=200`
      //   ),
      // ]);

      const rawProducts = Array.isArray(productData.records)   ? productData.records   : [];
      const poRecords   = Array.isArray(productPoData.records)  ? productPoData.records  : [];
      const uomRecords  = Array.isArray(uomConvData.records)    ? uomConvData.records    : [];

      const finalProducts = buildProducts(rawProducts, poRecords, uomRecords);
      setProducts(finalProducts);
      return finalProducts;
    } finally {
      setLoading(false);
    }
  }, [buildProducts]);

  // ── searchByUPC: exact match, tanpa debounce, cocok untuk barcode scan ─────
  const searchByUPC = useCallback(async (upc) => {
    if (!upc) return null;
    try {
      setLoading(true);
      const safeUPC = upc.trim().replace(/'/g, "''");

      const [productData, productPoData, uomConvData] = await Promise.all([
        idempiereApi(`/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,Description&$filter=IsPurchased eq true and IsActive eq true and UPC eq '${safeUPC}'&$top=1`),
        idempiereApi(`/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true&$top=500`),
        idempiereApi(`/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true&$top=1000`),
      ]);

      const rawProducts = Array.isArray(productData.records) ? productData.records : [];
      if (rawProducts.length === 0) return null; // UPC tidak ditemukan

      const poRecords  = Array.isArray(productPoData.records) ? productPoData.records : [];
      const uomRecords = Array.isArray(uomConvData.records)   ? uomConvData.records   : [];

      const results = buildProducts(rawProducts, poRecords, uomRecords);
      return results[0] ?? null; // kembalikan satu produk atau null
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
    searchByUPC,   // ← export
  };
}