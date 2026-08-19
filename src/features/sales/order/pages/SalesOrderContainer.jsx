import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { useSalesOrderSubmit }    from '@/features/sales/order/hooks/useSalesOrderSubmit';
import { useSalesShipmentSubmit } from '@/features/sales/order/hooks/useSalesShipmentSubmit';
import { ConfirmModal, CartItemPOS } from '@/features/sales/order/components';
import { ProductCard, SearchBar, ScanIcon, ProductGrid, CartPanel, CartSidebar, BarcodeScanner } from '@/shared/components';
import { useAccess } from '@/context/AccessContext';
import { idempiereApi, fkId } from '@/api/idempiereApi';
import { useIsDesktop, useScannerInput, getLoginInfo,useOrgInfo } from '@/shared/hooks';
import SalesOrderSuccessModal from '@/features/sales/order/components/SalesOrderSuccessModal';

// ─────────────────────────────────────────────────────────────────────────────
// SalesOrderContainer.jsx
// Standard Order untuk customer datang ambil barang di lokasi — BUKAN POS.
// Order → Complete → Shipment otomatis dibuat & Complete. TIDAK ada Payment
// atau Invoice di sini — penagihan dilakukan via proses BATCH akhir bulan
// di luar aplikasi ini (PaymentRule 'P' / On Credit).
//
// Diadaptasi dari POSContainer.jsx (product grid, search, cart, UOM, stok)
// tapi sumber Warehouse/DocType BUKAN dari C_POS — dipilih manual, sama
// pola seperti resolusi Warehouse+Locator di PurchasingContainer.jsx.
// ─────────────────────────────────────────────────────────────────────────────
const SalesOrderContainer = () => {
    // ─── State dasar ────────────────────────────────────────────────────────
    const [cart, setCart]       = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentVersionId, setCurrentVersionId] = useState(null);
    const [versionMissing, setVersionMissing]     = useState(false);

    // ─── Konfigurasi khusus Sales Order (bukan C_POS) ─────────────────────
    const [salesDocTypes, setSalesDocTypes]   = useState([]);
    const [docTypeId, setDocTypeId]           = useState(null);
    const [warehouses, setWarehouses]         = useState([]);
    const [warehouseInfo, setWarehouseInfo]   = useState(null);
    const [defaultLocatorId, setDefaultLocatorId] = useState(null);

    const [bPartnerList, setBPartnerList]   = useState([]);
    const [priceListList, setPriceListList] = useState([]);
    const [selectedBPartner, setSelectedBPartner]   = useState(null);
    const [selectedPriceList, setSelectedPriceList] = useState(null);
    const [successModal, setSuccessModal] = useState(null); 
    const { orgInfo } = useOrgInfo();
    const { submitOrder, completeOrder, isSubmitting: isSubmittingOrder } =
        useSalesOrderSubmit({ docTypeId, description: 'Sales Order - Batch Invoice', onError: (msg, title) => triggerAlert(msg, title) });
    const { createShipmentFromOrder, isSubmitting: isSubmittingShipment } = useSalesShipmentSubmit();

    const [editOrderId, setEditOrderId] = useState(null);
    const [isEditMode, setIsEditMode]   = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const { canEdit } = useAccess();
    const canSubmitSalesOrder = canEdit('salesOrder'); // sesuaikan key access map kamu
    const [scannerOpen, setScannerOpen] = useState(false);
    const [offset, setOffset]           = useState(0);
    const [hasMore, setHasMore]         = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const pageSize = 20;

    const DIALOG_CLOSED = { isOpen: false, mode: "alert", title: "", message: "", product: null, onConfirmAction: null };
    const [dialog, setDialog] = useState(DIALOG_CLOSED);
    const triggerAlert = (message, title = "Perhatian", onConfirmAction = null) => {
        setDialog({ isOpen: true, mode: "alert", title, message, product: null, onConfirmAction });
    };
    const triggerConfirm = (product) => {
        setDialog({ isOpen: true, mode: "confirm", title: "Produk Tanpa Harga", message: null, product, onConfirmAction: null });
    };
    const closeDialog = () => setDialog(DIALOG_CLOSED);

    const uomCacheRef = useRef({});

    // ─── 1. Init: DocType SOO, Warehouse+Locator, Customer, PriceList ────────
    useEffect(() => {
        const init = async () => {
            try {
                const { orgId } = getLoginInfo();
                if (!orgId) { triggerAlert("Organisasi aktif tidak ditemukan di sesi login. Coba login ulang."); setLoading(false); return; }

                // ── DocType Sales Order (DocBaseType SOO) ──────────────────
                const dtRes = await idempiereApi(
                    `/models/c_doctype?$select=C_DocType_ID,Name&$filter=DocBaseType eq 'SOO' and IsActive eq true&$orderby=Name`
                );
                const dtList = (dtRes.records || []).map(d => ({ id: fkId(d.C_DocType_ID) ?? d.id, name: d.Name }));
                setSalesDocTypes(dtList);
                const standard = dtList.find(d => /standard/i.test(d.name));
                const initialDocTypeId = (standard || dtList[0])?.id ?? null;
                setDocTypeId(initialDocTypeId);
                if (!initialDocTypeId) {
                    triggerAlert("Tidak ada Document Type Sales Order (DocBaseType 'SOO') aktif ditemukan.", "Konfigurasi Tidak Lengkap");
                }

                // ── Warehouse (pola sama seperti PurchasingContainer) ──────
                const whRes = await idempiereApi(
                    `/models/m_warehouse?$select=M_Warehouse_ID,Name&$filter=IsActive eq true and AD_Org_ID eq ${orgId}&$orderby=Name&$top=50`
                );
                const whList = (whRes.records || []).map(w => ({ id: fkId(w.M_Warehouse_ID) ?? w.id, name: w.Name }));
                setWarehouses(whList);
                const { warehouseId: loginWarehouseId } = getLoginInfo();
                const defaultWh = whList.find(w => String(w.id) === String(loginWarehouseId)) ?? whList[0] ?? null;
                setWarehouseInfo(defaultWh);

                if (defaultWh?.id) {
                    await resolveLocatorForWarehouse(defaultWh.id);
                }

                await Promise.all([fetchBPartnerOptions(), fetchPriceListOptions()]);
                const [, priceListChosen] = await Promise.all([fetchBPartnerOptions(), fetchPriceListOptions()]);
                setOffset(0);
                await fetchProducts("", priceListChosen?.id, "replace", 0);  
                
            } catch (err) {
                console.error("Error init SalesOrderContainer:", err.message);
                triggerAlert("Gagal memuat konfigurasi: " + err.message, "Error");
            } finally {
                setLoading(false);
            }
        };
        init().catch((err) => {
            if (err?.name === 'AbortError') return;
            console.error("init gagal:", err.message);
        });
    }, []);

    const resolveLocatorForWarehouse = async (warehouseId) => {
        try {
            const defRes = await idempiereApi(
                `/models/m_locator?$select=M_Locator_ID&$filter=M_Warehouse_ID eq ${warehouseId} and IsDefault eq true and IsActive eq true&$top=1`
            );
            const defRecords = Array.isArray(defRes.records) ? defRes.records : [];
            if (defRecords.length > 0) {
                setDefaultLocatorId(fkId(defRecords[0].M_Locator_ID) ?? defRecords[0].id);
                return;
            }
            const anyRes = await idempiereApi(
                `/models/m_locator?$select=M_Locator_ID&$filter=M_Warehouse_ID eq ${warehouseId} and IsActive eq true&$top=1`
            );
            const anyRecords = Array.isArray(anyRes.records) ? anyRes.records : [];
            setDefaultLocatorId(anyRecords[0] ? (fkId(anyRecords[0].M_Locator_ID) ?? anyRecords[0].id) : null);
        } catch {
            setDefaultLocatorId(null);
        }
    };

    const handleWarehouseChange = async (e) => {
        const id   = parseInt(e.target.value, 10);
        const name = e.target.options[e.target.selectedIndex].text;
        setWarehouseInfo({ id, name });
        await resolveLocatorForWarehouse(id);
        setOffset(0);
        await fetchProducts(searchInput, selectedPriceList?.id, "replace", 0);
    };

    // ─── Load draft order untuk mode edit (dikirim dari SalesOrderList) ─────
    useEffect(() => {
        const editOrder = location.state?.editOrder;
        if (!editOrder) return;

        const loadDraftOrder = async () => {
            try {
                setLoading(true);
                const orderId = editOrder.id ?? editOrder.C_Order_ID;
                setEditOrderId(orderId);
                setIsEditMode(true);

                const bpId   = editOrder.C_BPartner_ID?.id ?? editOrder.C_BPartner_ID;
                const bpName = editOrder.C_BPartner_ID?.identifier || `BPartner #${bpId}`;
                if (bpId) setSelectedBPartner({ id: bpId, name: bpName });

                const plId   = editOrder.M_PriceList_ID?.id ?? editOrder.M_PriceList_ID;
                const plName = editOrder.M_PriceList_ID?.identifier || `PriceList #${plId}`;
                if (plId) setSelectedPriceList({ id: plId, name: plName });

                const whId   = editOrder.M_Warehouse_ID?.id ?? editOrder.M_Warehouse_ID;
                const whName = editOrder.M_Warehouse_ID?.identifier || `WH #${whId}`;
                if (whId) {
                    setWarehouseInfo({ id: whId, name: whName });
                    await resolveLocatorForWarehouse(whId);
                }

                const dtId = editOrder.C_DocType_ID?.id ?? editOrder.C_DocType_ID;
                if (dtId) setDocTypeId(dtId);

                const linesRes = await idempiereApi(
                    `/models/c_orderline?$filter=C_Order_ID eq ${orderId}` +
                    `&$select=C_OrderLine_ID,M_Product_ID,QtyEntered,PriceActual,PriceEntered,C_UOM_ID`
                );
                const lines = Array.isArray(linesRes.records) ? linesRes.records : [];

                const cartItems = lines.map((line) => {
                    const productId   = line.M_Product_ID?.id   ?? line.M_Product_ID;
                    const productName = line.M_Product_ID?.identifier || `Product #${productId}`;
                    const uomId       = line.C_UOM_ID?.id   ?? line.C_UOM_ID;
                    const uomName     = line.C_UOM_ID?.identifier || "EA";
                    const price       = parseFloat(line.PriceActual || line.PriceEntered || 0);
                    const qty         = parseFloat(line.QtyEntered || 1);
                    const selectedUOM = { id: uomId, name: uomName, multiplyRate: 1 };

                    return {
                        C_OrderLine_ID: line.id ?? line.C_OrderLine_ID,
                        M_Product_ID:   productId,
                        Name:           productName,
                        PriceEntered:   price,
                        basePrice:      price,
                        Qty:            qty,
                        QtyEntered:     qty,
                        defaultUOM:     selectedUOM,
                        uomOptions:     [selectedUOM],
                        selectedUOM,
                    };
                });
                setCart(cartItems);
            } catch (err) {
                console.error("Gagal load draft Sales Order:", err.message);
                triggerAlert("Gagal memuat draft Sales Order: " + err.message, "Error");
            } finally {
                setLoading(false);
            }
        };

        loadDraftOrder().catch((err) => {
            if (err?.name === 'AbortError') return;
            console.error("Gagal load draft Sales Order:", err.message);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // ─── Fetch opsi Customer (customer aktif, bukan vendor) ─────────────────
    const fetchBPartnerOptions = async () => {
        try {
            const res = await idempiereApi(
                `/models/c_bpartner?$filter=IsActive eq true and IsCustomer eq true&$select=C_BPartner_ID,Name&$orderby=Name&$top=100`
            );
            const records = Array.isArray(res.records) ? res.records : [];
            setBPartnerList(records.map(bp => ({
                id: bp.C_BPartner_ID?.id ?? bp.C_BPartner_ID ?? bp.id,
                name: bp.Name,
            })).filter(o => o.id));
        } catch (err) {
            console.warn("Gagal fetch BPartner list:", err.message);
        }
    };

    const fetchPriceListOptions = async () => {
        try {
            const res = await idempiereApi(
                `/models/m_pricelist?$filter=IsActive eq true and IsSOPriceList eq true` +
                `&$select=M_PriceList_ID,Name&$orderby=Name&$top=50`
            );
            const records = Array.isArray(res.records) ? res.records : [];
            const options = records.map(pl => ({
                id: pl.M_PriceList_ID?.id ?? pl.M_PriceList_ID ?? pl.id,
                name: pl.Name,
            })).filter(o => o.id);
            setPriceListList(options);
    
            const chosen = selectedPriceList || options[0] || null;
            if (!selectedPriceList && chosen) setSelectedPriceList(chosen);
            return chosen;                     // ← WAJIB return, ini kuncinya
        } catch (err) {
            console.warn("Gagal fetch PriceList:", err.message);
            return null;
        }
    };

    const handleBPartnerChange = (e) => {
        const id   = parseInt(e.target.value, 10);
        const name = e.target.options[e.target.selectedIndex].text;
        setSelectedBPartner({ id, name });
    };

    const handlePriceListChange = async (e) => {
        const id   = parseInt(e.target.value, 10);
        const name = e.target.options[e.target.selectedIndex].text;
        setSelectedPriceList({ id, name });
        setOffset(0);
        try {
            await fetchProducts("", id, "replace", 0);
        } catch (err) {
            if (err?.name !== 'AbortError') console.error(err);
        }
    };

    const handleDocTypeChange = (e) => setDocTypeId(parseInt(e.target.value, 10));

    // ─── Price list version resolver (sama seperti POS) ─────────────────────
    const fetchActiveVersionId = async (priceListId, signal) => {
        const versionRes = await idempiereApi(
            `/models/m_pricelist_version?$filter=M_PriceList_ID eq ${priceListId} and IsActive eq true&$orderby=ValidFrom desc&$top=1`,
            { signal }
        );
        return versionRes?.records?.[0]?.id
            || versionRes?.records?.[0]?.M_PriceList_Version_ID?.id
            || versionRes?.records?.[0]?.M_PriceList_Version_ID
            || null;
    };

    const getActivePriceListId = () => selectedPriceList?.id;

    // ── Search + Scan (sama pola POS) ────────────────────────────────────────
    const {
        value: searchInput, inputRef: scanInputRef,
        handleChange: handleSearchInputChange, handleKeyDown: handleSearchKeyDown, reset: resetSearchInput,
    } = useScannerInput({
        onScanDetected: (code) => handleBarcodeDetectedRef.current(code),
        onManualSearch: (value) => {
            setOffset(0);
            fetchProducts(value, getActivePriceListId(), 'replace', 0)
                .catch((err) => { if (err?.name !== 'AbortError') console.error(err); });
        },
    });

    const fetchProductByBarcode = async (barcode) => {
        const priceListId = getActivePriceListId();
        if (!priceListId) return null;
        const versionId = await fetchActiveVersionId(priceListId);
        if (!versionId) return null;

        const safeBarcode = barcode.replace(/'/g, "''").toUpperCase();
        const productRes = await idempiereApi(
            `/models/m_product?$select=M_Product_ID,Name,Value,UPC,ProductType,C_UOM_ID` +
            `&$filter=IsSold eq true and IsActive eq true and ` +
            `(toupper(Value) eq '${safeBarcode}' or toupper(UPC) eq '${safeBarcode}')&$top=1`
        );
        const productRec = productRes?.records?.[0];
        if (!productRec) return null;
        const pId = productRec.M_Product_ID?.id ?? productRec.M_Product_ID ?? productRec.id;

        const priceRes = await idempiereApi(
            `/models/m_productprice?$filter=M_PriceList_Version_ID eq ${versionId} and M_Product_ID eq ${pId}&$select=M_Product_ID,PriceStd&$top=1`
        );
        const priceRec = priceRes?.records?.[0];

        return {
            M_Product_ID: pId,
            Name: productRec.Name,
            Value: productRec.Value,
            UPC: productRec.UPC,
            PriceActual: priceRec?.PriceStd ?? 0,
            basePrice: priceRec?.PriceStd ?? 0,
            ProductType: productRec.ProductType?.id ?? productRec.ProductType ?? null,
            defaultUOM: {
                id: productRec.C_UOM_ID?.id ?? productRec.C_UOM_ID,
                name: productRec.C_UOM_ID?.Name || productRec.C_UOM_ID?.identifier || 'EA',
                multiplyRate: 1,
            },
        };
    };

    const handleBarcodeDetected = useCallback(async (code) => {
        setScannerOpen(false);
        const trimmed = code.trim();
        if (!trimmed) return;
        const priceListId = getActivePriceListId();

        try {
            const barcodeProduct = await fetchProductByBarcode(trimmed);
            if (barcodeProduct) {
                await addToCart(barcodeProduct);
                resetSearchInput();
                setOffset(0);
                await fetchProducts('', priceListId, 'replace', 0);
                scanInputRef.current?.focus();
                return;
            }
            setOffset(0);
            await fetchProducts(trimmed, priceListId, 'replace', 0);
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.error('Gagal proses barcode:', err.message);
            triggerAlert('Gagal memproses barcode: ' + err.message, 'Error');
        }
    }, [cart, selectedPriceList, warehouseInfo, resetSearchInput]);

    const handleBarcodeDetectedRef = useRef(handleBarcodeDetected);
    useEffect(() => { handleBarcodeDetectedRef.current = handleBarcodeDetected; }, [handleBarcodeDetected]);

    const resolveProducts = async (productFilter, versionId, signal, top = 20, skip = 0) => {
        const [priceData, productData] = await Promise.all([
            idempiereApi(`/models/m_productprice?$filter=M_PriceList_Version_ID eq ${versionId}&$select=M_Product_ID,PriceStd`, { signal }),
            idempiereApi(`/models/m_product?$select=M_Product_ID,Name,Value,UPC,C_UOM_ID,M_Product_Category_ID,ProductType&$filter=${productFilter}&$top=${top}&$skip=${skip}`, { signal }),
        ]);

        const productRecords = Array.isArray(productData.records) ? productData.records : productData.records ? [productData.records] : [];
        const relevantIds = new Set(productRecords.map(p => p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id));
        const rawPriceRecords = Array.isArray(priceData.records) ? priceData.records : priceData.records ? [priceData.records] : [];

        const priceMap = new Map();
        rawPriceRecords.filter(p => relevantIds.has(p.M_Product_ID?.id ?? p.M_Product_ID)).forEach(p => {
            const pid = p.M_Product_ID?.id ?? p.M_Product_ID;
            if (pid != null) priceMap.set(pid, p.PriceStd);
        });

        const productIds   = [...relevantIds];
        const qtyOnHandMap = await fetchQtyOnHandBatch(productIds);

        const list = productRecords.map((p) => {
            const pId  = p.M_Product_ID?.id ?? p.M_Product_ID ?? p.id;
            const price = priceMap.get(pId);
            if (price === undefined) return null;
            const uomName = p.C_UOM_ID?.Name || p.C_UOM_ID?.identifier || 'EA';
            return {
                M_Product_ID: pId, Name: p.Name, Value: p.Value,
                PriceActual: price ?? 0, basePrice: price ?? 0, C_UOM_Name: uomName,
                defaultUOM: { id: p.C_UOM_ID?.id ?? p.C_UOM_ID, name: uomName, multiplyRate: 1 },
                ProductCategory: { id: p.M_Product_Category_ID?.id ?? p.M_Product_Category_ID, name: p.M_Product_Category_ID?.Name || 'N/A' },
                ProductType: p.ProductType?.id ?? p.ProductType ?? null,
                QtyOnHand: qtyOnHandMap.get(pId) ?? 0,
            };
        }).filter(Boolean);

        return { list, count: productRecords.length };
    };

    const isDesktop = useIsDesktop();
    const abortRef = useRef(null);
    const MAX_SCAN_ROUNDS = 10;

    const fetchProducts = async (query = "", priceListId = null, mode = "replace", currentOffset = 0) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        mode === "append" ? setLoadingMore(true) : setLoading(true);

        try {
            setVersionMissing(false);
            const finalPriceListId = priceListId || selectedPriceList?.id;
            if (!finalPriceListId) { setProducts([]); setHasMore(false); return; }

            const versionId = await fetchActiveVersionId(finalPriceListId, controller.signal);
            if (!versionId) {
                setCurrentVersionId("NOT_FOUND"); setVersionMissing(true); setProducts([]); setHasMore(false);
                return;
            }
            setCurrentVersionId(versionId);

            let productFilter = "IsSold eq true and IsActive eq true";
            if (query) {
                const safeQuery = query.toUpperCase().replace(/'/g, "''");
                productFilter += ` and (contains(toupper(Name),'${safeQuery}') or contains(toupper(Value),'${safeQuery}') or contains(toupper(UPC),'${safeQuery}'))`;
            }

            let skip = currentOffset, collected = [], serverExhausted = false;
            for (let round = 0; round < MAX_SCAN_ROUNDS; round++) {
                const { list, count } = await resolveProducts(productFilter, versionId, controller.signal, pageSize, skip);
                skip += count;
                collected = collected.concat(list);
                if (count < pageSize) { serverExhausted = true; break; }
                if (collected.length > 0) break;
            }

            setOffset(skip);
            setProducts(prev => mode === "append" ? [...prev, ...collected] : collected);
            setHasMore(!serverExhausted);
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error("Fetch Products Error:", err.message);
            if (mode !== "append") setProducts([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const loadMore = useCallback(() => {
        fetchProducts(searchInput, getActivePriceListId(), "append", offset)
            .catch((err) => { if (err?.name !== 'AbortError') console.error("loadMore gagal:", err.message); });
    }, [offset, searchInput, selectedPriceList]);

    const fetchUOMOptions = async (product) => {
        const productId = product.M_Product_ID;
        if (uomCacheRef.current[productId]) return uomCacheRef.current[productId];

        const defaultUomId   = product.defaultUOM?.id ?? null;
        const defaultUomName = product.defaultUOM?.name || 'EA';
        const defaultOption  = { id: defaultUomId, name: defaultUomName, multiplyRate: 1 };
        if (!defaultUomId) { uomCacheRef.current[productId] = [defaultOption]; return [defaultOption]; }

        const options = [defaultOption];
        const buildOptions = (records) => {
            records.forEach(conv => {
                const toId   = conv.C_UOM_To_ID?.id  ?? conv.C_UOM_To_ID;
                const toName = conv.C_UOM_To_ID?.Name || conv.C_UOM_To_ID?.identifier || `UOM #${toId}`;
                const rate   = conv.MultiplyRate ?? 1;
                if (toId && !options.find(o => o.id === toId)) options.push({ id: toId, name: toName, multiplyRate: rate });
            });
        };
        try {
            const resProduct = await idempiereApi(`/models/c_uom_conversion?$filter=C_UOM_ID eq ${defaultUomId} and M_Product_ID eq ${productId} and IsActive eq true&$select=C_UOM_ID,C_UOM_To_ID,MultiplyRate,M_Product_ID`);
            buildOptions(Array.isArray(resProduct.records) ? resProduct.records : []);
        } catch (err) { console.warn("Gagal fetch UOM spesifik produk", productId, err.message); }
        try {
            const resGlobal = await idempiereApi(`/models/c_uom_conversion?$filter=C_UOM_ID eq ${defaultUomId} and IsActive eq true&$select=C_UOM_ID,C_UOM_To_ID,MultiplyRate,M_Product_ID&$top=50`);
            const globalRecords = (Array.isArray(resGlobal.records) ? resGlobal.records : []).filter(conv => !conv.M_Product_ID || conv.M_Product_ID === null);
            buildOptions(globalRecords);
        } catch (err) { console.warn("Gagal fetch UOM global untuk UOM", defaultUomId, err.message); }

        uomCacheRef.current[productId] = options;
        return options;
    };

    const fetchQtyOnHandBatch = async (productIds) => {
        const warehouseId = warehouseInfo?.id;
        if (!warehouseId || productIds.length === 0) return new Map();
        try {
            const locatorRes = await idempiereApi(`/models/m_locator?$filter=M_Warehouse_ID eq ${warehouseId} and IsActive eq true&$select=M_Locator_ID`);
            const locatorIds = (locatorRes.records || []).map(l => l.id ?? l.M_Locator_ID).filter(Boolean);
            if (locatorIds.length === 0) return new Map();

            const productOrClause = productIds.map(pid => `M_Product_ID eq ${pid}`).join(' or ');
            const locatorOrClause = locatorIds.map(lid => `M_Locator_ID eq ${lid}`).join(' or ');
            const filter = `(${locatorOrClause}) and IsActive eq true and (${productOrClause})`;
            const res = await idempiereApi(`/models/m_storage?$filter=${filter}&$select=M_Product_ID,QtyOnHand`);
            const map = new Map();
            (res.records || []).forEach(r => {
                const pid = r.M_Product_ID?.id ?? r.M_Product_ID;
                map.set(pid, (map.get(pid) ?? 0) + parseFloat(r.QtyOnHand || 0));
            });
            return map;
        } catch (err) {
            if (err.name === 'AbortError') return new Map();
            console.error("Gagal fetch QtyOnHand batch:", err.message);
            return new Map();
        }
    };

    const addToCart = async (product) => {
        const productTypeId = product.ProductType?.id ?? product.ProductType;
        const isService = productTypeId === 'S';
        let qtyOnHand = 0;

        if (!isService) {
            const productId = product.M_Product_ID?.id ?? product.M_Product_ID;
            const stockMap = await fetchQtyOnHandBatch([productId]);
            qtyOnHand = stockMap.get(productId) ?? 0;
            if (qtyOnHand <= 0) {
                triggerAlert(`Stok produk "${product.Name}" habis (QtyOnHand = ${qtyOnHand}).`, "Stok Habis");
                return;
            }
        }

        const existingIndex = cart.findIndex(item => item.M_Product_ID === product.M_Product_ID);
        const existingQty = existingIndex >= 0 ? cart[existingIndex].Qty : 0;
        const targetQty = existingQty + 1;

        if (!isService && targetQty > qtyOnHand) {
            triggerAlert(`Stok "${product.Name}" tidak mencukupi. Tersedia: ${qtyOnHand}, di keranjang: ${existingQty}.`, "Stok Tidak Cukup");
            return;
        }
        if (product.PriceActual === 0) { triggerConfirm(product); return; }

        const uomOptions  = await fetchUOMOptions(product);
        const selectedUOM = uomOptions[0];

        if (existingIndex >= 0) {
            setCart(prev => prev.map((item, i) => i === existingIndex ? { ...item, Qty: targetQty, QtyOnHand: isService ? 0 : qtyOnHand, isService } : item));
        } else {
            setCart(prev => [...prev, { ...product, Qty: 1, PriceEntered: product.PriceActual, basePrice: product.PriceActual, uomOptions, selectedUOM, QtyOnHand: isService ? 0 : qtyOnHand, isService }]);
        }
    };

    const handleDialogConfirm = async () => {
        const product    = dialog.product;
        const uomOptions = await fetchUOMOptions(product);
        setCart(prev => [...prev, { ...product, Qty: 1, PriceActual: product.PriceActual, basePrice: product.PriceActual, uomOptions, selectedUOM: uomOptions[0] }]);
        closeDialog();
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.M_Product_ID !== id));
    const calculateTotal = () => cart.reduce((s, i) => s + (i.PriceEntered * i.Qty), 0);

    const updateCartQty = (productId, rawQty) => {
        const newQty = parseFloat(rawQty);
        if (isNaN(newQty)) return;
        setCart(prev => {
            const item = prev.find(i => i.M_Product_ID === productId);
            if (!item) return prev;
            if (!item.isService) {
                const multiplyRate  = item.selectedUOM?.multiplyRate || 1;
                const qtyOnHandBase = item.QtyOnHand ?? Infinity;
                const qtyOrderedBase = newQty * multiplyRate;
                if (qtyOrderedBase > qtyOnHandBase) {
                    setTimeout(() => triggerAlert(`Kuantitas melebihi stok untuk "${item.Name}". Stok tersedia: ${qtyOnHandBase}.`, "Stok Tidak Cukup"), 0);
                    return prev;
                }
            }
            if (newQty <= 0) return prev.filter(i => i.M_Product_ID !== productId);
            return prev.map(i => i.M_Product_ID === productId ? { ...i, Qty: newQty } : i);
        });
    };

    const updateCartPrice = (id, value) => {
        const price = parseFloat(value);
        if (isNaN(price) || price < 0) return;
        setCart(prev => prev.map(i => i.M_Product_ID === id ? { ...i, PriceEntered: price } : i));
    };

    const updateCartUOM = (id, uomOption) => {
        setCart(prev => prev.map(item => item.M_Product_ID !== id ? item : {
            ...item, selectedUOM: uomOption, PriceEntered: item.basePrice / uomOption.multiplyRate,
        }));
    };

    // ─── Validasi bersama sebelum submit apa pun ─────────────────────────────
    const validateBeforeSubmit = () => {
        if (cart.length === 0) { triggerAlert("Keranjang masih kosong!"); return false; }
        if (!selectedBPartner) { triggerAlert("Customer wajib dipilih.", "Data Belum Lengkap"); return false; }
        if (!warehouseInfo?.id) { triggerAlert("Gudang belum ditentukan.", "Data Belum Lengkap"); return false; }
        if (!docTypeId) { triggerAlert("Document Type Sales Order belum dipilih.", "Data Belum Lengkap"); return false; }
        return true;
    };

    const resetAfterSuccess = () => {
        setCart([]);
        setIsEditMode(false);
        setEditOrderId(null);
        navigate(location.pathname, { replace: true, state: {} });
        setOffset(0);
        fetchProducts('', getActivePriceListId(), 'replace', 0);
    };

    // ─── DRAFT: buat/update Order saja, tidak Complete, tidak shipment ───────
    const handleSubmitDraft = async () => {
        if (!validateBeforeSubmit()) return;
        const result = await submitOrder(cart, {
            customerId: selectedBPartner.id,
            warehouseId: warehouseInfo.id,
            priceListId: selectedPriceList?.id,
            isEditMode, editOrderId,
        });
        if (!result) return;
        triggerAlert(`Sales Order tersimpan sebagai Draft (ID ${result.orderId}).`, "Berhasil");
        resetAfterSuccess();
    };

    // ─── COMPLETE: Order → Complete → Shipment otomatis dibuat & Complete ───
    const handleSubmitComplete = async () => {
        if (!validateBeforeSubmit()) return;
        if (!defaultLocatorId) {
            triggerAlert("Locator default untuk gudang ini belum ditemukan — Shipment tidak bisa dibuat otomatis. Cek setup Locator di Warehouse ini.", "Konfigurasi Tidak Lengkap");
            return;
        }
    
        const result = await submitOrder(cart, {
            customerId: selectedBPartner.id,
            warehouseId: warehouseInfo.id,
            priceListId: selectedPriceList?.id,
            isEditMode, editOrderId,
        });
        if (!result) return;
    
        try {
            const orderStatus = await completeOrder(result.orderId);
            const shipment = await createShipmentFromOrder(result.orderId, { locatorId: defaultLocatorId });
    
            setSuccessModal({
                orderDocNo:    orderStatus.documentNo,
                shipmentId:    shipment.shipmentId,
                shipmentDocNo: shipment.documentNo,
            });
            resetAfterSuccess();
        } catch (err) {
            console.error("Gagal proses Complete/Shipment:", err.message);
            triggerAlert(
                `Sales Order sudah berhasil Complete, tapi Shipment GAGAL dibuat:\n${err.message}\n\n` +
                `Order tidak hilang — buat Shipment manual dari window Shipment (Customer), pilih Order ini.`,
                "Order Complete, Shipment Gagal"
            );
            resetAfterSuccess();
        }
    };

    if (loading && !warehouseInfo) return <p style={{ padding: '20px' }}>Loading Sales Order...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', fontFamily: 'Arial, sans-serif', height: '100vh', boxSizing: 'border-box', overflow: 'hidden' }}>

            <ConfirmModal
                isOpen={dialog.isOpen}
                title={dialog.title}
                message={
                    dialog.mode === "confirm" ? (
                        <>Produk <strong>{dialog.product?.Name}</strong> tidak memiliki harga di Price List yang dipilih.<br /><br />Tetap tambahkan ke cart dengan harga Rp 0?</>
                    ) : (
                        <span style={{ whiteSpace: 'pre-line' }}>{dialog.message}</span>
                    )
                }
                confirmLabel={dialog.mode === "confirm" ? "OK, Tambahkan" : null}
                cancelLabel={dialog.mode === "confirm" ? "Batal" : "Tutup"}
                onConfirm={dialog.mode === "confirm" ? handleDialogConfirm : null}
                onCancel={closeDialog}
            />
            <SalesOrderSuccessModal
                isOpen={!!successModal}
                onClose={() => setSuccessModal(null)}
                orderDocNo={successModal?.orderDocNo}
                shipmentId={successModal?.shipmentId}
                shipmentDocNo={successModal?.shipmentDocNo}
                logoDataUrl={orgInfo?.logoUrl}
            />
            {/* Config Bar */}
            <div style={{ background: '#f0f4ff', padding: isDesktop ? '12px 16px' : '10px 12px', borderRadius: '8px', border: '1px solid #c5d0e8', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: isDesktop ? 'center' : 'stretch', gap: isDesktop ? '16px' : '10px', flexWrap: 'wrap', flexDirection: isDesktop ? 'row' : 'column' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '100%', minWidth: isDesktop ? '180px' : undefined }}>
                        <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#333' }}>Doc Type:</label>
                        <select value={docTypeId || ''} onChange={handleDocTypeChange} style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px' }}>
                            <option value="">-- Pilih --</option>
                            {salesDocTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '100%', minWidth: isDesktop ? '180px' : undefined }}>
                        <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#333' }}>Gudang:</label>
                        <select value={warehouseInfo?.id || ''} onChange={handleWarehouseChange} disabled={loading} style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px' }}>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '100%', minWidth: isDesktop ? '200px' : undefined }}>
                        <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#333' }}>Customer:</label>
                        <select value={selectedBPartner?.id || ''} onChange={handleBPartnerChange} style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px', background: selectedBPartner ? '#fff' : '#fff3f3' }}>
                            <option value="">-- Pilih Customer --</option>
                            {bPartnerList.map(bp => <option key={bp.id} value={bp.id}>{bp.name}</option>)}
                        </select>
                        {!selectedBPartner && <span style={{ color: '#c62828', fontSize: '11px', whiteSpace: 'nowrap' }}>⚠ Wajib</span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '100%', minWidth: isDesktop ? '200px' : undefined }}>
                        <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: '#333' }}>Price List:</label>
                        <select value={selectedPriceList?.id || ''} onChange={handlePriceListChange} disabled={loading} style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px' }}>
                            <option value="">-- Pilih Price List --</option>
                            {priceListList.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Layout */}
            <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: '0px', flex: '1', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0px', overflow: 'hidden', paddingRight: isDesktop ? '16px' : '0' }}>
                    {isEditMode && (
                        <div style={{ backgroundColor: "#fff3e0", border: "1px solid #f57c00", borderRadius: "6px", padding: "8px 14px", marginBottom: "10px", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>✏️ <strong>Mode Edit</strong> — Draft Order ID: {editOrderId}</span>
                            <button onClick={() => { setIsEditMode(false); setEditOrderId(null); setCart([]); navigate(location.pathname, { replace: true, state: {} }); }}
                                style={{ background: "none", border: "1px solid #f57c00", color: "#f57c00", borderRadius: "4px", padding: "3px 10px", cursor: "pointer", fontSize: "12px" }}>
                                Batalkan Edit
                            </button>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginBottom: '10px' }}>
                        <div style={{ flex: 1, display: 'flex' }}>
                            <SearchBar value={searchInput} onChange={handleSearchInputChange} onKeyDown={handleSearchKeyDown} inputRef={scanInputRef} disabled={versionMissing} placeholder="Cari nama / kode produk, atau scan barcode..." />
                        </div>
                        <button onClick={() => setScannerOpen(true)} title="Scan Barcode/QR"
                            style={{ background: '#1a237e', color: '#fff', border: 'none', borderRadius: '6px', width: '42px', height: '42px', flexShrink: 0, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ScanIcon />
                        </button>
                    </div>

                    <ProductGrid
                        products={products}
                        loading={loading}
                        loadingMore={loadingMore}
                        hasMore={hasMore}
                        fetchMore={loadMore}
                        onProductClick={addToCart}
                        isDesktop={isDesktop}
                        CardComponent={ProductCard}
                        emptyHint={versionMissing ? null : "Tidak ada produk ditemukan dengan harga aktif."}
                    />
                </div>

                {isDesktop ? (
                    <CartSidebar
                        cart={cart}
                        onRemove={removeFromCart}
                        onQtyChange={updateCartQty}
                        onUomChange={updateCartUOM}
                        onPriceChange={updateCartPrice}
                        totalItems={cart.length}
                        totalQty={cart.reduce((s, i) => s + i.Qty, 0)}
                        summaryRight={`Rp ${calculateTotal().toLocaleString('id-ID')}`}
                        title="📝 Sales Order"
                        submitDraftLabel="💾 DRAFT"
                        submitCompleteLabel="✅ COMPLETE + KIRIM"
                        onSubmitDraft={canSubmitSalesOrder ? handleSubmitDraft : undefined}
                        onSubmitComplete={canSubmitSalesOrder ? handleSubmitComplete : undefined}
                        isSubmitting={isSubmittingOrder || isSubmittingShipment}
                        CartItemComponent={CartItemPOS}
                    />
                ) : (
                    <>
                        {cart.length > 0 && (
                            <button onClick={() => setIsCartOpen(true)}
                                style={{ position: 'fixed', bottom: '20px', left: '16px', right: '16px', zIndex: 200, background: '#28a745', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px 18px', fontWeight: 700, fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer' }}>
                                <span>🛒 {cart.length} item</span>
                                <span>{calculateTotal().toLocaleString('id-ID')} · Lihat Cart</span>
                            </button>
                        )}
                        <CartPanel
                            isOpen={isCartOpen}
                            onClose={() => setIsCartOpen(false)}
                            cart={cart}
                            onRemove={removeFromCart}
                            onQtyChange={updateCartQty}
                            onUomChange={updateCartUOM}
                            onPriceChange={updateCartPrice}
                            totalItems={cart.length}
                            totalQty={cart.reduce((s, i) => s + i.Qty, 0)}
                            summaryRight={`Rp ${calculateTotal().toLocaleString('id-ID')}`}
                            title="📝 Sales Order"
                            submitDraftLabel="💾 DRAFT"
                            submitCompleteLabel="✅ COMPLETE + KIRIM"
                            onSubmitDraft={canSubmitSalesOrder ? handleSubmitDraft : undefined}
                            onSubmitComplete={canSubmitSalesOrder ? handleSubmitComplete : undefined}
                            isSubmitting={isSubmittingOrder || isSubmittingShipment}
                            CartItemComponent={CartItemPOS}
                        />
                    </>
                )}

                <BarcodeScanner isOpen={scannerOpen} onDetected={handleBarcodeDetected} onClose={() => setScannerOpen(false)} />
            </div>

            {!canSubmitSalesOrder && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fef3c7', color: '#92400e', fontSize: '12px', padding: '8px 14px', textAlign: 'center', zIndex: 150 }}>
                    ⚠ Role Anda hanya memiliki akses lihat (read-only) untuk Sales Order.
                </div>
            )}
        </div>
    );
};

export default SalesOrderContainer;