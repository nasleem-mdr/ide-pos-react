import { useState, useCallback, useRef } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useProductSearch.js
// Gambar produk TIDAK lagi diambil di sini — sebelumnya field ImageURL ada
// di $select, tapi ternyata gambar produk disimpan sebagai AD_Attachment
// (file menempel ke record), bukan field kolom. Pengambilan gambar sekarang
// dilakukan terpisah, hanya untuk produk yang sedang dibuka di
// ProductDetailSheet (lihat utils/idempiereApi.js: getProductImageBlobUrl),
// supaya tidak ada N+1 request attachment untuk semua produk di grid.
// ─────────────────────────────────────────────────────────────────────────────
export function useProductSearch({ debounceMs = 420 } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const debounceRef = useRef(null);

  const fetchProducts = useCallback(async (query = '') => {
    try {
      setLoading(true);
      const safeQ = query.toUpperCase().replace(/'/g, "''");

      let productFilter = 'IsPurchased eq true and IsActive eq true';
      if (query) {
        productFilter += ` and (contains(toupper(Name),'${safeQ}') or contains(toupper(Value),'${safeQ}'))`;
      }

      const [productData, productPoData, uomConvData] = await Promise.all([
        idempiereApi(`/models/m_product?$select=M_Product_ID,Name,Value,C_UOM_ID,Description&$filter=${productFilter}&$orderby=Name&$top=100`),
        idempiereApi(`/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true&$top=500`),
        idempiereApi(`/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true&$top=1000`),
      ]);

      const rawProducts = Array.isArray(productData.records)  ? productData.records  : [];
      const poRecords    = Array.isArray(productPoData.records) ? productPoData.records : [];
      const uomRecords   = Array.isArray(uomConvData.records)   ? uomConvData.records   : [];

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

      const finalProducts = rawProducts
        .filter(p => vendorMap.has(fkId(p.M_Product_ID) ?? p.id))
        .map(p => {
          const pid       = fkId(p.M_Product_ID) ?? p.id;
          const vendor    = vendorMap.get(pid);
          const baseUomId = fkId(p.C_UOM_ID);
          const baseUom   = { C_UOM_ID: baseUomId, Name: fkLabel(p.C_UOM_ID) || 'EA', multiplyRate: 1 };

          const convUoms = uomConvMap.get(pid) || [];
          const allUoms  = [baseUom, ...convUoms.filter(u => u.C_UOM_ID !== baseUomId)];

          return {
            M_Product_ID: pid,
            Name:         p.Name,
            Value:        p.Value,
            C_UOM_ID:     baseUomId,
            C_UOM_Name:   baseUom.Name,
            Description:  p.Description || null,
            VendorId:     vendor?.vendorId,
            VendorName:   vendor?.vendorName,
            uomOptions:   allUoms,
          };
        });

      setProducts(finalProducts);
      return finalProducts;
    } finally {
      setLoading(false);
    }
  }, []);

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
  };
}
