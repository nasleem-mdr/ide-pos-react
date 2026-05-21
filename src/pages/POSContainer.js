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
    const [editOrderId, setEditOrderId] = useState(null);
    const [isEditMode, setIsEditMode]   = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // ─── Unified Dialog State ─────────────────────────────────────────────────
    const DIALOG_CLOSED = {
        isOpen: false,
        mode: "alert",
        title: "",
        message: "",
        product: null,
        onConfirmAction: null
    };
    const [dialog, setDialog] = useState(DIALOG_CLOSED);

    const triggerAlert = (message, title = "Perhatian", onConfirmAction = null) => {
        setDialog({
            isOpen: true,
            mode: "alert",
            title,
            message,
            product: null,
            onConfirmAction
        });
    };

    const triggerConfirm = (product) => {
        setDialog({
            isOpen: true,
            mode: "confirm",
            title: "Produk Tanpa Harga",
            message: null,
            product,
            onConfirmAction: null
        });
    };

    const closeDialog = () => setDialog(DIALOG_CLOSED);

    // State untuk combobox C_BPartner dan M_PriceList di config bar
    const [bPartnerList, setBPartnerList]   = useState([]);
    const [priceListList, setPriceListList] = useState([]);
    const [selectedBPartner, setSelectedBPartner] = useState(null);
    const [selectedPriceList, setSelectedPriceList] = useState(null);

    const API_BASE    = "/api/v1";
    const debounceRef = useRef(null);
    const uomCacheRef = useRef({});
    const searchRef   = useRef(null);
    const [searchValue, setSearchValue] = useState("");

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
        if (!posConfig) return;

        const editOrder = location.state?.editOrder;
        if (!editOrder) return;

        const loadDraftOrder = async () => {
            try {
                setLoading(true);
                const orderId = editOrder.id ?? editOrder.C_Order_ID;
                setEditOrderId(orderId);
                setIsEditMode(true);

                const bpId   = editOrder.C_BPartner_ID?.id ?? editOrder.C_BPartner_ID;
                const bpName = editOrder.C_BPartner_ID?.identifier || editOrder.C_BPartner_ID?.Name || `BPartner #${bpId}`;
                if (bpId) setSelectedBPartner({ id: bpId, name: bpName });

                const plId   = editOrder.M_PriceList_ID?.id ?? editOrder.M_PriceList_ID;
                const plName = editOrder.M_PriceList_ID?.identifier || `PriceList #${plId}`;
                if (plId) setSelectedPriceList({ id: plId, name: plName });

                const linesRes = await customFetch(
                    `/models/c_orderline?$filter=C_Order_ID eq ${orderId}` +
                    `&$select=C_OrderLine_ID,M_Product_ID,QtyOrdered,PriceActual,PriceEntered,C_UOM_ID`
                );
                const lines = Array.isArray(linesRes.records) ? linesRes.records : [];

                const cartItems = lines.map((line) => {
                    const productId   = line.M_Product_ID?.id   ?? line.M_Product_ID;
                    const productName = line.M_Product_ID?.identifier || line.M_Product_ID?.Name || `Product #${productId}`;
                    const uomId       = line.C_UOM_ID?.id   ?? line.C_UOM_ID;
                    const uomName     = line.C_UOM_ID?.identifier || line.C_UOM_ID?.Name || "EA";
                    const price       = parseFloat(line.PriceActual || line.PriceEntered || 0);
                    const qty         = parseFloat(line.QtyOrdered || 1);
                    const lineId      = line.id ?? line.C_OrderLine_ID;

                    const selectedUOM = { id: uomId, name: uomName, multiplyRate: 1 };

                    return {
                        C_OrderLine_ID: lineId,
                        M_Product_ID:   productId,
                        Name:           productName,
                        Value:          "",
                        PriceActual:    price,
                        basePrice:      price,
                        QtyOrdered:     qty,
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
    }, [posConfig]);

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

    // ─── 2. [OPTIMIZED] Batch fetch QtyOnHand (1 request untuk semua produk) ──
    // Menggantikan pola N+1 sebelumnya yang memanggil fetchQtyOnHand per produk.
    // Jika backend TIDAK support filter "in (...)", lihat fetchQtyOnHandFallback di bawah.
    const fetchQtyOnHandBatch = async (productIds, config) => {
        const cfg         = config || posConfig;
        const warehouseId = cfg?.M_Warehouse_ID?.id ?? cfg?.M_Warehouse_ID;

        if (!warehouseId || !productIds || productIds.length === 0) {
            return new Map();
        }

        try {
            const idList = productIds.join(',');
            const filter = `M_Warehouse_ID eq ${warehouseId} and IsActive eq true` +
                           ` and M_Product_ID in (${idList})`;

            const res = await customFetch(
                `/models/m_storage?$filter=${filter}&$select=M_Product_ID,QtyOnHand`
            );

            const map = new Map();
            (res.records || []).forEach(r => {
                const pid = r.M_Product_ID?.id ?? r.M_Product_ID;
                if (pid != null) {
                    // Akumulasi jika produk muncul di beberapa storage location
                    const existing = map.get(pid) ?? 0;
                    map.set(pid, existing + parseFloat(r.QtyOnHand || 0));
                }
            });
            return map;
        } catch (err) {
            console.warn("Gagal batch fetch QtyOnHand:", err.message);
            // Fallback ke map kosong agar produk tetap tampil meski tanpa qty
            return new Map();
        }
    };

    // ─── 2b. [FALLBACK] Jika backend tidak support "in (...)" filter ──────────
    // Gunakan fungsi ini sebagai pengganti fetchQtyOnHandBatch jika diperlukan.
    // Tetap lebih baik dari sebelumnya karena bisa di-cache dan tidak re-fetch saat checkout.
    const fetchQtyOnHandFallback = async (productIds, config) => {
        const cfg         = config || posConfig;
        const warehouseId = cfg?.M_Warehouse_ID?.id ?? cfg?.M_Warehouse_ID;

        if (!warehouseId || !productIds || productIds.length === 0) {
            return new Map();
        }

        // Jalankan semua request secara paralel (Promise.all), bukan sequential
        const results = await Promise.allSettled(
            productIds.map(async (pid) => {
                try {
                    const filter = `M_Warehouse_ID eq ${warehouseId} and M_Product_ID eq ${pid} and IsActive eq true`;
                    const res    = await customFetch(
                        `/models/m_storage?$filter=${filter}&$select=M_Product_ID,QtyOnHand`
                    );
                    const total = (res.records || []).reduce(
                        (sum, r) => sum + parseFloat(r.QtyOnHand || 0), 0
                    );
                    return { pid, qty: total };
                } catch {
                    return { pid, qty: 0 };
                }
            })
        );

        const map = new Map();
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                map.set(result.value.pid, result.value.qty);
            }
        });
        return map;
    };

    // ─── 3. [OPTIMIZED] Fetch products ───────────────────────────────────────
    // Perubahan utama:
    //   - Price + Product fetch berjalan PARALEL (Promise.all)
    //   - QtyOnHand di-fetch SEKALI untuk semua produk (batch), bukan N kali
    //   - priceMap hanya diisi untuk produk yang relevan (filter by relevantIds)
    const fetchProducts = async (query = "", priceListId = null, terminalConfig = null) => {
        try {
            setLoading(true);
            setVersionMissing(false);

            const config           = terminalConfig || posConfig;
            const rawPriceId       = priceListId || config?.M_PriceList_ID;
            const finalPriceListId = typeof rawPriceId === 'object' ? rawPriceId?.id : rawPriceId;
            if (!finalPriceListId) { console.error("PriceList ID tidak ditemukan"); return; }

            // ── Step 1: Ambil version aktif (harus duluan karena jadi dependency) ─
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
            setVersionMissing(false);

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

            // ── Step 3: Build priceMap, filter hanya untuk produk relevan ────────
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

            // ── Step 4: Batch fetch QtyOnHand (1 request, bukan N request) ───────
            // Ganti ke fetchQtyOnHandFallback jika backend tidak support filter "in (...)"
            const productIds   = [...relevantIds];
            const qtyOnHandMap = await fetchQtyOnHandBatch(productIds, config);

            // ── Step 5: Mapping ke format final ──────────────────────────────────
            const finalProducts = productRecords.map((p) => {
                const pId   = p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id;
                const price = priceMap.get(pId);
                if (price === undefined) return null; // Produk tidak ada di pricelist → skip

                const defaultUOM = {
                    id:           p.C_UOM_ID?.id ?? p.C_UOM_ID,
                    name:         p.C_UOM_ID?.Name || p.C_UOM_ID?.identifier || 'EA',
                    multiplyRate: 1,
                };

                const category = {
                    id:   p.M_Product_Category_ID?.id ?? p.M_Product_Category_ID,
                    name: p.M_Product_Category_ID?.Name || p.M_Product_Category_ID?.identifier || 'N/A',
                };

                return {
                    M_Product_ID:    pId,
                    Name:            p.Name,
                    Value:           p.Value,
                    PriceActual:     price ?? 0,
                    basePrice:       price ?? 0,
                    defaultUOM,
                    ProductCategory: category,
                    ProductType:     p.ProductType?.id ?? p.ProductType ?? null,
                    QtyOnHand:       qtyOnHandMap.get(pId) ?? 0,
                };
            }).filter(Boolean);

            console.log("✅ finalProducts length:", finalProducts.length);
            setProducts(finalProducts);

        } catch (err) {
            console.error("Fetch Products Error:", err.message);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    // ─── 4. Fetch UOM options untuk satu produk ───────────────────────────────
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

        // Fetch UOM spesifik produk + UOM global secara PARALEL
        const [resProduct, resGlobal] = await Promise.allSettled([
            customFetch(
                `/models/c_uom_conversion?$filter=C_UOM_ID eq ${defaultUomId}` +
                ` and M_Product_ID eq ${productId} and IsActive eq true` +
                `&$select=C_UOM_ID,C_UOM_To_ID,MultiplyRate,M_Product_ID`
            ),
            customFetch(
                `/models/c_uom_conversion?$filter=C_UOM_ID eq ${defaultUomId}` +
                ` and IsActive eq true` +
                `&$select=C_UOM_ID,C_UOM_To_ID,MultiplyRate,M_Product_ID&$top=50`
            ),
        ]);

        if (resProduct.status === 'fulfilled') {
            buildOptions(Array.isArray(resProduct.value.records) ? resProduct.value.records : []);
        } else {
            console.warn("Gagal fetch UOM spesifik produk", productId, resProduct.reason?.message);
        }

        if (resGlobal.status === 'fulfilled') {
            buildOptions(Array.isArray(resGlobal.value.records) ? resGlobal.value.records : []);
        } else {
            console.warn("Gagal fetch UOM global", resGlobal.reason?.message);
        }

        uomCacheRef.current[productId] = options;
        return options;
    };

    // ─── 5. Search handler dengan debounce ───────────────────────────────────
    const handleSearch = (query) => {
        setSearchValue(query);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchProducts(query, selectedPriceList?.id);
        }, 400);
    };

    // ─── 6. Add to cart ───────────────────────────────────────────────────────
    const handleAddToCart = async (product) => {
        if (product.PriceActual === 0) {
            triggerConfirm(product);
            return;
        }
        addProductToCart(product);
    };

    const addProductToCart = async (product) => {
        const uomOptions = await fetchUOMOptions(product);
        setCart(prev => {
            const existing = prev.find(item => item.M_Product_ID === product.M_Product_ID);
            if (existing) {
                return prev.map(item =>
                    item.M_Product_ID === product.M_Product_ID
                        ? { ...item, QtyOrdered: item.QtyOrdered + 1 }
                        : item
                );
            }
            return [...prev, {
                ...product,
                QtyOrdered:  1,
                uomOptions,
                selectedUOM: product.defaultUOM,
            }];
        });
    };

    // ─── 7. Cart operations ───────────────────────────────────────────────────
    const handleUpdateQty = (productId, newQty) => {
        if (newQty <= 0) {
            handleRemoveFromCart(productId);
            return;
        }
        setCart(prev =>
            prev.map(item =>
                item.M_Product_ID === productId
                    ? { ...item, QtyOrdered: newQty }
                    : item
            )
        );
    };

    const handleRemoveFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.M_Product_ID !== productId));
    };

    const handleUpdatePrice = (productId, newPrice) => {
        setCart(prev =>
            prev.map(item =>
                item.M_Product_ID === productId
                    ? { ...item, PriceActual: parseFloat(newPrice) || 0 }
                    : item
            )
        );
    };

    const handleUpdateUOM = (productId, selectedUOM) => {
        setCart(prev =>
            prev.map(item => {
                if (item.M_Product_ID !== productId) return item;
                const newPrice = item.basePrice * (selectedUOM.multiplyRate ?? 1);
                return { ...item, selectedUOM, PriceActual: newPrice };
            })
        );
    };

    const handleClearCart = () => {
        setCart([]);
    };

    // ─── 8. Hitung total ──────────────────────────────────────────────────────
    const cartTotal = cart.reduce(
        (sum, item) => sum + (item.PriceActual * item.QtyOrdered), 0
    );

    // ─── 9. Checkout / Submit Order ──────────────────────────────────────────
    const handleCheckout = async () => {
        if (cart.length === 0) {
            triggerAlert("Keranjang masih kosong.", "Perhatian");
            return;
        }
        if (!selectedBPartner?.id) {
            triggerAlert("Pilih customer terlebih dahulu.", "Perhatian");
            return;
        }

        try {
            setIsProcessingCheckout(true);

            const orderLines = cart.map(item => ({
                M_Product_ID: item.M_Product_ID,
                QtyOrdered:   item.QtyOrdered,
                PriceActual:  item.PriceActual,
                PriceEntered: item.PriceActual,
                C_UOM_ID:     item.selectedUOM?.id ?? item.defaultUOM?.id,
            }));

            if (isEditMode && editOrderId) {
                // ─── Update existing draft order ───────────────────────────
                await customFetch(`/models/c_order/${editOrderId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        C_BPartner_ID:  selectedBPartner.id,
                        M_PriceList_ID: selectedPriceList.id,
                    }),
                });

                // Hapus semua line lama, lalu buat ulang
                const existingLines = await customFetch(
                    `/models/c_orderline?$filter=C_Order_ID eq ${editOrderId}&$select=C_OrderLine_ID`
                );
                await Promise.all(
                    (existingLines.records || []).map(line =>
                        customFetch(`/models/c_orderline/${line.id ?? line.C_OrderLine_ID}`, {
                            method: 'DELETE',
                        })
                    )
                );

                await Promise.all(
                    orderLines.map(line =>
                        customFetch(`/models/c_orderline`, {
                            method: 'POST',
                            body: JSON.stringify({ ...line, C_Order_ID: editOrderId }),
                        })
                    )
                );

                triggerAlert("Order berhasil diperbarui.", "Sukses");
                setCart([]);
                setIsEditMode(false);
                setEditOrderId(null);

            } else {
                // ─── Buat order baru ───────────────────────────────────────
                const orderRes = await customFetch(`/models/c_order`, {
                    method: 'POST',
                    body: JSON.stringify({
                        C_BPartner_ID:  selectedBPartner.id,
                        M_PriceList_ID: selectedPriceList.id,
                        C_POS_ID:       posConfig?.id ?? posConfig?.C_POS_ID,
                        IsSOTrx:        true,
                        DocStatus:      'DR',
                    }),
                });

                const newOrderId = orderRes.id ?? orderRes.C_Order_ID;

                await Promise.all(
                    orderLines.map(line =>
                        customFetch(`/models/c_orderline`, {
                            method: 'POST',
                            body: JSON.stringify({ ...line, C_Order_ID: newOrderId }),
                        })
                    )
                );

                triggerAlert(`Order #${newOrderId} berhasil dibuat.`, "Sukses");
                setCart([]);
            }

        } catch (err) {
            console.error("Checkout error:", err.message);
            triggerAlert("Gagal memproses order: " + err.message, "Error");
        } finally {
            setIsProcessingCheckout(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Memuat POS...</p>
            </div>
        );
    }

    return (
        <div className="pos-container">

            {/* ── Config Bar ─────────────────────────────────────────────── */}
            <div className="pos-config-bar">
                <div className="config-field">
                    <label>Customer</label>
                    <select
                        value={selectedBPartner?.id || ""}
                        onChange={handleBPartnerChange}
                    >
                        <option value="">-- Pilih Customer --</option>
                        {bPartnerList.map(bp => (
                            <option key={bp.id} value={bp.id}>{bp.name}</option>
                        ))}
                    </select>
                </div>

                <div className="config-field">
                    <label>Price List</label>
                    <select
                        value={selectedPriceList?.id || ""}
                        onChange={handlePriceListChange}
                    >
                        <option value="">-- Pilih Price List --</option>
                        {priceListList.map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                        ))}
                    </select>
                </div>

                {isEditMode && (
                    <div className="edit-mode-badge">
                        ✏️ Edit Order #{editOrderId}
                        <button onClick={() => {
                            setIsEditMode(false);
                            setEditOrderId(null);
                            setCart([]);
                        }}>Batal Edit</button>
                    </div>
                )}
            </div>

            {/* ── Main Area ──────────────────────────────────────────────── */}
            <div className="pos-main">

                {/* Produk */}
                <div className="pos-products">
                    <SearchBar
                        ref={searchRef}
                        value={searchValue}
                        onChange={handleSearch}
                        placeholder="Cari produk (nama / kode)..."
                    />

                    {versionMissing ? (
                        <div className="version-missing-warning">
                            ⚠️ Tidak ada versi price list aktif. Produk tidak dapat ditampilkan.
                        </div>
                    ) : (
                        <div className="product-grid">
                            {products.map(product => (
                                <ProductCard
                                    key={product.M_Product_ID}
                                    product={product}
                                    onAdd={() => handleAddToCart(product)}
                                />
                            ))}
                            {products.length === 0 && (
                                <p className="no-products">Tidak ada produk ditemukan.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Keranjang */}
                <div className="pos-cart">
                    <h3>Keranjang {isEditMode ? `(Edit #${editOrderId})` : ""}</h3>

                    {cart.length === 0 ? (
                        <p className="cart-empty">Keranjang kosong</p>
                    ) : (
                        <>
                            <div className="cart-items">
                                {cart.map(item => (
                                    <CartItem
                                        key={item.M_Product_ID}
                                        item={item}
                                        onUpdateQty={(qty) => handleUpdateQty(item.M_Product_ID, qty)}
                                        onRemove={() => handleRemoveFromCart(item.M_Product_ID)}
                                        onUpdatePrice={(price) => handleUpdatePrice(item.M_Product_ID, price)}
                                        onUpdateUOM={(uom) => handleUpdateUOM(item.M_Product_ID, uom)}
                                    />
                                ))}
                            </div>

                            <div className="cart-footer">
                                <div className="cart-total">
                                    <span>Total:</span>
                                    <strong>{cartTotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</strong>
                                </div>
                                <div className="cart-actions">
                                    <button
                                        className="btn-clear"
                                        onClick={handleClearCart}
                                        disabled={isProcessingCheckout}
                                    >
                                        Kosongkan
                                    </button>
                                    <button
                                        className="btn-checkout"
                                        onClick={handleCheckout}
                                        disabled={isProcessingCheckout}
                                    >
                                        {isProcessingCheckout
                                            ? "Memproses..."
                                            : isEditMode ? "Simpan Perubahan" : "Checkout"
                                        }
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Modals ─────────────────────────────────────────────────── */}
            {dialog.isOpen && dialog.mode === "confirm" && (
                <ConfirmModal
                    isOpen={dialog.isOpen}
                    title={dialog.title}
                    product={dialog.product}
                    onConfirm={() => {
                        closeDialog();
                        addProductToCart(dialog.product);
                    }}
                    onCancel={closeDialog}
                />
            )}

            {dialog.isOpen && dialog.mode === "alert" && (
                <ConfirmModal
                    isOpen={dialog.isOpen}
                    title={dialog.title}
                    message={dialog.message}
                    mode="alert"
                    onClose={() => {
                        closeDialog();
                        if (typeof dialog.onConfirmAction === 'function') {
                            dialog.onConfirmAction();
                        }
                    }}
                />
            )}
        </div>
    );
};

export default POSContainer;
