import { useState, useCallback, useRef } from 'react';
import { idempiereApi, fkId, fkLabel } from '../utils/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// useProductSearch.js
// Fetch produk + vendor aktif (M_ProductPO) + UoM conversion (C_UOM_Conversion),
// dengan debounce search bawaan. Diekstrak dari fetchProducts() di
// RequisitionContainer — logic gabungan 3 endpoint ini cukup rumit dan kemungkinan
// dipakai lagi di modul lain yang butuh produk + vendor (mis. PO Create form).
//
// Penggunaan:
//   const { products, loading, search, searchValue, setSearchValue } = useProductSearch();
//   useEffect(() => { search(''); }, []);
//   <input onChange={e => search(e.target.value)} />  // debounced otomatis
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
        idempiereApi(`/models/m_product?$select=M_Product_ID,Name,Value,C_UOM_ID&$filter=${productFilter}&$orderby=Name&$top=100`),
        idempiereApi(`/models/m_product_po?$select=M_Product_ID,C_BPartner_ID,IsCurrentVendor&$filter=IsActive eq true and IsCurrentVendor eq true&$top=500`),
        idempiereApi(`/models/c_uom_conversion?$select=C_UOM_Conversion_ID,M_Product_ID,C_UOM_ID,C_UOM_To_ID,MultiplyRate,DivideRate&$filter=IsActive eq true&$top=1000`),
      ]);

      const rawProducts = Array.isArray(productData.records)  ? productData.records  : [];
      const poRecords    = Array.isArray(productPoData.records) ? productPoData.records : [];
      const uomRecords   = Array.isArray(uomConvData.records)   ? uomConvData.records   : [];

      // Vendor aktif per produk
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

      // UoM alternatif per produk (dari C_UOM_Conversion)
      const uomConvMap = new Map();
      uomRecords.forEach(conv => {
        const pid       = fkId(conv.M_Product_ID);
        const fromUomId = fkId(conv.C_UOM_ID);
        const toUomId   = fkId(conv.C_UOM_To_ID);
        const toUomName = fkLabel(conv.C_UOM_To_ID);
        const fromName  = fkLabel(conv.C_UOM_ID);

        if (!pid) return; // skip konversi global tanpa produk spesifik
        if (!uomConvMap.has(pid)) uomConvMap.set(pid, []);
        const list = uomConvMap.get(pid);

        if (fromUomId && !list.find(u => u.C_UOM_ID === fromUomId)) {
          list.push({ C_UOM_ID: fromUomId, Name: fromName || `UOM#${fromUomId}`, multiplyRate: 1 });
        }
        if (toUomId && !list.find(u => u.C_UOM_ID === toUomId)) {
          list.push({ C_UOM_ID: toUomId, Name: toUomName || `UOM#${toUomId}`, multiplyRate: conv.MultiplyRate ?? 1 });
        }
      });

      // Gabungkan, hanya produk yang punya vendor aktif
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

  // search() = versi debounced untuk dipanggil langsung dari onChange input.
  // Untuk fetch immediate (mis. saat init atau Enter ditekan), panggil fetchProducts() langsung.
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
    fetchProducts,    // fetch langsung (untuk init, Enter key, dll)
    search,            // fetch dengan debounce (untuk onChange)
    searchImmediate,   // set value + fetch langsung tanpa debounce
  };
}
