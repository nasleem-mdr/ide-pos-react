// src/pages/ProductDetail.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { idempiereApi } from '@/api/idempiereApi';
import useProductDetailSubmit from '@/shared/hooks/useProductDetailSubmit';
import SuccessModal from '@/shared/components/SuccessModal';

// ─── Opsi RoundingType ────────────────────────────────────────────────────
// Value pakai ANGKA MURNI (bukan string) karena dipakai langsung untuk
// operasi matematika pembulatan di plugin autoprice (mis. Math.round(price
// / value) * value, dengan 0 berarti tanpa pembulatan).
// ⚠️ SESUAIKAN dengan AD_Ref_List yang benar-benar kamu buat di iDempiere.
const ROUNDING_TYPE_OPTIONS = [
    { value: 0, label: "Tanpa Pembulatan" },
    { value: 100, label: "Bulatkan ke 100 terdekat" },
    { value: 500, label: "Bulatkan ke 500 terdekat" },
    { value: 1000, label: "Bulatkan ke 1.000 terdekat" },
];

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
    const [form, setForm] = useState({ Value: "", Name: "", Description: "", IsPurchased: false, IsSold: false, MarkupPercent: 0, RoundingType: 0 });

    // ─── Vendor Pricing (M_BPartnerProduct) ─────────────────────────────────
    const [vendorLines, setVendorLines] = useState([]);
    const [isLoadingVendorLines, setIsLoadingVendorLines] = useState(false);
    const [bPartnerSearch, setBPartnerSearch] = useState("");
    const [bPartnerOptions, setBPartnerOptions] = useState([]);

    // ─── Sales Price (M_ProductPrice) ───────────────────────────────────────
    const [priceLines, setPriceLines] = useState([]);
    const [isLoadingPriceLines, setIsLoadingPriceLines] = useState(false);
    const [priceListVersions, setPriceListVersions] = useState([]);

    // ─── FETCH: data utama produk ────────────────────────────────────────────
    const fetchProduct = useCallback(async () => {
        if (isNew) return; // Belum ada produk untuk di-fetch di mode New
        setIsLoading(true);
        try {
            const data = await idempiereApi(
                `/models/m_product/${id}?$select=Value,Name,Description,IsPurchased,IsSold,MarkupPercent,RoundingType`
            );
            setProduct(data);
            setForm({
                Value: data.Value || "",
                Name: data.Name || "",
                Description: data.Description || "",
                IsPurchased: data.IsPurchased === true || data.IsPurchased === "Y",
                IsSold: data.IsSold === true || data.IsSold === "Y",
                MarkupPercent: data.MarkupPercent ?? 0,
                RoundingType: data.RoundingType ?? 0,
            });
        } catch (err) {
            console.error("Gagal mengambil data produk:", err);
        } finally {
            setIsLoading(false);
        }
    }, [id, isNew]);

    // ─── FETCH: Vendor Pricing lines ────────────────────────────────────────
    // FIX: endpoint lama `/models/m_product_po` kemungkinan sudah usang — di
    // iDempiere versi modern tabel ini di-rename jadi M_BPartnerProduct
    // (struktur kolom sama persis, cuma nama tabel fisiknya berubah). Kalau
    // instance-mu ternyata masih versi lama yang belum di-rename, tinggal
    // ganti string di bawah balik ke 'm_product_po'.
    const fetchVendorLines = useCallback(async () => {
        if (isNew) return; // Tidak ada M_Product_ID untuk difilter di mode New
        setIsLoadingVendorLines(true);
        try {
            const query = `/models/m_bpartnerproduct?$filter=M_Product_ID eq ${id}`;
            const data = await idempiereApi(query);
            setVendorLines(data.records || []);
        } catch (err) {
            console.error("Gagal mengambil Vendor Pricing (M_BPartnerProduct):", err);
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

    useEffect(() => {
        fetchProduct();
        fetchVendorLines();
        fetchPriceLines();
        fetchPriceListVersions();
    }, [fetchProduct, fetchVendorLines, fetchPriceLines, fetchPriceListVersions]);

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

    if (isLoading) return <div className="card-container">Loading detail...</div>;
    if (!isNew && !product) return <div className="card-container">Produk tidak ditemukan.</div>;

    const getId = (obj) => obj?.id?.id ?? obj?.id;
    const getLabel = (field) => (typeof field === "object" ? field?.identifier : field) || "-";

    // ─── SAVE: field utama M_Product (create kalau New, update kalau Edit) ──
    const handleSaveProduct = async () => {
        const payload = {
            Value: form.Value,
            Name: form.Name,
            Description: form.Description,
            IsPurchased: form.IsPurchased,
            IsSold: form.IsSold,
            MarkupPercent: parseFloat(form.MarkupPercent) || 0,
            RoundingType: parseInt(form.RoundingType, 10) || 0,
        };

        try {
            if (isNew) {
                const created = await createProduct(payload);
                const newId = created?.id?.id ?? created?.id;
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
            alert(isNew ? "Gagal membuat produk baru." : "Gagal menyimpan perubahan produk.");
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
            alert("Gagal menyimpan baris vendor.");
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
            alert("Gagal menambah vendor. Cek apakah vendor ini sudah ada di daftar.");
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
            alert("Gagal menghapus baris vendor.");
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
            alert("Gagal menyimpan baris harga.");
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
            alert("Gagal menambah baris harga. Kemungkinan produk ini sudah punya baris di Price List Version tersebut.");
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
            alert("Gagal menghapus baris harga.");
        }
    };

    return (
        <div className="card-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <button onClick={() => navigate(-1)} className="btn-back">← Back to List</button>
                <span style={{ color: '#777' }}>{isNew ? "Produk Baru" : `Product ID: ${id}`}</span>
                {isNew ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(-1)} disabled={isSaving}>Batal</button>
                        <button onClick={handleSaveProduct} disabled={isSaving}>
                            {isSaving ? "Menyimpan..." : "💾 Buat Produk"}
                        </button>
                    </div>
                ) : !isEditing ? (
                    <button onClick={() => setIsEditing(true)}>✏ Edit</button>
                ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setIsEditing(false); fetchProduct(); }} disabled={isSaving}>Batal</button>
                        <button onClick={handleSaveProduct} disabled={isSaving}>
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
                        <label>Search Key</label>
                        {isEditing ? (
                            <input value={form.Value} onChange={(e) => setForm({ ...form, Value: e.target.value })} />
                        ) : <p>{product.Value}</p>}

                        <label>Name</label>
                        {isEditing ? (
                            <input value={form.Name} onChange={(e) => setForm({ ...form, Name: e.target.value })} />
                        ) : <p>{product.Name}</p>}

                        <label>Description</label>
                        {isEditing ? (
                            <textarea value={form.Description} onChange={(e) => setForm({ ...form, Description: e.target.value })} />
                        ) : <p>{product.Description || '-'}</p>}
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
                            <p>{ROUNDING_TYPE_OPTIONS.find((o) => o.value === product.RoundingType)?.label || product.RoundingType || '-'}</p>
                        )}
                    </div>
                </div>

                {isNew ? (
                    <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
                        <p style={{ color: '#777', fontStyle: 'italic' }}>
                            Simpan produk terlebih dahulu untuk bisa menambahkan Vendor Pricing dan Sales Price.
                        </p>
                    </div>
                ) : (
                <>
                {/* SECTION 3: VENDOR PRICING (M_BPartnerProduct) */}
                <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
                    <h3>Vendor Pricing (M_BPartnerProduct)</h3>

                    {isLoadingVendorLines ? (
                        <p>Memuat...</p>
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
                                {vendorLines.map((line) => {
                                    const lineId = getId(line);
                                    return (
                                        <tr key={lineId}>
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
                                            <td>
                                                <button onClick={() => handleSaveVendorLine(line)}>💾</button>
                                                <button onClick={() => handleDeleteVendorLine(lineId)}>🗑️</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Tambah vendor baru */}
                    <div style={{ marginTop: '10px', position: 'relative', maxWidth: '320px' }}>
                        <input
                            type="text"
                            placeholder="Cari vendor untuk ditambahkan..."
                            value={bPartnerSearch}
                            onChange={(e) => setBPartnerSearch(e.target.value)}
                        />
                        {bPartnerOptions.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', zIndex: 5 }}>
                                {bPartnerOptions.map((bp) => (
                                    <div
                                        key={getId(bp)}
                                        style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
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
                        <p>Memuat...</p>
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
                                {priceLines.map((line) => {
                                    const lineId = getId(line);
                                    return (
                                        <tr key={lineId}>
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
                                            <td>
                                                <button onClick={() => handleSavePriceLine(line)}>💾</button>
                                                <button onClick={() => handleDeletePriceLine(lineId)}>🗑️</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Tambah baris harga baru di Price List Version lain */}
                    <div style={{ marginTop: '10px' }}>
                        <select
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
                                .map((plv) => (
                                    <option key={getId(plv)} value={getId(plv)}>{getLabel(plv.Name) || getId(plv)}</option>
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
