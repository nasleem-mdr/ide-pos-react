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
// supaya bisa dipakai di dalam fetchProduct/fetchXxx (sebelum early return),
// dan juga dipakai untuk baris Vendor Pricing/Sales Price yang DIBUAT SECARA
// LOKAL (belum pernah ke server) — makanya bentuknya sengaja dibuat mirip
// { id, identifier } supaya getId/getLabel tetap konsisten untuk baris baru
// maupun baris hasil fetch.
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

// Key stabil untuk satu baris Vendor Pricing / Sales Price, dipakai untuk
// React `key` maupun untuk mencocokkan baris saat edit/hapus di state lokal.
// Baris hasil fetch dari server sudah punya id asli (lewat getId), baris
// yang baru ditambahkan di form (belum pernah ke server) pakai `_localId`.
const lineKey = (line) => getId(line) ?? line._localId;

function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id; // Route /product-detail/new tidak punya param :id

    const [product, setProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(!isNew); // mode New tidak perlu loading, langsung tampil form kosong
    const [isEditing, setIsEditing] = useState(isNew);  // mode New langsung masuk mode edit

    // Semua operasi simpan (create/update M_Product + baris Vendor Pricing &
    // Sales Price) sekarang dilakukan lewat SATU fungsi di hook ini, dipanggil
    // sekali saat tombol "Simpan"/"Buat Produk" diklik — lihat handleSaveAll.
    const { isSaving, saveProductWithLines } = useProductDetailSubmit(idempiereApi);

    // Modal notifikasi sukses — dipakai bersama untuk semua aksi simpan di halaman ini
    const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
    const showSuccess = (message) => setSuccessModal({ isOpen: true, message });

    // Form state untuk field utama M_Product (dipakai saat mode edit)
    // MarkupPercent & RoundingType: field custom plugin autoprice-mu, keduanya di level Product.
    // RoundingType disimpan sebagai NUMBER (bukan string) karena dipakai untuk operasi matematika.
    // M_Product_Category_ID & C_UOM_ID: WAJIB (NOT NULL) di tabel m_product.
    const [form, setForm] = useState({
        Value: "", Name: "", Description: "",
        IsPurchased: false, IsSold: false,
        MarkupPercent: 0, RoundingType: 0,
        M_Product_Category_ID: "", C_UOM_ID: "",
    });

    // ─── Vendor Pricing (M_BPartnerProduct) ─────────────────────────────────
    // vendorLines HANYA state lokal — tambah/ubah/hapus di sini tidak
    // langsung memanggil API. Baris yang dihapus (yang sudah punya id di
    // server) ditampung di deletedVendorLineIds, baru dieksekusi saat
    // handleSaveAll dipanggil.
    const [vendorLines, setVendorLines] = useState([]);
    const [deletedVendorLineIds, setDeletedVendorLineIds] = useState([]);
    const [isLoadingVendorLines, setIsLoadingVendorLines] = useState(false);
    // Ganti dari search-input (belum jalan) ke daftar vendor untuk dropdown.
    const [vendorOptions, setVendorOptions] = useState([]);

    // ─── Sales Price (M_ProductPrice) ───────────────────────────────────────
    const [priceLines, setPriceLines] = useState([]);
    const [deletedPriceLineIds, setDeletedPriceLineIds] = useState([]);
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
    // (lihat useProductDetailSubmit.js) — beberapa instance iDempiere
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

    // ─── FETCH: opsi vendor untuk dropdown Vendor Pricing ──────────────────
    // Ganti dari search-input (like %25...%25, belum jalan di REST API ini)
    // ke daftar lengkap vendor aktif — dipilih lewat <select> seperti
    // Product Category/UOM/Price List Version, bukan diketik.
    const fetchVendorOptions = useCallback(async () => {
        try {
            const data = await idempiereApi(
                `/models/c_bpartner?$filter=IsVendor eq true and IsActive eq true&$select=Name&$orderby=Name`
            );
            setVendorOptions(data.records || []);
        } catch (err) {
            console.error("Gagal mengambil daftar Vendor:", err);
            setVendorOptions([]);
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
        fetchVendorOptions();
        fetchProductCategories();
        fetchUoms();
    }, [fetchProduct, fetchVendorLines, fetchPriceLines, fetchPriceListVersions, fetchVendorOptions, fetchProductCategories, fetchUoms]);

    if (isLoading) return <div className="card-container detail-status">Loading detail...</div>;
    if (!isNew && !product) return <div className="card-container detail-status detail-status-empty">Produk tidak ditemukan.</div>;

    // ─── Validasi field wajib M_Product (dicek sebelum kirim apa pun) ──────
    const validateProductForm = () => {
        const missing = [];
        if (!form.Value?.trim()) missing.push("Search Key");
        if (!form.Name?.trim()) missing.push("Name");
        if (!form.M_Product_Category_ID) missing.push("Product Category");
        if (!form.C_UOM_ID) missing.push("UOM");
        return missing;
    };

    // ─── SAVE (satu pintu): M_Product + Vendor Pricing + Sales Price ───────
    // Sebelumnya ini 2 langkah manual dari sisi user (simpan produk dulu,
    // baru simpan/tambah/hapus tiap baris vendor & harga satu-satu). Sekarang
    // semua baris yang sudah diubah/ditambah/dihapus di state lokal dikirim
    // sekaligus ke hook, yang akan urus urutannya: simpan M_Product dulu →
    // pakai M_Product_ID hasil situ untuk baris-baris lainnya.
    const handleSaveAll = async () => {
        const missing = validateProductForm();
        if (missing.length > 0) {
            alert(`Field berikut wajib diisi terlebih dahulu:\n- ${missing.join("\n- ")}`);
            return;
        }

        const productPayload = {
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

        const vendorLinesPayload = vendorLines.map((l) => ({
            id: getId(l) || null,
            C_BPartner_ID: getId(l.C_BPartner_ID),
            VendorProductNo: l.VendorProductNo,
            PriceList: l.PriceList,
            PriceLastPO: l.PriceLastPO,
            _dirty: l._dirty === true,
        }));
        const priceLinesPayload = priceLines.map((l) => ({
            id: getId(l) || null,
            M_PriceList_Version_ID: getId(l.M_PriceList_Version_ID),
            PriceList: l.PriceList,
            PriceStd: l.PriceStd,
            PriceLimit: l.PriceLimit,
            _dirty: l._dirty === true,
        }));

        try {
            const newProductId = await saveProductWithLines({
                isNew,
                productId: id,
                productPayload,
                vendorLines: vendorLinesPayload,
                deletedVendorIds: deletedVendorLineIds,
                priceLines: priceLinesPayload,
                deletedPriceIds: deletedPriceLineIds,
            });

            setDeletedVendorLineIds([]);
            setDeletedPriceLineIds([]);

            if (isNew) {
                showSuccess("Produk baru berhasil dibuat beserta Vendor Pricing & Sales Price-nya.");
                // Pindah ke halaman edit produk yang baru dibuat.
                navigate(`/product-detail/edit/${newProductId}`, { replace: true });
            } else {
                await Promise.all([fetchProduct(), fetchVendorLines(), fetchPriceLines()]);
                setIsEditing(false);
                showSuccess("Data produk beserta Vendor Pricing & Sales Price berhasil disimpan.");
            }
        } catch (err) {
            console.error("Gagal menyimpan produk:", err);
            alert(`Gagal menyimpan produk.\n\n${parseIdempiereError(err)}`);
        }
    };

    // Batal edit (produk existing) — buang semua perubahan lokal yang belum
    // disimpan, termasuk baris vendor/harga yang sempat ditambah/diedit/dihapus.
    const handleCancelEdit = () => {
        setIsEditing(false);
        setDeletedVendorLineIds([]);
        setDeletedPriceLineIds([]);
        fetchProduct();
        fetchVendorLines();
        fetchPriceLines();
    };

    // ─── Vendor Pricing: semua operasi berikut HANYA mengubah state lokal ──
    const handleVendorLineChange = (line, field, value) => {
        setVendorLines((prev) =>
            prev.map((l) => {
                if (lineKey(l) !== lineKey(line)) return l;
                const updated = { ...l, [field]: value };
                if (getId(l)) updated._dirty = true; // baris lama yang diedit -> perlu PUT
                return updated;
            })
        );
    };

    const handleAddVendorLine = (bp) => {
        setVendorLines((prev) => [
            ...prev,
            {
                _localId: `new-vendor-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                C_BPartner_ID: { id: getId(bp), identifier: bp.Name },
                VendorProductNo: "",
                PriceList: 0,
                PriceLastPO: 0,
            },
        ]);
    };

    const handleDeleteVendorLine = (line) => {
        if (!window.confirm("Hapus baris vendor ini?")) return;
        const existingId = getId(line);
        if (existingId) {
            // Baris sudah ada di server -> tandai untuk dihapus saat Simpan.
            setDeletedVendorLineIds((prev) => [...prev, existingId]);
        }
        setVendorLines((prev) => prev.filter((l) => lineKey(l) !== lineKey(line)));
    };

    // ─── Sales Price: pola sama seperti Vendor Pricing ─────────────────────
    const handlePriceLineChange = (line, field, value) => {
        setPriceLines((prev) =>
            prev.map((l) => {
                if (lineKey(l) !== lineKey(line)) return l;
                const updated = { ...l, [field]: value };
                if (getId(l)) updated._dirty = true;
                return updated;
            })
        );
    };

    const handleAddPriceLine = (plv) => {
        setPriceLines((prev) => [
            ...prev,
            {
                _localId: `new-price-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                M_PriceList_Version_ID: { id: getId(plv), identifier: getLabel(plv.Name) || plv.Name },
                PriceList: 0,
                PriceStd: 0,
                PriceLimit: 0,
            },
        ]);
    };

    const handleDeletePriceLine = (line) => {
        if (!window.confirm("Hapus baris harga ini?")) return;
        const existingId = getId(line);
        if (existingId) {
            setDeletedPriceLineIds((prev) => [...prev, existingId]);
        }
        setPriceLines((prev) => prev.filter((l) => lineKey(l) !== lineKey(line)));
    };

    return (
        <div className="card-container">
            <div className="detail-topbar">
                <button onClick={() => navigate(-1)} className="btn-back">← Back to List</button>
                <span className="product-id-badge">{isNew ? "Produk Baru" : `Product ID: ${id}`}</span>
                {isNew ? (
                    <div className="topbar-actions">
                        <button className="btn btn-ghost" onClick={() => navigate(-1)} disabled={isSaving}>Batal</button>
                        <button className="btn btn-primary" onClick={handleSaveAll} disabled={isSaving}>
                            {isSaving ? "Menyimpan..." : "💾 Buat Produk"}
                        </button>
                    </div>
                ) : !isEditing ? (
                    <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>✏ Edit</button>
                ) : (
                    <div className="topbar-actions">
                        <button className="btn btn-ghost" onClick={handleCancelEdit} disabled={isSaving}>Batal</button>
                        <button className="btn btn-primary" onClick={handleSaveAll} disabled={isSaving}>
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

                {/* SECTION 3: VENDOR PRICING (M_BPartnerProduct) */}
                {/* Baris di sini murni state lokal selama isEditing — tombol
                    Simpan/Buat Produk di topbar-lah yang mengirim semuanya
                    (termasuk baris baru & baris terhapus) sekaligus ke server. */}
                <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
                    <h3>Vendor Pricing (M_BPartnerProduct)</h3>

                    {isLoadingVendorLines ? (
                        <p className="muted-note">Memuat...</p>
                    ) : vendorLines.length === 0 ? (
                        <p className="empty-note">Belum ada Vendor Pricing.</p>
                    ) : (
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Vendor</th>
                                    <th>Vendor Product No</th>
                                    <th style={{ textAlign: 'right' }}>Price List (Vendor)</th>
                                    <th style={{ textAlign: 'right' }}>Price Last PO</th>
                                    {isEditing && <th style={{ width: '60px' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {vendorLines.map((line) => {
                                    const key = lineKey(line);
                                    return (
                                        <tr key={key}>
                                            <td>{getLabel(line.C_BPartner_ID)}</td>
                                            {isEditing ? (
                                                <>
                                                    <td>
                                                        <input
                                                            value={line.VendorProductNo || ""}
                                                            onChange={(e) => handleVendorLineChange(line, "VendorProductNo", e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" step="0.01" style={{ textAlign: 'right', width: '100px' }}
                                                            value={line.PriceList ?? 0}
                                                            onChange={(e) => handleVendorLineChange(line, "PriceList", e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" step="0.01" style={{ textAlign: 'right', width: '100px' }}
                                                            value={line.PriceLastPO ?? 0}
                                                            onChange={(e) => handleVendorLineChange(line, "PriceLastPO", e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="row-actions">
                                                        <button className="icon-btn icon-btn-delete" title="Hapus baris" onClick={() => handleDeleteVendorLine(line)}>🗑️</button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>{line.VendorProductNo || "-"}</td>
                                                    <td style={{ textAlign: 'right' }}>{line.PriceList ?? 0}</td>
                                                    <td style={{ textAlign: 'right' }}>{line.PriceLastPO ?? 0}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Tambah vendor baru — dropdown (bukan search field, yang
                        sebelumnya belum jalan). Baris baru langsung tampil di
                        tabel di atas, dan baru dikirim ke server saat Simpan. */}
                    {isEditing && (
                        <div className="inline-add-box">
                            <select
                                className="add-vendor-select"
                                defaultValue=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const bp = vendorOptions.find((v) => String(getId(v)) === e.target.value);
                                        if (bp) handleAddVendorLine(bp);
                                        e.target.value = "";
                                    }
                                }}
                            >
                                <option value="">+ Tambah Vendor...</option>
                                {vendorOptions
                                    .filter((bp) => !vendorLines.some((l) => getId(l.C_BPartner_ID) === getId(bp)))
                                    .map((bp, idx) => (
                                        <option key={getId(bp) ?? `bp-${idx}`} value={getId(bp)}>{bp.Name}</option>
                                    ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* SECTION 4: SALES PRICE (M_ProductPrice) + AutoPrice fields */}
                <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
                    <h3>Sales Price (M_ProductPrice)</h3>

                    {isLoadingPriceLines ? (
                        <p className="muted-note">Memuat...</p>
                    ) : priceLines.length === 0 ? (
                        <p className="empty-note">Belum ada Sales Price.</p>
                    ) : (
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Price List Version</th>
                                    <th style={{ textAlign: 'right' }}>Price List</th>
                                    <th style={{ textAlign: 'right' }}>Price Std (Jual)</th>
                                    <th style={{ textAlign: 'right' }}>Price Limit</th>
                                    {isEditing && <th style={{ width: '60px' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {priceLines.map((line) => {
                                    const key = lineKey(line);
                                    return (
                                        <tr key={key}>
                                            <td>{getLabel(line.M_PriceList_Version_ID)}</td>
                                            {isEditing ? (
                                                <>
                                                    <td>
                                                        <input
                                                            type="number" step="0.01" style={{ textAlign: 'right', width: '90px' }}
                                                            value={line.PriceList ?? 0}
                                                            onChange={(e) => handlePriceLineChange(line, "PriceList", e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" step="0.01" style={{ textAlign: 'right', width: '90px' }}
                                                            value={line.PriceStd ?? 0}
                                                            onChange={(e) => handlePriceLineChange(line, "PriceStd", e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number" step="0.01" style={{ textAlign: 'right', width: '90px' }}
                                                            value={line.PriceLimit ?? 0}
                                                            onChange={(e) => handlePriceLineChange(line, "PriceLimit", e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="row-actions">
                                                        <button className="icon-btn icon-btn-delete" title="Hapus baris" onClick={() => handleDeletePriceLine(line)}>🗑️</button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ textAlign: 'right' }}>{line.PriceList ?? 0}</td>
                                                    <td style={{ textAlign: 'right' }}>{line.PriceStd ?? 0}</td>
                                                    <td style={{ textAlign: 'right' }}>{line.PriceLimit ?? 0}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Tambah baris harga baru di Price List Version lain —
                        juga cuma state lokal sampai tombol Simpan diklik. */}
                    {isEditing && (
                        <div className="inline-add-box inline-add-box-select">
                            <select
                                className="add-price-select"
                                defaultValue=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const plv = priceListVersions.find((v) => String(getId(v)) === e.target.value);
                                        if (plv) handleAddPriceLine(plv);
                                        e.target.value = "";
                                    }
                                }}
                            >
                                <option value="">+ Tambah ke Price List Version...</option>
                                {priceListVersions
                                    .filter((plv) => !priceLines.some((pl) => getId(pl.M_PriceList_Version_ID) === getId(plv)))
                                    .map((plv, idx) => (
                                        <option key={getId(plv) ?? `plv-${idx}`} value={getId(plv)}>{plv.Name || getId(plv)}</option>
                                    ))}
                            </select>
                        </div>
                    )}
                </div>
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
