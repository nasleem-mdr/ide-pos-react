// src/pages/ProductDetail.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { idempiereApi } from '@/api/idempiereApi';
import useProductDetailSubmit, { parseIdempiereError, VENDOR_PRICING_TABLE } from '@/features/master/product/hooks/useProductDetailSubmit';
import SuccessModal from '@/features/master/product/components/SuccessModal';
import '@/css/ProductDetail.css';

// ─── Opsi RoundingType ────────────────────────────────────────────────────
// Value pakai ANGKA MURNI (bukan string) karena dipakai langsung untuk
// operasi matematika pembulatan di plugin autoprice (mis. Math.round(price
// / value) * value, dengan 0 berarti tanpa pembulatan).
// ⚠️ SESUAIKAN dengan AD_Ref_List yang benar-benar kamu buat di iDempiere.
const ROUNDING_TYPE_OPTIONS = [
    { value: 0, label: "Tanpa Pembulatan" },
    { value: 50, label: "Bulatkan ke 50 terdekat" },
    { value: 100, label: "Bulatkan ke 100 terdekat" },
    { value: 500, label: "Bulatkan ke 500 terdekat" },
    { value: 1000, label: "Bulatkan ke 1.000 terdekat" },
    { value: 5000, label: "Bulatkan ke 5.000 terdekat" },
    { value: 10000, label: "Bulatkan ke 10.000 terdekat" },
];

// Helper generik untuk baca id & label dari field referensi iDempiere REST
// (mis. { id: 1000000, identifier: "EACH" }). Dipindah ke module scope
// supaya bisa dipakai di dalam fetchProduct/fetchXxx (sebelum early return).
//
// FIX: beberapa tabel (terutama M_Product_PO / Vendor Pricing) ternyata
// mengembalikan primary key pakai nama kolom aslinya (mis. "M_Product_PO_ID"),
// BUKAN "id" generik seperti tabel lain — makanya getId() lama pulang
// `undefined` untuk baris-baris itu dan bikin React warning "unique key prop"
// (semua baris jadi key={undefined}, dianggap duplikat).
const KNOWN_FK_FIELDS = new Set([
    "C_BPartner_ID", "M_Product_ID", "M_PriceList_Version_ID",
    "M_Product_Category_ID", "C_UOM_ID", "C_TaxCategory_ID",
]);
const getId = (obj) => {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== "object") return obj; // sudah id mentah (angka/string)
    if (obj.id?.id !== undefined) return obj.id.id;
    if (obj.id !== undefined) return obj.id;
    // Fallback: cari kolom PK asli (pola "<Table>_ID"), tapi jangan salah
    // ambil foreign key (mis. M_Product_ID di baris Vendor Pricing).
    const pkKey = Object.keys(obj).find((k) => /_ID$/i.test(k) && !KNOWN_FK_FIELDS.has(k));
    if (pkKey) return obj[pkKey];
    // Last resort: kalau SEMUA kolom "_ID" kebetulan ada di daftar FK yang
    // dikenal (mis. record m_product sendiri yang PK-nya persis "M_Product_ID"),
    // tetap ambil yang pertama daripada diam-diam pulang undefined.
    const anyIdKey = Object.keys(obj).find((k) => /_ID$/i.test(k));
    return anyIdKey ? obj[anyIdKey] : undefined;
};
const getLabel = (field) => (typeof field === "object" ? field?.identifier : field) || "-";

function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id; // Route /product-detail/new tidak punya param :id

    const [product, setProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(!isNew); // mode New tidak perlu loading, langsung tampil form kosong
    const [isEditing, setIsEditing] = useState(isNew);  // mode New langsung masuk mode edit

    // Semua operasi simpan/tambah/hapus ditangani hook ini, bukan inline di komponen
    const {
        isSaving,
        createProduct,
        saveProduct,
        saveVendorLine,
        addVendorLine,
        deleteVendorLine,
        savePriceLine,
        addPriceLine,
        deletePriceLine,
    } = useProductDetailSubmit(idempiereApi);

    // Modal notifikasi sukses — dipakai bersama untuk semua aksi simpan di halaman ini
    const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
    const showSuccess = (message) => setSuccessModal({ isOpen: true, message });

    // Form state untuk field utama M_Product (dipakai saat mode edit)
    // MarkupPercent & RoundingType: field custom plugin autoprice-mu, keduanya di level Product.
    // RoundingType disimpan sebagai NUMBER (bukan string) karena dipakai untuk operasi matematika.
    // M_Product_Category_ID & C_UOM_ID: WAJIB (NOT NULL) di tabel m_product.
    // Sebelumnya field ini tidak ada di form sama sekali, jadi hanya
    // terisi kalau server kebetulan punya default value — kalau tidak,
    // insert gagal dengan error mandatory constraint (mis. kasus "name"
    // yang kamu alami, dan berikutnya akan menyusul untuk kolom lain).
    const [form, setForm] = useState({
        Value: "", Name: "", Description: "",
        IsPurchased: false, IsSold: false,
        MarkupPercent: 0, RoundingType: 0,
        M_Product_Category_ID: "", C_UOM_ID: "",
    });

    // ─── Vendor Pricing (M_BPartnerProduct) ─────────────────────────────────
    const [vendorLines, setVendorLines] = useState([]);
    const [isLoadingVendorLines, setIsLoadingVendorLines] = useState(false);
    const [bPartnerSearch, setBPartnerSearch] = useState("");
    const [bPartnerOptions, setBPartnerOptions] = useState([]);

    // ─── Sales Price (M_ProductPrice) ───────────────────────────────────────
    const [priceLines, setPriceLines] = useState([]);
    const [isLoadingPriceLines, setIsLoadingPriceLines] = useState(false);
    const [priceListVersions, setPriceListVersions] = useState([]);

    // ─── Opsi untuk field mandatory M_Product (Product Category & UOM) ─────
    const [productCategories, setProductCategories] = useState([]);
    const [uoms, setUoms] = useState([]);

    // ─── FETCH: data utama produk ────────────────────────────────────────────
    const fetchProduct = useCallback(async () => {
        if (isNew) return; // Belum ada produk untuk di-fetch di mode New
        setIsLoading(true);
        try {
            const data = await idempiereApi(
                `/models/m_product/${id}?$select=Value,Name,Description,IsPurchased,IsSold,MarkupPercent,RoundingType,M_Product_Category_ID,C_UOM_ID`
            );
            setProduct(data);
            setForm({
                Value: data.Value || "",
                Name: data.Name || "",
                Description: data.Description || "",
                IsPurchased: data.IsPurchased === true || data.IsPurchased === "Y",
                IsSold: data.IsSold === true || data.IsSold === "Y",
                MarkupPercent: data.MarkupPercent ?? 0,
                // RoundingType balik dari REST sebagai object reference
                // ({ id, identifier, ... }) karena kolomnya List/Reference
                // di iDempiere, BUKAN angka polos — makanya harus di-getId().
                RoundingType: getId(data.RoundingType) ?? 0,
                M_Product_Category_ID: getId(data.M_Product_Category_ID) ?? "",
                C_UOM_ID: getId(data.C_UOM_ID) ?? "",
            });
        } catch (err) {
            console.error("Gagal mengambil data produk:", err);
        } finally {
            setIsLoading(false);
        }
    }, [id, isNew]);

    // ─── FETCH: Vendor Pricing lines ────────────────────────────────────────
    // FIX: nama tabel Vendor Pricing dipusatkan di VENDOR_PRICING_TABLE
    // (lihat useProductDetailSubmit.jsx) — beberapa instance iDempiere
    // masih pakai nama tabel lama "M_Product_PO", yang lain sudah di-rename
    // ke "M_BPartnerProduct". Kalau server balas 404 "No match found for
    // table name", tinggal ganti konstanta itu di satu tempat saja.
    const fetchVendorLines = useCallback(async () => {
        if (isNew) return; // Tidak ada M_Product_ID untuk difilter di mode New
        setIsLoadingVendorLines(true);
        try {
            const query = `/models/${VENDOR_PRICING_TABLE}?$filter=M_Product_ID eq ${id}`;
            const data = await idempiereApi(query);
            setVendorLines(data.records || []);
        } catch (err) {
            console.error(`Gagal mengambil Vendor Pricing (${VENDOR_PRICING_TABLE}):`, err);
            setVendorLines([]);
        } finally {
            setIsLoadingVendorLines(false);
        }
    }, [id, isNew]);

    // ─── FETCH: Sales Price lines ───────────────────────────────────────────
    const fetchPriceLines = useCallback(async () => {
        if (isNew) return;
        setIsLoadingPriceLines(true);
        try {
            const query = `/models/m_productprice?$filter=M_Product_ID eq ${id}`;
            const data = await idempiereApi(query);
            setPriceLines(data.records || []);
        } catch (err) {
            console.error("Gagal mengambil Sales Price (M_ProductPrice):", err);
            setPriceLines([]);
        } finally {
            setIsLoadingPriceLines(false);
        }
    }, [id, isNew]);

    // ─── FETCH: opsi Price List Version (untuk tambah baris harga baru) ────
    const fetchPriceListVersions = useCallback(async () => {
        try {
            const data = await idempiereApi(`/models/m_pricelist_version?$filter=IsActive eq true`);
            setPriceListVersions(data.records || []);
        } catch (err) {
            console.error("Gagal mengambil Price List Version:", err);
        }
    }, []);

    // ─── FETCH: opsi Product Category (mandatory di m_product) ─────────────
    const fetchProductCategories = useCallback(async () => {
        try {
            const data = await idempiereApi(`/models/m_product_category?$filter=IsActive eq true&$select=Name,IsDefault`);
            const records = data.records || [];
            setProductCategories(records);
            // Mode New: langsung pilihkan default category kalau ada, biar
            // user tidak wajib klik dulu sebelum submit pertama kali.
            if (isNew) {
                const def = records.find((c) => c.IsDefault === true || c.IsDefault === "Y") || records[0];
                if (def) setForm((prev) => (prev.M_Product_Category_ID ? prev : { ...prev, M_Product_Category_ID: getId(def) }));
            }
        } catch (err) {
            console.error("Gagal mengambil Product Category:", err);
            setProductCategories([]);
        }
    }, [isNew]);

    // ─── FETCH: opsi UOM (mandatory di m_product) ───────────────────────────
    const fetchUoms = useCallback(async () => {
        try {
            const data = await idempiereApi(`/models/c_uom?$filter=IsActive eq true&$select=Name,IsDefault`);
            const records = data.records || [];
            setUoms(records);
            if (isNew) {
                const def = records.find((u) => u.IsDefault === true || u.IsDefault === "Y") || records[0];
                if (def) setForm((prev) => (prev.C_UOM_ID ? prev : { ...prev, C_UOM_ID: getId(def) }));
            }
        } catch (err) {
            console.error("Gagal mengambil UOM:", err);
            setUoms([]);
        }
    }, [isNew]);

    useEffect(() => {
        fetchProduct();
        fetchVendorLines();
        fetchPriceLines();
        fetchPriceListVersions();
        fetchProductCategories();
        fetchUoms();
    }, [fetchProduct, fetchVendorLines, fetchPriceLines, fetchPriceListVersions, fetchProductCategories, fetchUoms]);

    // ─── Cari Business Partner (Vendor) untuk baris Vendor Pricing baru ────
    useEffect(() => {
        if (bPartnerSearch.trim().length < 2) {
            setBPartnerOptions([]);
            return;
        }
        const handle = setTimeout(async () => {
            try {
                const nameFilter = `Name like '%25${encodeURIComponent(bPartnerSearch.trim())}%25'`;
                const query = `/models/c_bpartner?$filter=IsVendor eq true and IsActive eq true and ${nameFilter}&$top=15`;
                const data = await idempiereApi(query);
                setBPartnerOptions(data.records || []);
            } catch (err) {
                console.error("Gagal mencari vendor:", err);
            }
        }, 350);
        return () => clearTimeout(handle);
    }, [bPartnerSearch]);

    if (isLoading) return <div className="card-container detail-status">Loading detail...</div>;
    if (!isNew && !product) return <div className="card-container detail-status detail-status-empty">Produk tidak ditemukan.</div>;

    // ─── SAVE: field utama M_Product (create kalau New, update kalau Edit) ──
    // Validasi mandatory di sisi frontend — mencegah request terkirim ke
    // server kalau field wajib masih kosong, supaya user dapat pesan yang
    // jelas & langsung, bukan dump constraint Postgres.
    const validateProductForm = () => {
        const missing = [];
        if (!form.Value?.trim()) missing.push("Search Key");
        if (!form.Name?.trim()) missing.push("Name");
        if (!form.M_Product_Category_ID) missing.push("Product Category");
        if (!form.C_UOM_ID) missing.push("UOM");
        return missing;
    };

    const handleSaveProduct = async () => {
        const missing = validateProductForm();
        if (missing.length > 0) {
            alert(`Field berikut wajib diisi terlebih dahulu:\n- ${missing.join("\n- ")}`);
            return;
        }

        const payload = {
            Value: form.Value.trim(),
            Name: form.Name.trim(),
            Description: form.Description,
            IsPurchased: form.IsPurchased,
            IsSold: form.IsSold,
            MarkupPercent: parseFloat(form.MarkupPercent) || 0,
            RoundingType: parseInt(form.RoundingType, 10) || 0,
            M_Product_Category_ID: { id: parseInt(form.M_Product_Category_ID, 10) },
            C_UOM_ID: { id: parseInt(form.C_UOM_ID, 10) },
        };

        try {
            if (isNew) {
                const created = await createProduct(payload);
                const newId = getId(created);
                if (!newId) throw new Error("Response tidak berisi ID produk baru.");
                showSuccess("Produk baru berhasil dibuat.");
                // Pindah ke halaman edit produk yang baru dibuat — dari sini
                // baru bisa menambahkan Vendor Pricing & Sales Price.
                navigate(`/product-detail/edit/${newId}`, { replace: true });
            } else {
                await saveProduct(id, payload);
                await fetchProduct();
                setIsEditing(false);
                showSuccess("Data produk berhasil disimpan.");
            }
        } catch (err) {
            console.error("Gagal menyimpan produk:", err);
            alert(`Gagal menyimpan produk.\n\n${parseIdempiereError(err)}`);
        }
    };

    // ─── Vendor Pricing: update satu baris (langsung PUT saat blur, atau lewat tombol Simpan per baris) ─
    const handleVendorLineChange = (lineId, field, value) => {
        setVendorLines((prev) =>
            prev.map((l) => (getId(l) === lineId ? { ...l, [field]: value } : l))
        );
    };

    const handleSaveVendorLine = async (line) => {
        const lineId = getId(line);
        if (!lineId) return;
        try {
            await saveVendorLine(lineId, {
                VendorProductNo: line.VendorProductNo || "",
                PriceList: parseFloat(line.PriceList) || 0,
                PriceLastPO: parseFloat(line.PriceLastPO) || 0,
            });
            await fetchVendorLines();
            showSuccess("Baris Vendor Pricing berhasil disimpan.");
        } catch (err) {
            console.error("Gagal menyimpan baris Vendor Pricing:", err);
            alert(`Gagal menyimpan baris vendor.\n\n${parseIdempiereError(err)}`);
        }
    };

    const handleAddVendorLine = async (bp) => {
        try {
            await addVendorLine({
                M_Product_ID: { id: parseInt(id) },
                C_BPartner_ID: { id: getId(bp) },
                VendorProductNo: "",
                PriceList: 0,
                PriceLastPO: 0,
            });
            setBPartnerSearch("");
            setBPartnerOptions([]);
            await fetchVendorLines();
            showSuccess("Vendor berhasil ditambahkan.");
        } catch (err) {
            console.error("Gagal menambah baris Vendor Pricing:", err);
            alert(`Gagal menambah vendor.\n\n${parseIdempiereError(err)}`);
        }
    };

    const handleDeleteVendorLine = async (lineId) => {
        if (!window.confirm("Hapus baris vendor ini?")) return;
        try {
            await deleteVendorLine(lineId);
            await fetchVendorLines();
            showSuccess("Baris vendor berhasil dihapus.");
        } catch (err) {
            console.error("Gagal menghapus baris Vendor Pricing:", err);
            alert(`Gagal menghapus baris vendor.\n\n${parseIdempiereError(err)}`);
        }
    };

    // ─── Sales Price: update satu baris ─
    const handlePriceLineChange = (lineId, field, value) => {
        setPriceLines((prev) =>
            prev.map((l) => (getId(l) === lineId ? { ...l, [field]: value } : l))
        );
    };

    const handleSavePriceLine = async (line) => {
        const lineId = getId(line);
        if (!lineId) return;
        try {
            await savePriceLine(lineId, {
                PriceList: parseFloat(line.PriceList) || 0,
                PriceStd: parseFloat(line.PriceStd) || 0,
                PriceLimit: parseFloat(line.PriceLimit) || 0,
            });
            await fetchPriceLines();
            showSuccess("Baris Sales Price berhasil disimpan.");
        } catch (err) {
            console.error("Gagal menyimpan baris Sales Price:", err);
            alert(`Gagal menyimpan baris harga.\n\n${parseIdempiereError(err)}`);
        }
    };

    const handleAddPriceLine = async (priceListVersionId) => {
        try {
            await addPriceLine({
                M_Product_ID: { id: parseInt(id) },
                M_PriceList_Version_ID: { id: parseInt(priceListVersionId) },
                PriceList: 0,
                PriceStd: 0,
                PriceLimit: 0,
            });
            await fetchPriceLines();
            showSuccess("Baris Sales Price berhasil ditambahkan.");
        } catch (err) {
            console.error("Gagal menambah baris Sales Price:", err);
            alert(`Gagal menambah baris harga.\n\n${parseIdempiereError(err)}`);
        }
    };

    const handleDeletePriceLine = async (lineId) => {
        if (!window.confirm("Hapus baris harga ini?")) return;
        try {
            await deletePriceLine(lineId);
            await fetchPriceLines();
            showSuccess("Baris Sales Price berhasil dihapus.");
        } catch (err) {
            console.error("Gagal menghapus baris Sales Price:", err);
            alert(`Gagal menghapus baris harga.\n\n${parseIdempiereError(err)}`);
        }
    };

    return (
        <div className="card-container">
            <div className="detail-topbar">
                <button onClick={() => navigate(-1)} className="btn-back">← Back to List</button>
                <span className="product-id-badge">{isNew ? "Produk Baru" : `Product ID: ${id}`}</span>
                {isNew ? (
                    <div className="topbar-actions">
                        <button className="btn btn-ghost" onClick={() => navigate(-1)} disabled={isSaving}>Batal</button>
                        <button className="btn btn-primary" onClick={handleSaveProduct} disabled={isSaving}>
                            {isSaving ? "Menyimpan..." : "💾 Buat Produk"}
                        </button>
                    </div>
                ) : !isEditing ? (
                    <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>✏ Edit</button>
                ) : (
                    <div className="topbar-actions">
                        <button className="btn btn-ghost" onClick={() => { setIsEditing(false); fetchProduct(); }} disabled={isSaving}>Batal</button>
                        <button className="btn btn-primary" onClick={handleSaveProduct} disabled={isSaving}>
                            {isSaving ? "Menyimpan..." : "💾 Simpan"}
                        </button>
                    </div>
                )}
            </div>

            <div className="detail-grid">
                {/* SECTION 1: INFORMASI UTAMA */}
                <div className="detail-section">
                    <h3>General Information</h3>
                    <div className="info-group">
                        <label>Search Key *</label>
                        {isEditing ? (
                            <input value={form.Value} onChange={(e) => setForm({ ...form, Value: e.target.value })} />
                        ) : <p>{product.Value}</p>}

                        <label>Name *</label>
                        {isEditing ? (
                            <input value={form.Name} onChange={(e) => setForm({ ...form, Name: e.target.value })} />
                        ) : <p>{product.Name}</p>}

                        <label>Description</label>
                        {isEditing ? (
                            <textarea value={form.Description} onChange={(e) => setForm({ ...form, Description: e.target.value })} />
                        ) : <p>{product.Description || '-'}</p>}

                        {/* Product Category & UOM: WAJIB (NOT NULL) di m_product — tanpa
                            ini insert akan gagal dengan constraint error di server. */}
                        <label>Product Category *</label>
                        {isEditing ? (
                            <select
                                value={form.M_Product_Category_ID}
                                onChange={(e) => setForm({ ...form, M_Product_Category_ID: e.target.value })}
                            >
                                <option value="">-- Pilih Product Category --</option>
                                {productCategories.map((c, idx) => (
                                    <option key={getId(c) ?? `cat-${idx}`} value={getId(c)}>{c.Name || getId(c)}</option>
                                ))}
                            </select>
                        ) : <p>{getLabel(product.M_Product_Category_ID)}</p>}

                        <label>UOM *</label>
                        {isEditing ? (
                            <select
                                value={form.C_UOM_ID}
                                onChange={(e) => setForm({ ...form, C_UOM_ID: e.target.value })}
                            >
                                <option value="">-- Pilih UOM --</option>
                                {uoms.map((u, idx) => (
                                    <option key={getId(u) ?? `uom-${idx}`} value={getId(u)}>{u.Name}</option>
                                ))}
                            </select>
                        ) : <p>{getLabel(product.C_UOM_ID)}</p>}
                    </div>
                </div>

                {/* SECTION 2: STATUS & GRUP */}
                <div className="detail-section">
                    <h3>Classification</h3>
                    <div className="info-group">
                        <label>Purchased (bisa dibeli)</label>
                        {isEditing ? (
                            <input type="checkbox" checked={form.IsPurchased} onChange={(e) => setForm({ ...form, IsPurchased: e.target.checked })} />
                        ) : <p>{product.IsPurchased ? 'Yes' : 'No'}</p>}

                        <label>Sold (bisa dijual)</label>
                        {isEditing ? (
                            <input type="checkbox" checked={form.IsSold} onChange={(e) => setForm({ ...form, IsSold: e.target.checked })} />
                        ) : <p>{product.IsSold ? 'Yes' : 'No'}</p>}

                        <label>Markup % (AutoPrice)</label>
                        {isEditing ? (
                            <input
                                type="number" step="0.01"
                                value={form.MarkupPercent}
                                onChange={(e) => setForm({ ...form, MarkupPercent: e.target.value })}
                            />
                        ) : <p>{product.MarkupPercent ?? 0}%</p>}

                        <label>Rounding Type (AutoPrice)</label>
                        {isEditing ? (
                            <select
                                value={form.RoundingType}
                                onChange={(e) => setForm({ ...form, RoundingType: e.target.value })}
                            >
                                {ROUNDING_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        ) : (
                            <p>
                                {ROUNDING_TYPE_OPTIONS.find((o) => o.value === getId(product.RoundingType))?.label
                                    || getLabel(product.RoundingType)}
                            </p>
                        )}
                    </div>
                </div>

                {isNew ? (
                    <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
                        <p className="empty-note">
                            Simpan produk terlebih dahulu untuk bisa menambahkan Vendor Pricing dan Sales Price.
                        </p>
                    </div>
                ) : (
                <>
                {/* SECTION 3: VENDOR PRICING (M_BPartnerProduct) */}
                <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
                    <h3>Vendor Pricing (M_BPartnerProduct)</h3>

                    {isLoadingVendorLines ? (
                        <p className="muted-note">Memuat...</p>
                    ) : (
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Vendor</th>
                                    <th>Vendor Product No</th>
                                    <th style={{ textAlign: 'right' }}>Price List (Vendor)</th>
                                    <th style={{ textAlign: 'right' }}>Price Last PO</th>
                                    <th style={{ width: '110px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {vendorLines.map((line, idx) => {
                                    const lineId = getId(line);
                                    if (lineId === undefined) {
                                        console.warn("Vendor line tanpa ID terdeteksi — cek struktur JSON dari REST API:", line);
                                    }
                                    return (
                                        <tr key={lineId ?? `vendor-row-${idx}`}>
                                            <td>{getLabel(line.C_BPartner_ID)}</td>
                                            <td>
                                                <input
                                                    value={line.VendorProductNo || ""}
                                                    onChange={(e) => handleVendorLineChange(lineId, "VendorProductNo", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number" step="0.01" style={{ textAlign: 'right', width: '100px' }}
                                                    value={line.PriceList ?? 0}
                                                    onChange={(e) => handleVendorLineChange(lineId, "PriceList", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number" step="0.01" style={{ textAlign: 'right', width: '100px' }}
                                                    value={line.PriceLastPO ?? 0}
                                                    onChange={(e) => handleVendorLineChange(lineId, "PriceLastPO", e.target.value)}
                                                />
                                            </td>
                                            <td className="row-actions">
                                                <button className="icon-btn icon-btn-save" title="Simpan baris" onClick={() => handleSaveVendorLine(line)}>💾</button>
                                                <button className="icon-btn icon-btn-delete" title="Hapus baris" onClick={() => handleDeleteVendorLine(lineId)}>🗑️</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Tambah vendor baru */}
                    <div className="inline-add-box">
                        <input
                            type="text"
                            className="vendor-search-input"
                            placeholder="Cari vendor untuk ditambahkan..."
                            value={bPartnerSearch}
                            onChange={(e) => setBPartnerSearch(e.target.value)}
                        />
                        {bPartnerOptions.length > 0 && (
                            <div className="suggestions-dropdown">
                                {bPartnerOptions.map((bp, idx) => (
                                    <div
                                        key={getId(bp) ?? `bp-${idx}`}
                                        className="suggestion-item"
                                        onClick={() => handleAddVendorLine(bp)}
                                    >
                                        {getLabel(bp.Name)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SECTION 4: SALES PRICE (M_ProductPrice) + AutoPrice fields */}
                <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
                    <h3>Sales Price (M_ProductPrice)</h3>

                    {isLoadingPriceLines ? (
                        <p className="muted-note">Memuat...</p>
                    ) : (
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Price List Version</th>
                                    <th style={{ textAlign: 'right' }}>Price List</th>
                                    <th style={{ textAlign: 'right' }}>Price Std (Jual)</th>
                                    <th style={{ textAlign: 'right' }}>Price Limit</th>
                                    <th style={{ width: '110px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {priceLines.map((line, idx) => {
                                    const lineId = getId(line);
                                    if (lineId === undefined) {
                                        console.warn("Price line tanpa ID terdeteksi — cek struktur JSON dari REST API:", line);
                                    }
                                    return (
                                        <tr key={lineId ?? `price-row-${idx}`}>
                                            <td>{getLabel(line.M_PriceList_Version_ID)}</td>
                                            <td>
                                                <input
                                                    type="number" step="0.01" style={{ textAlign: 'right', width: '90px' }}
                                                    value={line.PriceList ?? 0}
                                                    onChange={(e) => handlePriceLineChange(lineId, "PriceList", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number" step="0.01" style={{ textAlign: 'right', width: '90px' }}
                                                    value={line.PriceStd ?? 0}
                                                    onChange={(e) => handlePriceLineChange(lineId, "PriceStd", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number" step="0.01" style={{ textAlign: 'right', width: '90px' }}
                                                    value={line.PriceLimit ?? 0}
                                                    onChange={(e) => handlePriceLineChange(lineId, "PriceLimit", e.target.value)}
                                                />
                                            </td>
                                            <td className="row-actions">
                                                <button className="icon-btn icon-btn-save" title="Simpan baris" onClick={() => handleSavePriceLine(line)}>💾</button>
                                                <button className="icon-btn icon-btn-delete" title="Hapus baris" onClick={() => handleDeletePriceLine(lineId)}>🗑️</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Tambah baris harga baru di Price List Version lain */}
                    <div className="inline-add-box inline-add-box-select">
                        <select
                            className="add-price-select"
                            defaultValue=""
                            onChange={(e) => {
                                if (e.target.value) {
                                    handleAddPriceLine(e.target.value);
                                    e.target.value = "";
                                }
                            }}
                        >
                            <option value="">+ Tambah ke Price List Version...</option>
                            {priceListVersions
                                .filter((plv) => !priceLines.some((pl) => getId(pl.M_PriceList_Version_ID) === getId(plv)))
                                .map((plv, idx) => (
                                    <option key={getId(plv) ?? `plv-${idx}`} value={getId(plv)}>{getLabel(plv.Name) || getId(plv)}</option>
                                ))}
                        </select>
                    </div>
                </div>
                </>
                )}
            </div>

            <SuccessModal
                isOpen={successModal.isOpen}
                message={successModal.message}
                onClose={() => setSuccessModal({ isOpen: false, message: "" })}
            />
        </div>
    );
}

export default ProductDetail;