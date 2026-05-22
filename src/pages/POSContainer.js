import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import CartItem from '../components/CartItem';
import ConfirmModal from '../components/ConfirmModal';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';

const POSContainer = () => {
     // 1. State untuk kontrol Loading & Data POS
         const [posConfig, setPosConfig]               = useState(null);
         const [cart, setCart]                         = useState([]);
         const [products, setProducts]                 = useState([]);
         const [loading, setLoading]                   = useState(true);
         const [currentVersionId, setCurrentVersionId] = useState(null);
         const [versionMissing, setVersionMissing]     = useState(false);
         const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
         const [editOrderId, setEditOrderId] = useState(null); // ID order draft yang sedang diedit
         const [isEditMode, setIsEditMode]   = useState(false);
         const location = useLocation();
         const navigate = useNavigate();
         
    // ─── Unified Dialog State ─────────────────────────────────────────────────
// mode: "confirm" → tampilkan tombol onConfirm + onCancel (produk harga 0)
// mode: "alert"   → tampilkan tombol onClose saja (notifikasi/error)
const DIALOG_CLOSED = { 
    isOpen: false, 
    mode: "alert", 
    title: "", 
    message: "", 
    product: null,
    onConfirmAction: null // ← Tambahkan ini untuk menyimpan aksi kustom dinamis
  };
  const [dialog, setDialog] = useState(DIALOG_CLOSED);
  
  // Perbarui triggerAlert agar bisa menerima parameter fungsi ketiga (opsional)
  const triggerAlert = (message, title = "Perhatian", onConfirmAction = null) => {
      setDialog({ 
        isOpen: true, 
        mode: "alert", 
        title, 
        message, 
        product: null,
        onConfirmAction // ← Simpan fungsi redirect ke dashboard di sini jika ada
      });
  };
  
  const triggerConfirm = (product) => {
      setDialog({
          isOpen:  true,
          mode:    "confirm",
          title:   "Produk Tanpa Harga",
          message: null,
          product,
          onConfirmAction: null // ← Untuk konfirmasi produk biasa, kosongkan saja
      });
  };
  
  const closeDialog = () => setDialog(DIALOG_CLOSED);
    // State untuk combobox C_BPartner dan M_PriceList di config bar
    const [bPartnerList, setBPartnerList]   = useState([]);
    const [priceListList, setPriceListList] = useState([]);
    const [selectedBPartner, setSelectedBPartner] = useState(null); // { id, name }
    const [selectedPriceList, setSelectedPriceList] = useState(null); // { id, name }

    const API_BASE    = "/api/v1";
    const debounceRef = useRef(null);
    const uomCacheRef = useRef({});
    const searchRef   = useRef(null);   // Ref ke <input> di SearchBar untuk reset value setelah barcode scan
    const [searchValue, setSearchValue] = useState(""); // Controlled value untuk input search

    // ─── API helper ───────────────────────────────────────────────────────────
    const customFetch = async (url, options = {}) => {
        const token    = localStorage.getItem("token");
        const fullUrl  = `${API_BASE}${url}`;
        const response = await fetch(fullUrl, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            const rawText   = await response.text().catch(() => '');
            let errorData   = {};
            try { errorData = JSON.parse(rawText); } catch (_) {}

            const errMsg =
                errorData.message  ||
                errorData.Message  ||
                errorData.error    ||
                errorData.Error    ||
                errorData.detail   ||
                rawText            ||
                `HTTP ${response.status}`;

            console.error(`❌ API Error [${response.status}] ${options.method || 'GET'} ${fullUrl}`);
            console.error('Response body:', rawText);
            if (options.body) {
                console.error('Request payload:', options.body);
            }

            throw new Error(`[${response.status}] ${errMsg}`);
        }
        return response.json();
    };

    // ─── 1. Init (mengambil data C_POS) ──────────────────────────────────────
    useEffect(() => {
        const initPOS = async () => {
            try {
                const loginUserId = localStorage.getItem("AD_User_ID");
                if (!loginUserId) { triggerAlert("Sesi user tidak ditemukan."); setLoading(false); return; }

                const data = await customFetch(
                    `/models/c_pos?$filter=SalesRep_ID eq ${loginUserId}`
                );

                if (data?.records?.length > 0) {
                    const terminalConfig = data.records[0];
                    setPosConfig(terminalConfig);

                    const priceListId = terminalConfig.M_PriceList_ID?.id ?? terminalConfig.M_PriceList_ID;
                    if (priceListId) {
                        const plName = terminalConfig.M_PriceList_ID?.identifier || terminalConfig.M_PriceList_ID?.Name || `PriceList #${priceListId}`;
                        setSelectedPriceList({ id: priceListId, name: plName });
                        await fetchProducts("", priceListId, terminalConfig);
                    } else {
                        triggerAlert("M_PriceList_ID tidak ditemukan pada konfigurasi terminal.");
                    }

                    // const bpId = terminalConfig.C_BPartner_ID?.id ?? terminalConfig.C_BPartner_ID;
                    // if (bpId) {
                    //     const bpName = terminalConfig.C_BPartner_ID?.identifier || terminalConfig.C_BPartner_ID?.Name || `BPartner #${bpId}`;
                    //     setSelectedBPartner({ id: bpId, name: bpName });
                    // }
                    const bpId = terminalConfig.C_BPartnerCashTrx_ID?.id ?? terminalConfig.C_BPartnerCashTrx_ID;
                    if (bpId) {
                        const bpName = terminalConfig.C_BPartnerCashTrx_ID?.identifier || terminalConfig.C_BPartnerCashTrx_ID?.Name || `BPartner #${bpId}`;
                        setSelectedBPartner({ id: bpId, name: bpName });
                    }

                    await Promise.all([
                        fetchBPartnerOptions(),
                        fetchPriceListOptions(terminalConfig),
                    ]);
                } else {
                    triggerAlert(
                        `Terminal tidak ditemukan untuk SalesRep ID: ${loginUserId}`, 
                        "Perhatian", 
                        () => navigate("/dashboard") 
                    );

                }
            } catch (err) {
                console.error("Error loading C_POS:", err.message);
                triggerAlert("Gagal memuat POS: " + err.message, "Error");
            } finally {
                setLoading(false);
            }
        };
        initPOS();
    }, []);
     // ─── Load draft order jika dari SalesOrderPage ────────────────────────────
     useEffect(() => {
         // Tunggu posConfig selesai dimuat dulu
         if (!posConfig) return;
     
         const editOrder = location.state?.editOrder;
         if (!editOrder) return;
     
         const loadDraftOrder = async () => {
             try {
                 setLoading(true);
                 const orderId = editOrder.id ?? editOrder.C_Order_ID;
                 setEditOrderId(orderId);
                 setIsEditMode(true);
     
                 // Override BPartner dari order
                 const bpId   = editOrder.C_BPartner_ID?.id ?? editOrder.C_BPartner_ID;
                 const bpName = editOrder.C_BPartner_ID?.identifier || editOrder.C_BPartner_ID?.Name || `BPartner #${bpId}`;
                 if (bpId) setSelectedBPartner({ id: bpId, name: bpName });
     
                 // Override PriceList dari order
                 const plId   = editOrder.M_PriceList_ID?.id ?? editOrder.M_PriceList_ID;
                 const plName = editOrder.M_PriceList_ID?.identifier || `PriceList #${plId}`;
                 if (plId) setSelectedPriceList({ id: plId, name: plName });
     
                 // Fetch order lines
                 const linesRes = await customFetch(
                     `/models/c_orderline?$filter=C_Order_ID eq ${orderId}` +
                     `&$select=C_OrderLine_ID,M_Product_ID,QtyEntered,PriceActual,PriceEntered,C_UOM_ID`
                 );
                 const lines = Array.isArray(linesRes.records) ? linesRes.records : [];
     
                 // Mapping lines ke format cart
                 const cartItems = lines.map((line) => {
                     const productId   = line.M_Product_ID?.id   ?? line.M_Product_ID;
                     const productName = line.M_Product_ID?.identifier || line.M_Product_ID?.Name || `Product #${productId}`;
                     const uomId       = line.C_UOM_ID?.id   ?? line.C_UOM_ID;
                     const uomName     = line.C_UOM_ID?.identifier || line.C_UOM_ID?.Name || "EA";
                     const price       = parseFloat(line.PriceActual || line.PriceEntered || 0);
                     const qty         = parseFloat(line.QtyEntered || 1);
                     const lineId      = line.id ?? line.C_OrderLine_ID;
     
                     const selectedUOM = { id: uomId, name: uomName, multiplyRate: 1 };
     
                     return {
                         C_OrderLine_ID: lineId,   // ← simpan untuk update line nanti
                         M_Product_ID:   productId,
                         Name:           productName,
                         Value:          "",
                         PriceActual:    price,
                         basePrice:      price,
                         QtyEntered:     qty,
                         defaultUOM:     selectedUOM,
                         uomOptions:     [selectedUOM],
                         selectedUOM,
                     };
                 });
     
                 setCart(cartItems);
     
             } catch (err) {
                 console.error("Gagal load draft order:", err.message);
             } finally {
                 setLoading(false);
             }
         };
     
         loadDraftOrder();
     }, [posConfig]); // ← trigger setelah posConfig ready
     
    // ─── 1b. Fetch opsi BPartner untuk combobox ──────────────────────────────
    const fetchBPartnerOptions = async () => {
        try {
            const res = await customFetch(
                `/models/c_bpartner?$filter=IsActive eq true and IsCustomer eq true&$select=C_BPartner_ID,Name&$orderby=Name&$top=100`
            );
            const records = Array.isArray(res.records) ? res.records : [];
            const options = records.map(bp => ({
                id:   bp.C_BPartner_ID?.id ?? bp.C_BPartner_ID ?? bp.id,
                name: bp.Name,
            })).filter(o => o.id);
            setBPartnerList(options);
        } catch (err) {
            console.warn("Gagal fetch BPartner list:", err.message);
        }
    };

    // ─── 1c. Fetch opsi PriceList untuk combobox ─────────────────────────────
    const fetchPriceListOptions = async (terminalConfig) => {
        try {
            const config  = terminalConfig || posConfig;
            const adOrgId = config?.AD_Org_ID?.id ?? config?.AD_Org_ID;
            const filter  = adOrgId
                ? `IsActive eq true and (AD_Org_ID eq 0 or AD_Org_ID eq ${adOrgId})`
                : `IsActive eq true`;
            const res = await customFetch(
                `/models/m_pricelist?$filter=${filter}&$select=M_PriceList_ID,Name&$orderby=Name&$top=50`
            );
            const records = Array.isArray(res.records) ? res.records : [];
            const options = records.map(pl => ({
                id:   pl.M_PriceList_ID?.id ?? pl.M_PriceList_ID ?? pl.id,
                name: pl.Name,
            })).filter(o => o.id);
            setPriceListList(options);
        } catch (err) {
            console.warn("Gagal fetch PriceList:", err.message);
        }
    };

    // ─── 1d. Handler ganti BPartner ──────────────────────────────────────────
    const handleBPartnerChange = (e) => {
        const id   = parseInt(e.target.value, 10);
        const name = e.target.options[e.target.selectedIndex].text;
        setSelectedBPartner({ id, name });
    };

    // ─── 1e. Handler ganti PriceList → reload produk ─────────────────────────
    const handlePriceListChange = async (e) => {
        const id   = parseInt(e.target.value, 10);
        const name = e.target.options[e.target.selectedIndex].text;
        setSelectedPriceList({ id, name });
        await fetchProducts("", id);
    };

    // ─── 2. Fetch products ────────────────────────────────────────────────────
    const fetchProducts = async (query = "", priceListId = null, terminalConfig = null) => {
    try {
        setLoading(true);
        setVersionMissing(false);

        const config           = terminalConfig || posConfig;
        const rawPriceId       = priceListId || config?.M_PriceList_ID;
        const finalPriceListId = typeof rawPriceId === 'object' ? rawPriceId?.id : rawPriceId;
        if (!finalPriceListId) { console.error("PriceList ID tidak ditemukan"); return; }

        // ── Step 1: Ambil version (harus duluan karena jadi dependency) ──────
        const versionRes = await customFetch(
            `/models/m_pricelist_version?$filter=M_PriceList_ID eq ${finalPriceListId}` +
            ` and IsActive eq true&$orderby=ValidFrom desc&$top=1`
        );
        const activeVersion = versionRes?.records?.[0];
        if (!activeVersion) {
            setCurrentVersionId("NOT_FOUND");
            setVersionMissing(true);
            setProducts([]);
            return;
        }

        const versionId = activeVersion.id
            || activeVersion.M_PriceList_Version_ID?.id
            || activeVersion.M_PriceList_Version_ID;
        setCurrentVersionId(versionId);

        // ── Step 2: Fetch price + product PARALEL ────────────────────────────
        let productFilter = "IsSold eq true and IsActive eq true";
        if (query) {
            const safeQuery = query.toUpperCase().replace(/'/g, "''");
            productFilter += ` and (contains(toupper(Name),'${safeQuery}') or contains(toupper(Value),'${safeQuery}'))`;
        }

        const [priceData, productData] = await Promise.all([
            customFetch(
                `/models/m_productprice?$filter=M_PriceList_Version_ID eq ${versionId}` +
                `&$select=M_Product_ID,PriceStd`
            ),
            customFetch(
                `/models/m_product?$select=M_Product_ID,Name,Value,C_UOM_ID,M_Product_Category_ID,ProductType` +
                `&$filter=${productFilter}&$top=50`
            ),
        ]);

        const productRecords = Array.isArray(productData.records)
            ? productData.records
            : productData.records ? [productData.records] : [];

        // ── Step 3: Build priceMap, filter hanya produk yang relevan ─────────
        const relevantIds = new Set(
            productRecords.map(p => p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id)
        );
        const rawPriceRecords = Array.isArray(priceData.records)
            ? priceData.records
            : priceData.records ? [priceData.records] : [];

        const priceMap = new Map();
        rawPriceRecords
            .filter(p => relevantIds.has(p.M_Product_ID?.id ?? p.M_Product_ID))
            .forEach(p => {
                const pid = p.M_Product_ID?.id ?? p.M_Product_ID;
                if (pid != null) priceMap.set(pid, p.PriceStd);
            });

        // ── Step 4: Batch fetch QtyOnHand (1 request, bukan N) ───────────────
        const productIds   = [...relevantIds];
        const qtyOnHandMap = await fetchQtyOnHandBatch(productIds, config);

        // ── Step 5: Mapping final ─────────────────────────────────────────────
        const finalProducts = productRecords.map((p) => {
            const pId  = p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id;
            const price = priceMap.get(pId);
            if (price === undefined) return null;

            return {
                M_Product_ID:    pId,
                Name:            p.Name,
                Value:           p.Value,
                PriceActual:     price ?? 0,
                basePrice:       price ?? 0,
                defaultUOM: {
                    id:           p.C_UOM_ID?.id ?? p.C_UOM_ID,
                    name:         p.C_UOM_ID?.Name || p.C_UOM_ID?.identifier || 'EA',
                    multiplyRate: 1,
                },
                ProductCategory: {
                    id:   p.M_Product_Category_ID?.id ?? p.M_Product_Category_ID,
                    name: p.M_Product_Category_ID?.Name || p.M_Product_Category_ID?.identifier || 'N/A',
                },
                ProductType:  p.ProductType?.id ?? p.ProductType ?? null,
                QtyOnHand:    qtyOnHandMap.get(pId) ?? 0,
            };
        }).filter(Boolean);

        setProducts(finalProducts);
    } catch (err) {
        console.error("Fetch Products Error:", err.message);
        setProducts([]);
    } finally {
        setLoading(false);
    }
};

    // ─── 3a. Fetch UOM options untuk satu produk ───────────────────────────────
    const fetchUOMOptions = async (product) => {
        const productId = product.M_Product_ID;

        if (uomCacheRef.current[productId]) {
            return uomCacheRef.current[productId];
        }

        const defaultUOM    = product.defaultUOM || { id: null, name: 'EA', multiplyRate: 1 };
        const defaultOption = { id: defaultUOM.id, name: defaultUOM.name, multiplyRate: 1 };

        const defaultUomId = defaultUOM.id;
        if (!defaultUomId) {
            uomCacheRef.current[productId] = [defaultOption];
            return [defaultOption];
        }

        const options = [defaultOption];

        const buildOptions = (records) => {
            records.forEach(conv => {
                const toId   = conv.C_UOM_To_ID?.id  ?? conv.C_UOM_To_ID;
                const toName = conv.C_UOM_To_ID?.Name || conv.C_UOM_To_ID?.identifier || `UOM #${toId}`;
                const rate   = conv.MultiplyRate ?? 1;
                if (toId && !options.find(o => o.id === toId)) {
                    options.push({ id: toId, name: toName, multiplyRate: rate });
                }
            });
        };

        try {
            const resProduct = await customFetch(
                `/models/c_uom_conversion?$filter=C_UOM_ID eq ${defaultUomId} and M_Product_ID eq ${productId} and IsActive eq true&$select=C_UOM_ID,C_UOM_To_ID,MultiplyRate,M_Product_ID`
            );
            buildOptions(Array.isArray(resProduct.records) ? resProduct.records : []);
        } catch (err) {
            console.warn("Gagal fetch UOM spesifik produk", productId, err.message);
        }

        try {
            const resGlobal = await customFetch(
                `/models/c_uom_conversion?$filter=C_UOM_ID eq ${defaultUomId} and IsActive eq true&$select=C_UOM_ID,C_UOM_To_ID,MultiplyRate,M_Product_ID&$top=50`
            );
            const globalRecords = (Array.isArray(resGlobal.records) ? resGlobal.records : [])
                .filter(conv => !conv.M_Product_ID || conv.M_Product_ID === null);
            buildOptions(globalRecords);
        } catch (err) {
            console.warn("Gagal fetch UOM global untuk UOM", defaultUomId, err.message);
        }

        uomCacheRef.current[productId] = options;
        return options;
    };

     // ─── 3b. Fetch QtyOnHand dari M_StorageOnHand ────────────────────────────

     const fetchQtyOnHandBatch = async (productIds, config) => {
        const cfg         = config || posConfig;
        const warehouseId = cfg?.M_Warehouse_ID?.id ?? cfg?.M_Warehouse_ID;
        if (!warehouseId || productIds.length === 0) return new Map();

        const idList = productIds.join(',');
        const filter = `M_Warehouse_ID eq ${warehouseId} and IsActive eq true` +
                    ` and M_Product_ID in (${idList})`;

        try {
            const res = await customFetch(
                `/models/m_storage?$filter=${filter}&$select=M_Product_ID,QtyOnHand`
            );
            const map = new Map();
            (res.records || []).forEach(r => {
                const pid = r.M_Product_ID?.id ?? r.M_Product_ID;
                const existing = map.get(pid) ?? 0;
                map.set(pid, existing + parseFloat(r.QtyOnHand || 0));
            });
            return map;
        } catch {
            return new Map();
        }
    };
        


    const addToCart = async (product) => {
        // Flag untuk mendeteksi apakah produk berupa Jasa/Service ('S')
        const productTypeId = product.ProductType?.id ?? product.ProductType;
        const isService = productTypeId === 'S';
        console.log('Apakah produk ini layanan?:', isService, '| ProductType raw:', product.ProductType);
        
        let qtyOnHand = 0;
    
        // 1. Ambil nilai akumulasi stok terbaru HANYA jika BUKAN produk Jasa
        if (!isService) {
            // Ambil ID produk (antisipasi jika berupa objek atau langsung ID)
            const productId = product.M_Product_ID?.id ?? product.M_Product_ID;
            
            // Panggil fungsi batch dengan membungkus ID ke dalam array [productId]
            const stockMap = await fetchQtyOnHandBatch([productId]);
            
            // Ambil nilai dari Map, jika tidak ada set ke 0
            qtyOnHand = stockMap.get(productId) ?? 0;
    
            // 2. Validasi awal jika stok benar-benar kosong atau minus
            if (qtyOnHand <= 0) {
                triggerAlert(
                    `Stok produk "${product.Name}" habis (QtyOnHand = ${qtyOnHand}). Produk tidak dapat ditambahkan ke keranjang.`,
                    "Stok Habis"
                );
                return;
            }
        }
    
        // 3. Hitung jumlah item yang akan dipesan (Akan bertambah 1)
        const existingIndex = cart.findIndex(item => item.M_Product_ID === product.M_Product_ID);
        const existingQty = existingIndex >= 0 ? cart[existingIndex]. QtyEntered : 0;
        const targetQty = existingQty + 1;
    
        // 4. Validasi batas stok HANYA jika BUKAN produk Jasa
        if (!isService && targetQty > qtyOnHand) {
            triggerAlert(
                `Stok "${product.Name}" tidak mencukupi. Tersedia: ${qtyOnHand}, di keranjang: ${existingQty}.`,
                "Stok Tidak Cukup"
            );
            return;
        }
    
        // 5. Interupsi jika harga produk belum ditentukan
        if (product.PriceActual === 0) {
            triggerConfirm(product);
            return;
        }
    
        // 6. Ambil data satuan unit (UOM)
        const uomOptions  = await fetchUOMOptions(product);
        const selectedUOM = uomOptions[0];
    
        // 7. Perbarui State Cart
        if (existingIndex >= 0) {
            setCart(prev => prev.map((item, i) =>
                i === existingIndex
                    ? { ...item, QtyEntered: targetQty, QtyOnHand: isService ? 0 : qtyOnHand }
                    : item
            ));
        } else {
            setCart(prev => [...prev, {
                ...product,
                QtyOrdered:  1,
                uomOptions,
                selectedUOM,
                QtyOnHand:   isService ? 0 : qtyOnHand,
            }]);
        }
    };

    // ─── 5. Handler confirm untuk dialog mode "confirm" ───────────────────────
    const handleDialogConfirm = async () => {
        const product    = dialog.product;
        const uomOptions = await fetchUOMOptions(product);
        setCart(prev => [...prev, {
            ...product,
            QtyEntered:  1,
            PriceActual: product.PriceActual,
            basePrice:   product.PriceActual,
            uomOptions,
            selectedUOM: uomOptions[0],
        }]);
        closeDialog();
    };

    // ─── 6. Cart handlers ─────────────────────────────────────────────────────
    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.M_Product_ID !== id));

    const calculateTotal = () => cart.reduce((s, i) => s + (i.PriceActual * i.QtyEnyrred), 0);

    const updateCartQty = (productId, newQty) => {
    setCart(prev => {
        const item = prev.find(i => i.M_Product_ID === productId);
        if (!item) return prev;

        const qtyOnHand = item.QtyOnHand ?? Infinity; // fallback jika tidak tersedia
     
             if (newQty > qtyOnHand) {
                 // Tampilkan alert tapi jangan update state dulu
                 // Gunakan setTimeout agar setCart selesai dulu baru triggerAlert
                 setTimeout(() => {
                     triggerAlert(
                         `Kuantitas melebihi stok tersedia untuk "${item.Name}". Stok tersedia: ${qtyOnHand}.`,
                         "Stok Tidak Cukup"
                     );
                 }, 0);
                 return prev; // Batalkan update
             }
     
             if (newQty <= 0) {
                 return prev.filter(i => i.M_Product_ID !== productId);
             }
     
             return prev.map(i =>
                 i.M_Product_ID === productId
                     ? { ...i, QtyEntered: newQty }
                     : i
             );
         });
     };

    const updateCartPrice = (id, value) => {
        const price = parseFloat(value);
        if (isNaN(price) || price < 0) return;
        setCart(prev => prev.map(i => i.M_Product_ID === id ? { ...i, PriceActual: price } : i));
    };

    const updateCartUOM = (id, uomOption) => {
        setCart(prev => prev.map(item => {
            if (item.M_Product_ID !== id) return item;
            return {
                ...item,
                selectedUOM: uomOption,
                PriceActual: item.basePrice / uomOption.multiplyRate,
            };
        }));
    };

    // ─── 7. Search ────────────────────────────────────────────────────────────

    // Ambil priceListId aktif (helper internal)
    const getActivePriceListId = () =>
        selectedPriceList?.id || posConfig?.M_PriceList_ID?.id || posConfig?.M_PriceList_ID;

    // 7a. Fetch produk by barcode — cari exact match di field Value (SKU/barcode iDempiere)
    //     Juga coba field UPC/EAN jika tersedia (m_product_gtin atau field UPC).
    const fetchProductByBarcode = async (barcode) => {
        const priceListId = getActivePriceListId();
        if (!priceListId) return null;

        // Ambil versi aktif price list
        const versionRes = await customFetch(
            `/models/m_pricelist_version?$filter=M_PriceList_ID eq ${priceListId} and IsActive eq true&$orderby=ValidFrom desc&$top=1`
        );
        const versionId = versionRes?.records?.[0]?.id
                       || versionRes?.records?.[0]?.M_PriceList_Version_ID?.id
                       || versionRes?.records?.[0]?.M_PriceList_Version_ID;
        if (!versionId) return null;

        // Cari produk exact match di field Value (barcode/SKU) — case-insensitive
        const safeBarcode = barcode.replace(/'/g, "''");
        const productRes  = await customFetch(
            `/models/m_product?$select=M_Product_ID,Name,Value,ProductType,C_UOM_ID&$filter=IsSold eq true and IsActive eq true and toupper(Value) eq '${safeBarcode.toUpperCase()}'&$top=1`
        );
        const productRec = productRes?.records?.[0];
        if (!productRec) return null;

        const pId = productRec.M_Product_ID?.id ?? productRec.M_Product_ID ?? productRec.id;

        // Ambil harga dari price list version
        const priceRes = await customFetch(
            `/models/m_productprice?$filter=M_PriceList_Version_ID eq ${versionId} and M_Product_ID eq ${pId}&$select=M_Product_ID,PriceStd&$top=1`
        );
        const priceRec = priceRes?.records?.[0];

        const defaultUOM = {
            id:           productRec.C_UOM_ID?.id ?? productRec.C_UOM_ID,
            name:         productRec.C_UOM_ID?.Name || productRec.C_UOM_ID?.identifier || 'EA',
            multiplyRate: 1,
        };

        return {
            M_Product_ID: pId,
            Name:         productRec.Name,
            Value:        productRec.Value,
            PriceActual:  priceRec?.PriceStd ?? 0,
            basePrice:    priceRec?.PriceStd ?? 0,
            defaultUOM,
        };
    };

    // 7b. onChange — debounce biasa untuk pencarian teks (ketik manual)
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchValue(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchProducts(val, getActivePriceListId());
        }, 400);
    };

    // 7c. onKeyDown — deteksi Enter untuk barcode scanner maupun keyboard manual
    //     Alur:
    //       1. Coba exact match barcode (field Value) — cocok untuk scan barcode fisik
    //       2. Jika tidak ketemu, fetch pencarian teks (Name/Value contains)
    //       3. Tepat 1 hasil → auto addToCart + reset input (fokus kembali ke search)
    //       4. > 1 hasil    → tampilkan di grid, biarkan user pilih
    //       5. 0 hasil      → alert "tidak ditemukan"
    const handleSearchEnter = async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();

        const val = searchValue.trim();
        if (!val) return;

        // Batalkan debounce onChange yang mungkin sedang antri
        clearTimeout(debounceRef.current);

        const priceListId = getActivePriceListId();

        const resetSearch = () => {
            setSearchValue("");
            fetchProducts("", priceListId);
            // Kembalikan fokus ke input agar siap scan berikutnya
            setTimeout(() => searchRef.current?.focus(), 50);
        };

        try {
            // ── Langkah 1: barcode exact match ───────────────────────────────
            const barcodeProduct = await fetchProductByBarcode(val);
            if (barcodeProduct) {
                await addToCart(barcodeProduct);
                resetSearch();
                return;
            }

            // ── Langkah 2: fetch pencarian teks — ambil hasil langsung ───────
            // Tidak pakai setProducts dulu agar kita bisa cek panjang array
            // sebelum memutuskan auto-add vs tampilkan grid.
            const safeQuery = val.toUpperCase().replace(/'/g, "''");
            const productFilter = `IsSold eq true and IsActive eq true and (contains(toupper(Name),'${safeQuery}') or contains(toupper(Value),'${safeQuery}'))`;

            const versionRes = await customFetch(
                `/models/m_pricelist_version?$filter=M_PriceList_ID eq ${priceListId} and IsActive eq true&$orderby=ValidFrom desc&$top=1`
            );
            const versionId = versionRes?.records?.[0]?.id
                           || versionRes?.records?.[0]?.M_PriceList_Version_ID?.id
                           || versionRes?.records?.[0]?.M_PriceList_Version_ID;

            if (!versionId) {
                triggerAlert("Price List version tidak ditemukan.", "Error");
                return;
            }

            const [priceData, productData] = await Promise.all([
                customFetch(`/models/m_productprice?$filter=M_PriceList_Version_ID eq ${versionId}&$select=M_Product_ID,PriceStd`),
                customFetch(`/models/m_product?$select=M_Product_ID,Name,Value,C_UOM_ID&$filter=${productFilter}&$top=50`),
            ]);

            const priceMap = new Map();
            (Array.isArray(priceData.records) ? priceData.records : []).forEach(p => {
                const pid = p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id;
                if (pid != null) priceMap.set(pid, p.PriceStd);
            });

            const matched = (Array.isArray(productData.records) ? productData.records : [])
                .map(p => {
                    const pId   = p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id;
                    const price = priceMap.get(pId);
                    if (price === undefined) return null;
                    return {
                        M_Product_ID: pId,
                        Name:         p.Name,
                        Value:        p.Value,
                        PriceActual:  price ?? 0,
                        basePrice:    price ?? 0,
                        defaultUOM: {
                            id:           p.C_UOM_ID?.id ?? p.C_UOM_ID,
                            name:         p.C_UOM_ID?.Name || p.C_UOM_ID?.identifier || 'EA',
                            multiplyRate: 1,
                        },
                    };
                })
                .filter(Boolean);

            // ── Langkah 3: keputusan berdasarkan jumlah hasil ─────────────────
            if (matched.length === 1) {
                // Tepat 1 → langsung masuk cart + reset input
                await addToCart(matched[0]);
                resetSearch();
            } else if (matched.length === 0) {
                // Tidak ada → alert, input tetap terisi agar kasir bisa koreksi
                triggerAlert(`Produk "${val}" tidak ditemukan di Price List aktif.`, "Tidak Ditemukan");
            } else {
                // > 1 hasil → tampilkan di grid, biarkan user pilih dengan klik
                setProducts(matched);
            }

        } catch (err) {
            console.error("handleSearchEnter error:", err.message);
            triggerAlert("Gagal mencari produk: " + err.message, "Error");
        }
    };

    // ─── 8. Prepare payload ───────────────────────────────────────────────────
    const preparePayloadForIdempiere = () => {
        if (!posConfig) throw new Error("Konfigurasi C_POS belum dimuat.");

        const extractId = (field) => {
            const extracted = field?.id?.id ?? field?.id ?? (typeof field === 'number' ? field : undefined);
            const parsed = parseInt(extracted);
            return isNaN(parsed) ? null : parsed;
        };

        const toIdMurni = (field, name) => {
            const result = extractId(field);
            if (result === null) {
                console.warn(`Peringatan: Field ${name} tidak memiliki ID numerik valid.`, field);
            }
            return result;
        };

        const adClientId  = toIdMurni(posConfig.AD_Client_ID, "AD_Client_ID");
        const adOrgId     = toIdMurni(posConfig.AD_Org_ID, "AD_Org_ID");
        const bPartnerId  = selectedBPartner?.id ?? toIdMurni(posConfig.C_BPartner_ID, "C_BPartner_ID");
        const warehouseId = toIdMurni(posConfig.M_Warehouse_ID, "M_Warehouse_ID");
        const docTypeId   = toIdMurni(posConfig.C_DocType_ID, "C_DocType_ID");
        const priceListId = selectedPriceList?.id ?? toIdMurni(posConfig.M_PriceList_ID, "M_PriceList_ID");
        const salesRepId  = toIdMurni(posConfig.SalesRep_ID, "SalesRep_ID");

        // FIX: posConfig.id adalah sumber ID terminal POS yang valid (posConfig.C_POS_ID = undefined)
        const posId = extractId(posConfig.id)
                   ?? extractId(posConfig.C_POS_ID)
                   ?? extractId(posConfig);

        if (!bPartnerId)  throw new Error("C_BPartner_ID tidak valid. Isi field Business Partner pada setup POS.");
        if (!docTypeId)   throw new Error("C_DocType_ID tidak valid di konfigurasi POS.");
        if (!warehouseId) throw new Error("M_Warehouse_ID tidak valid di konfigurasi POS.");
        if (!posId) {
            console.warn("⚠️ Peringatan: C_POS_ID tidak ditemukan dari semua sumber (C_POS_ID, id).");
            throw new Error("C_POS_ID tidak valid. Pastikan variabel state posConfig memuat ID Terminal POS.");
        }

        const formattedLines = cart.map((item) => {
            const line = {
                AD_Org_ID:    { id: adOrgId },
                M_Product_ID: { id: parseInt(item.M_Product_ID?.id ?? item.M_Product_ID) },
                QtyEntered:   parseFloat(item.QtyOrdered || 1),
                PriceActual:  parseFloat(item.PriceActual || 0),
                PriceEntered: parseFloat(item.PriceActual || 0),
            };

            const uomId = toIdMurni(item.selectedUOM, "C_UOM_ID");
            if (uomId) line.C_UOM_ID = { id: uomId };

            return line;
        });

        const todayISO = new Date().toISOString().split('T')[0];

        const payload = {
            AD_Client_ID:       { id: adClientId },
            AD_Org_ID:          { id: adOrgId },
            C_DocTypeTarget_ID: { id: docTypeId }, // DocType tujuan (untuk header)
            C_DocType_ID:       { id: docTypeId }, // DocType aktif — wajib diisi eksplisit agar tidak 0/"** New **"
            C_BPartner_ID:      { id: bPartnerId },
            M_Warehouse_ID:     { id: warehouseId },
            M_PriceList_ID:     { id: priceListId },
            DateOrdered:        todayISO,
            DatePromised:       todayISO, // Wajib eksplisit — iDempiere pakai ini sebagai movement date saat cek stok
            PaymentRule:        "M",
            c_orderline:        formattedLines,
            IsSOTrx:            "Y",
            Description:        "POS Transaction",
            C_POS_ID:           { id: posId },
        };

        if (salesRepId) payload.SalesRep_ID = { id: salesRepId };

        return payload;
    };


     const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
     const [currentOrderData, setCurrentOrderData]     = useState(null);
     const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
     const [receiptData, setReceiptData]               = useState(null);
     //handle checkout
     const handleCheckout = async () => {
         if (cart.length === 0) { triggerAlert("Keranjang masih kosong!"); return; }
     
         setIsProcessingCheckout(true);
         try {
             let orderId;
             let createdOrder;
     
             if (isEditMode && editOrderId) {
                 // ── MODE EDIT: update order yang sudah ada ────────────────────
                 console.log(`Mode Edit: Mengupdate Order ID ${editOrderId}...`);
     
                 // Update header order jika BPartner/PriceList berubah
                 await customFetch(`/models/c_order/${editOrderId}`, {
                     method: "PUT",
                     body: JSON.stringify({
                         C_BPartner_ID:  { id: selectedBPartner?.id },
                         M_PriceList_ID: { id: selectedPriceList?.id },
                     }),
                 });
     
                 // Hapus semua order line lama
                 const oldLinesRes = await customFetch(
                     `/models/c_orderline?$filter=C_Order_ID eq ${editOrderId}&$select=C_OrderLine_ID`
                 );
                 const oldLines = Array.isArray(oldLinesRes.records) ? oldLinesRes.records : [];
                 for (const line of oldLines) {
                     const lineId = line.id ?? line.C_OrderLine_ID;
                     await customFetch(`/models/c_orderline/${lineId}`, { method: "DELETE" });
                 }
     
                 // Insert ulang order lines dari cart
                 const adOrgId = posConfig?.AD_Org_ID?.id ?? posConfig?.AD_Org_ID;
                 for (const item of cart) {
                     await customFetch("/models/c_orderline", {
                         method: "POST",
                         body: JSON.stringify({
                             C_Order_ID:   { id: editOrderId },
                             AD_Org_ID:    { id: adOrgId },
                             M_Product_ID: { id: parseInt(item.M_Product_ID) },
                             QtyEntered:   parseFloat(item.QtyOrdered || 1),
                             PriceActual:  parseFloat(item.PriceActual || 0),
                             PriceEntered: parseFloat(item.PriceActual || 0),
                             C_UOM_ID:     { id: item.selectedUOM?.id },
                         }),
                     });
                 }
     
                 orderId      = editOrderId;
                 createdOrder = await customFetch(`/models/c_order/${editOrderId}`);
     
             } else {
                 // ── MODE NORMAL: buat order baru ─────────────────────────────
                 const orderPayload = preparePayloadForIdempiere();
                 createdOrder       = await customFetch("/models/c_order", {
                     method: "POST",
                     body: JSON.stringify(orderPayload),
                 });
                 orderId = createdOrder.id || createdOrder.C_Order_ID;
             }
     
             if (!orderId) throw new Error("Gagal mengambil C_Order_ID dari server.");
     
             console.log(`✅ Order siap (ID: ${orderId}). Membuka payment...`);
             setCurrentOrderData(createdOrder);
             setIsPaymentModalOpen(true);
     
         } catch (err) {
             console.error("Proses POS Checkout Gagal:", err.message);
             triggerAlert("Checkout Gagal: " + err.message, "Error");
         } finally {
             setIsProcessingCheckout(false);
         }
     };
     //handle proses pembayaran
     const handleCompletePOSPaymentWorkflow = async (cleanPaymentsArray) => {

        if (!currentOrderData) return;

        const orderId    = currentOrderData.id || currentOrderData.C_Order_ID;
        const adClientId = currentOrderData.AD_Client_ID?.id ?? currentOrderData.AD_Client_ID;
        const adOrgId    = currentOrderData.AD_Org_ID?.id    ?? currentOrderData.AD_Org_ID;

        try {
            console.log("Memulai pengiriman multi-baris C_POSPayment...");

            for (const payment of cleanPaymentsArray) {
                const rawTenderId = payment.C_POSTenderType_ID;
                if (!rawTenderId || isNaN(parseInt(rawTenderId))) {
                    console.warn("Melewati baris pembayaran kosong/tidak valid.");
                    continue;
                }

                const paymentPayload = {
                    AD_Client_ID:       { id: parseInt(adClientId) },
                    AD_Org_ID:          { id: parseInt(adOrgId) },
                    C_Order_ID:         { id: parseInt(orderId) },
                    PayAmt:             parseFloat(payment.PayAmt || 0),
                    TenderType:         String(payment.TenderType || "X"),
                    C_POSTenderType_ID: { id: parseInt(rawTenderId) },
                };

                console.log("Mengirim baris pembayaran aman:", JSON.stringify(paymentPayload));
                await customFetch("/models/c_pospayment", {
                    method: "POST",
                    body: JSON.stringify(paymentPayload),
                });
            }

            console.log("✅ Data C_POSPayment tersimpan. Menentukan aturan pembayaran final...");

            let finalPaymentRule = "M";
            if (cleanPaymentsArray?.length === 1) {
                const singleTender = cleanPaymentsArray[0]?.TenderType;
                if (singleTender === "X") finalPaymentRule = "B";
                else if (singleTender === "K") finalPaymentRule = "K";
                else if (singleTender === "D") finalPaymentRule = "T";
            }

            await customFetch(`/models/c_order/${orderId}`, {
                method: "PUT",
                body: JSON.stringify({ PaymentRule: finalPaymentRule }),
            });

            console.log(`✅ Aturan pembayaran diset ke [${finalPaymentRule}]. Mengunci transaksi ke Complete...`);

            const completedOrder = await customFetch(`/models/c_order/${orderId}`, {
                method: "PUT",
                body: JSON.stringify({ "doc-action": "CO" }),
            });

            const finalDocNo = completedOrder.DocumentNo || currentOrderData.DocumentNo || orderId;
               
               // Tambah ini
               setReceiptData({
                   documentNo:   finalDocNo,
                   date:         new Date().toLocaleString("id-ID"),
                   posName:      posConfig?.Name || "POS Terminal",
                   cashierName:  posConfig?.SalesRep_ID?.identifier || "-",
                   bPartnerName: selectedBPartner?.name || "-",
                   items:        [...cart],
                   total:        calculateTotal(),
                   payments:     cleanPaymentsArray,  // ← langsung pakai parameter fungsi
               });
               
               setIsPaymentModalOpen(false);
               setCurrentOrderData(null);
               setCart([]);
               setIsEditMode(false);
               setEditOrderId(null);
               setIsReceiptModalOpen(true);

        } catch (err) {
            console.error("Proses Pembayaran POS Gagal:", err.message);
            triggerAlert("Eror saat memproses pembayaran final: " + err.message, "Error");
        }
    };

    if (loading && !posConfig) return <p style={{ padding: '20px' }}>Loading Config POS...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', fontFamily: 'Arial, sans-serif', height: '100vh', boxSizing: 'border-box', overflow: 'hidden' }}>

            {/* ─── Unified Dialog ───────────────────────────────────────────────
                mode "confirm" → ConfirmModal dengan dua tombol (Tambahkan / Batal)
                mode "alert"   → ConfirmModal tanpa tombol Confirm (hanya Tutup)
            ──────────────────────────────────────────────────────────────────── */}
            <ConfirmModal
                isOpen={dialog.isOpen}
                title={dialog.title}
                message={
                    dialog.mode === "confirm" ? (
                        <>
                            Produk <strong>{dialog.product?.Name}</strong> tidak memiliki harga
                            di Price List yang dipilih.<br /><br />
                            Tetap tambahkan ke cart dengan harga Rp 0?
                        </>
                    ) : (
                        <span style={{ whiteSpace: 'pre-line' }}>{dialog.message}</span>
                    )
                }
                confirmLabel={dialog.mode === "confirm" ? "OK, Tambahkan" : null}
                cancelLabel={dialog.mode === "confirm" ? "Batal" : "Tutup"}
                onConfirm={dialog.mode === "confirm" ? handleDialogConfirm : null}
                onCancel={closeDialog}
            />

            {/* Config Bar */}
            <div style={{ background: '#f0f4ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #c5d0e8', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>

                    <div style={{ display: 'flex', gap: '16px', color: '#555', flexShrink: 0 }}>
                        <span><strong>POS:</strong> {posConfig?.Name || '...'}</span>
                        <span><strong>SalesRep:</strong> {posConfig?.SalesRep_ID?.id ?? posConfig?.SalesRep_ID ?? '-'}</span>
                        <span><strong>Version:</strong> {currentVersionId
                            ? <span style={{ color: '#2e7d32' }}>{currentVersionId}</span>
                            : <span style={{ color: '#c62828' }}>Not Found</span>}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                        <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#333' }}>Customer:</label>
                        <select
                            value={selectedBPartner?.id || ''}
                            onChange={handleBPartnerChange}
                            style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px', background: selectedBPartner ? '#fff' : '#fff3f3', color: '#333' }}
                        >
                            <option value="">-- Pilih Customer --</option>
                            {bPartnerList.map(bp => (
                                <option key={bp.id} value={bp.id}>{bp.name}</option>
                            ))}
                        </select>
                        {!selectedBPartner && (
                            <span style={{ color: '#c62828', fontSize: '11px', whiteSpace: 'nowrap' }}>⚠ Wajib diisi</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                        <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#333' }}>Price List:</label>
                        <select
                            value={selectedPriceList?.id || ''}
                            onChange={handlePriceListChange}
                            disabled={loading}
                            style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px', background: '#fff', color: '#333' }}
                        >
                            <option value="">-- Pilih Price List --</option>
                            {priceListList.map(pl => (
                                <option key={pl.id} value={pl.id}>{pl.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Layout */}
            <div style={{ display: 'flex', gap: '0px', flex: '1', overflow: 'hidden' }}>

                {/* Kiri: Search + Product Grid */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', paddingRight: '20px', overflow: 'hidden' }}>
                    {/* Banner Edit Mode */}
                    {isEditMode && (
                        <div style={{
                            backgroundColor: "#fff3e0",
                            border: "1px solid #f57c00",
                            borderRadius: "6px",
                            padding: "8px 14px",
                            marginBottom: "10px",
                            fontSize: "13px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}>
                            <span>✏️ <strong>Mode Edit</strong> — Draft Order ID: {editOrderId}</span>
                            <button
                                onClick={() => {
                                    setIsEditMode(false);
                                    setEditOrderId(null);
                                    setCart([]);
                                    navigate("/pos", { replace: true, state: {} });
                                }}
                                style={{ background: "none", border: "1px solid #f57c00", color: "#f57c00", borderRadius: "4px", padding: "3px 10px", cursor: "pointer", fontSize: "12px" }}
                            >
                                Batalkan Edit
                            </button>
                        </div>
                    )}
                    <h3 style={{ margin: '0 0 10px 0' }}>Product Catalog</h3>
                    <SearchBar
                        value={searchValue}
                        onChange={handleSearchChange}
                        onKeyDown={handleSearchEnter}
                        inputRef={searchRef}
                        disabled={versionMissing}
                        placeholder="Cari nama / kode produk, atau scan barcode lalu Enter..."
                    />
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        {loading ? (
                            <p>Memuat produk...</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                {products.length > 0
                                    ? products.map((p, index) => (
                                        <ProductCard
                                            key={`${p.M_Product_ID}-${index}`}
                                            product={p}
                                            onClick={addToCart}
                                        />
                                    ))
                                    : !versionMissing && (
                                        <p style={{ gridColumn: 'span 3', textAlign: 'center', color: '#999' }}>
                                            Tidak ada produk ditemukan dengan harga aktif.
                                        </p>
                                    )
                                }
                            </div>
                        )}
                    </div>
                </div>

                {/* CONTAINER UTAMA CART */}
                <div style={{ 
                    flex: 1, 
                    borderLeft: '1px solid #ddd', 
                    paddingLeft: '20px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    minWidth: '280px',
                    overflow: 'hidden',
                    minHeight: 0    // Mencegah container utama ikut memanjang ke bawah
                }}>
                    <h3 style={{ margin: '0 0 10px 0', flexShrink: 0 }}>🛒 Cart</h3>
                    
                    {/* WRAPPER CART ITEM (HANYA BAGIAN INI YANG SCROLL) */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: 0 }}>
                        {cart.length === 0 && <p style={{ color: '#999' }}>Keranjang kosong</p>}
                        {cart.map((item, index) => (
                            <CartItem
                                key={`${item.M_Product_ID}-${index}`}
                                item={item}
                                onRemove={removeFromCart}
                                onQtyChange={updateCartQty}
                                onPriceChange={updateCartPrice}
                                onUOMChange={updateCartUOM}
                            />
                        ))}
                    </div>
                    
                    {/* SECTION PEMBAYARAN (FIXED DI BAWAH) */}
                    {cart.length > 0 && (
                        <div style={{ borderTop: '1px solid #ddd', paddingTop: '12px', marginTop: '8px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '15px', fontWeight: 'bold' }}>
                                <span>Total:</span>
                                <span style={{ color: '#2e7d32' }}>Rp {calculateTotal().toLocaleString('id-ID')}</span>
                            </div>
                            <button
                                onClick={handleCheckout}
                                disabled={isProcessingCheckout}
                                style={{ background: isProcessingCheckout ? '#aaa' : '#28a745', color: 'white', border: 'none', padding: '14px', width: '100%', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: isProcessingCheckout ? 'not-allowed' : 'pointer' }}
                            >
                                {isProcessingCheckout ? 'Memproses...' : 'PROSES BAYAR'}
                            </button>
                        </div>
                    )}
                </div>

                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    totalOrderAmount={calculateTotal()}
                    onSubmitPayment={handleCompletePOSPaymentWorkflow}
                    customFetch={customFetch}
                />
               <ReceiptModal
                   isOpen={isReceiptModalOpen}
                   onClose={() => setIsReceiptModalOpen(false)}
                   receiptData={receiptData}
               />
            </div>
        </div>
    );
};

export default POSContainer;
