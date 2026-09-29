// src/features/master/user/pages/RoleManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { idempiereApi, fkId } from "@/api/idempiereApi";
import { PageHeader } from "@/shared/components";
import "@/App.css";

/**
 * RoleManagement — Tambah role (AD_Role) lengkap dengan akses:
 *   - AD_Role_OrgAccess   → role boleh akses org apa saja
 *   - AD_Window_Access    → role boleh buka window apa saja (IsReadWrite=Y)
 *   - AD_Form_Access      → role boleh buka form apa saja (IsReadWrite=Y)
 *
 * ALUR SIMPAN (4 langkah terpisah, error dikumpulkan per langkah):
 *   1) POST /models/ad_role
 *   2) POST /models/ad_role_orgaccess   per org terpilih
 *   3) POST /models/ad_window_access    per window terpilih
 *   4) POST /models/ad_form_access      per form terpilih
 *
 * CATATAN iDEMPUIERE:
 *   - Payload access sengaja MINIMAL (hanya FK + IsActive + IsReadWrite).
 *     Kolom lain seperti IsReadOnly di AD_Role_OrgAccess hanya ada di
 *     beberapa versi — kirim kolom yang tidak ada = error 400
 *     "not a valid column" (pelajaran dari DueDate di report invoice).
 *   - AD_Window_Access.IsReadWrite & AD_Form_Access.IsReadWrite default "Y"
 *     (full access). Kalau mau read-only, ubah payload jadi "N".
 *   - UserLevel: CO=Client, CL=Client+Organization, OR=Organization,
 *     SS=System. ⚠️ Sesuaikan default-nya dengan kebijakan instance-mu.
 *   - Role TANPA org access = user dengan role itu tidak lihat data apa pun.
 *   - List window di iDempiere ratusan record — fetch $top=500 + grid scroll.
 */

// ─── Opsi UserLevel (AD_Ref_List) ─────────────────────────────────────────
const USER_LEVEL_OPTIONS = [
    { value: "CO", label: "Client (CO)" },
    { value: "CL", label: "Client + Organization (CL)" },
    { value: "OR", label: "Organization (OR)" },
    { value: "SS", label: "System (SS)" },
];

const EMPTY_FORM = {
    name: "",
    description: "",
    userLevel: "CO", // ⚠️ default — sesuaikan kebijakan instance-mu
    isActive: true,
    isCanReport: true,
    isCanExport: true,
    isShowAcct: false,
};

const AccessPicker = ({ title, items, selectedIds, onToggle, loading, idKey = "id" }) => (
    <div style={{ marginTop: "14px" }}>
        <h4 style={{ margin: "0 0 8px" }}>
            {title} <span style={{ fontWeight: "normal", color: "#666", fontSize: "12.5px" }}>({selectedIds.length} dipilih)</span>
        </h4>
        {loading ? (
            <p style={{ color: "#777", fontSize: "13px" }}>Memuat...</p>
        ) : items.length === 0 ? (
            <p style={{ color: "#777", fontSize: "13px" }}>Tidak ada data aktif.</p>
        ) : (
            <div style={styles.pickerGrid}>
                {items.map((it) => (
                    <label
                        key={it[idKey]}
                        style={{ ...styles.pickerItem, ...(selectedIds.includes(it[idKey]) ? styles.pickerItemActive : {}) }}
                    >
                        <input
                            type="checkbox"
                            checked={selectedIds.includes(it[idKey])}
                            onChange={() => onToggle(it[idKey])}
                        />
                        <span>{it.name}</span>
                    </label>
                ))}
            </div>
        )}
    </div>
);

const RoleManagement = () => {
    const [form, setForm] = useState(EMPTY_FORM);
    const [orgs, setOrgs] = useState([]);
    const [windows, setWindows] = useState([]);
    const [forms, setForms] = useState([]);
    const [loadingRefs, setLoadingRefs] = useState({ org: false, window: false, form: false });

    const [roles, setRoles] = useState([]); // [{ id, Name, UserLevel, IsActive, nOrg, nWindow, nForm }]
    const [rolesLoading, setRolesLoading] = useState(false);

    const [selectedOrgIds, setSelectedOrgIds] = useState([]);
    const [selectedWindowIds, setSelectedWindowIds] = useState([]);
    const [selectedFormIds, setSelectedFormIds] = useState([]);

    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    const toggleIn = (setter) => (idVal) =>
        setter((prev) => (prev.includes(idVal) ? prev.filter((x) => x !== idVal) : [...prev, idVal]));

    // ─── FETCH referensi untuk picker ──────────────────────────────────────
    useEffect(() => {
        const load = async (url, key, mapFn) => {
            setLoadingRefs((p) => ({ ...p, [key]: true }));
            try {
                const res = await idempiereApi(url);
                const records = (res.records || []).map(mapFn);
                if (key === "org") setOrgs(records);
                if (key === "window") setWindows(records);
                if (key === "form") setForms(records);
            } catch (err) {
                console.error(`Gagal mengambil ${key}:`, err.message);
            } finally {
                setLoadingRefs((p) => ({ ...p, [key]: false }));
            }
        };
        load(`/models/ad_org?$filter=IsActive eq true&$select=Name&$orderby=Name&$top=200`, "org", (r) => ({
            id: r.id ?? r.AD_Org_ID,
            name: r.Name || `Org ${r.id}`,
        }));
        load(`/models/ad_window?$filter=IsActive eq true&$select=Name&$orderby=Name&$top=500`, "window", (r) => ({
            id: r.id ?? r.AD_Window_ID,
            name: r.Name || `Window ${r.id}`,
        }));
        load(`/models/ad_form?$filter=IsActive eq true&$select=Name&$orderby=Name&$top=200`, "form", (r) => ({
            id: r.id ?? r.AD_Form_ID,
            name: r.Name || `Form ${r.id}`,
        }));
    }, []);

    // ─── FETCH daftar role + ringkasan aksesnya (join client-side) ──────────
    const fetchRoles = useCallback(async () => {
        setRolesLoading(true);
        try {
            const [roleRes, orgAccRes, winAccRes, formAccRes] = await Promise.all([
                idempiereApi(`/models/ad_role?$filter=IsActive eq true&$select=Name,UserLevel&$orderby=Name&$top=200`),
                idempiereApi(`/models/ad_role_orgaccess?$filter=IsActive eq true&$select=AD_Role_ID&$top=2000`),
                idempiereApi(`/models/ad_window_access?$filter=IsActive eq true&$select=AD_Role_ID&$top=3000`),
                idempiereApi(`/models/ad_form_access?$filter=IsActive eq true&$select=AD_Role_ID&$top=1000`),
            ]);
            const countBy = (res) => {
                const m = new Map();
                (res.records || []).forEach((r) => {
                    const rid = fkId(r.AD_Role_ID);
                    m.set(rid, (m.get(rid) || 0) + 1);
                });
                return m;
            };
            const orgCount = countBy(orgAccRes);
            const winCount = countBy(winAccRes);
            const formCount = countBy(formAccRes);
            setRoles(
                (roleRes.records || []).map((r) => {
                    const rid = r.id ?? r.AD_Role_ID;
                    return {
                        id: rid,
                        name: r.Name || `Role ${rid}`,
                        userLevel: r.UserLevel || "-",
                        isActive: r.IsActive === true || r.IsActive === "Y",
                        nOrg: orgCount.get(rid) || 0,
                        nWindow: winCount.get(rid) || 0,
                        nForm: formCount.get(rid) || 0,
                    };
                })
            );
        } catch (err) {
            console.error("Gagal mengambil daftar role:", err.message);
            setRoles([]);
        } finally {
            setRolesLoading(false);
        }
    }, []);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    // ─── SIMPAN: AD_Role → 3 tabel access ──────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setResult({ fatal: "Name role wajib diisi." });
            return;
        }
        setSaving(true);
        setResult(null);
        const accessErrors = [];
        try {
            // 1) AD_Role
            const created = await idempiereApi(`/models/ad_role`, {
                method: "POST",
                body: JSON.stringify({
                    Name: form.name.trim(),
                    Description: form.description.trim(),
                    UserLevel: form.userLevel,
                    IsActive: form.isActive,
                    IsCanReport: form.isCanReport,
                    IsCanExport: form.isCanExport,
                    IsShowAcct: form.isShowAcct,
                }),
            });
            const roleId = fkId(created?.id) ?? created?.id ?? created?.AD_Role_ID;
            if (!roleId) throw new Error("Server tidak mengembalikan AD_Role_ID.");

            // 2) Org Access — payload minimal: FK + IsActive saja
            for (const oid of selectedOrgIds) {
                try {
                    await idempiereApi(`/models/ad_role_orgaccess`, {
                        method: "POST",
                        body: JSON.stringify({
                            AD_Role_ID: { id: parseInt(roleId, 10) },
                            AD_Org_ID: { id: parseInt(oid, 10) },
                            IsActive: true,
                        }),
                    });
                } catch (err) {
                    accessErrors.push(`Org #${oid}: ${err.message}`);
                }
            }

            // 3) Window Access — IsReadWrite Y = full access
            for (const wid of selectedWindowIds) {
                try {
                    await idempiereApi(`/models/ad_window_access`, {
                        method: "POST",
                        body: JSON.stringify({
                            AD_Role_ID: { id: parseInt(roleId, 10) },
                            AD_Window_ID: { id: parseInt(wid, 10) },
                            IsActive: true,
                            IsReadWrite: true,
                        }),
                    });
                } catch (err) {
                    const wname = windows.find((w) => w.id === wid)?.name || `Window #${wid}`;
                    accessErrors.push(`${wname}: ${err.message}`);
                }
            }

            // 4) Form Access
            for (const fid of selectedFormIds) {
                try {
                    await idempiereApi(`/models/ad_form_access`, {
                        method: "POST",
                        body: JSON.stringify({
                            AD_Role_ID: { id: parseInt(roleId, 10) },
                            AD_Form_ID: { id: parseInt(fid, 10) },
                            IsActive: true,
                            IsReadWrite: true,
                        }),
                    });
                } catch (err) {
                    const fname = forms.find((f) => f.id === fid)?.name || `Form #${fid}`;
                    accessErrors.push(`${fname}: ${err.message}`);
                }
            }

            const totalAccess = selectedOrgIds.length + selectedWindowIds.length + selectedFormIds.length;
            setResult({
                roleId,
                accessErrors,
                accessOk: totalAccess - accessErrors.length,
                accessTotal: totalAccess,
            });
            setForm(EMPTY_FORM);
            setSelectedOrgIds([]);
            setSelectedWindowIds([]);
            setSelectedFormIds([]);
            await fetchRoles();
        } catch (err) {
            setResult({ fatal: err.message });
        } finally {
            setSaving(false);
        }
    };

    // ─── Aktif/Nonaktif role (PUT IsActive — tidak menghapus akses) ─────────
    const handleToggleActive = async (role) => {
        setTogglingId(role.id);
        try {
            await idempiereApi(`/models/ad_role/${role.id}`, {
                method: "PUT",
                body: JSON.stringify({ IsActive: !role.isActive }),
            });
            await fetchRoles();
        } catch (err) {
            alert(`Gagal mengubah status role "${role.name}":\n${err.message}`);
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="card-container">
            <PageHeader title="🛡️ Manajemen Role (AD_Role + Access)" />

            {/* ─── Form tambah role ─────────────────────────────────────── */}
            <div className="detail-section">
                <h3>Tambah Role Baru</h3>
                <form onSubmit={handleSubmit}>
                    <div style={styles.formGrid}>
                        <div style={styles.field}>
                            <label style={styles.label}>Name *</label>
                            <input
                                style={styles.input}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Contoh: Kasir POS, Supervisor Gudang"
                            />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>User Level *</label>
                            <select
                                style={styles.input}
                                value={form.userLevel}
                                onChange={(e) => setForm({ ...form, userLevel: e.target.value })}
                            >
                                {USER_LEVEL_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ ...styles.field, gridColumn: "1 / -1" }}>
                            <label style={styles.label}>Description</label>
                            <input
                                style={styles.input}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Opsional — deskripsi tugas role"
                            />
                        </div>
                        <div style={styles.checkRow}>
                            <label style={styles.checkItem}>
                                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                                Role Aktif
                            </label>
                            <label style={styles.checkItem}>
                                <input type="checkbox" checked={form.isCanReport} onChange={(e) => setForm({ ...form, isCanReport: e.target.checked })} />
                                Can Report
                            </label>
                            <label style={styles.checkItem}>
                                <input type="checkbox" checked={form.isCanExport} onChange={(e) => setForm({ ...form, isCanExport: e.target.checked })} />
                                Can Export
                            </label>
                            <label style={styles.checkItem} title="Tampilkan info akunting (Account Info)">
                                <input type="checkbox" checked={form.isShowAcct} onChange={(e) => setForm({ ...form, isShowAcct: e.target.checked })} />
                                Show Accounting
                            </label>
                        </div>
                    </div>

                    {/* ─── Access pickers ────────────────────────────────── */}
                    <AccessPicker
                        title="🏬 Org Access (AD_Role_OrgAccess)"
                        items={orgs}
                        selectedIds={selectedOrgIds}
                        onToggle={toggleIn(setSelectedOrgIds)}
                        loading={loadingRefs.org}
                    />
                    <AccessPicker
                        title="🪟 Window Access (AD_Window_Access)"
                        items={windows}
                        selectedIds={selectedWindowIds}
                        onToggle={toggleIn(setSelectedWindowIds)}
                        loading={loadingRefs.window}
                    />
                    <AccessPicker
                        title="📋 Form Access (AD_Form_Access)"
                        items={forms}
                        selectedIds={selectedFormIds}
                        onToggle={toggleIn(setSelectedFormIds)}
                        loading={loadingRefs.form}
                    />

                    <button type="submit" disabled={saving} style={{ ...styles.saveBtn, marginTop: "18px" }}>
                        {saving ? "⏳ Menyimpan..." : "💾 Buat Role + Semua Akses"}
                    </button>
                </form>

                {result && (
                    <div style={{ ...styles.resultBox, background: result.fatal ? "#ffebee" : "#e8f5e9", borderColor: result.fatal ? "#ef9a9a" : "#a5d6a7" }}>
                        {result.fatal ? (
                            <>❌ <strong>Gagal:</strong> {result.fatal}</>
                        ) : (
                            <>
                                ✅ <strong>Role berhasil dibuat</strong> (AD_Role_ID: {result.roleId})
                                <div style={{ marginTop: "6px", fontSize: "13px" }}>
                                    Akses ter-assign: {result.accessOk}/{result.accessTotal}
                                    {result.accessErrors.length > 0 && (
                                        <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "#c62828" }}>
                                            {result.accessErrors.map((msg, i) => <li key={i}>{msg}</li>)}
                                        </ul>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Daftar role existing ─────────────────────────────────── */}
            <div className="detail-section">
                <h3>Daftar Role Aktif ({roles.length})</h3>
                {rolesLoading ? (
                    <p style={{ color: "#777" }}>Memuat...</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th style={{ width: "90px" }}>User Level</th>
                                    <th style={{ textAlign: "center" }}>Org</th>
                                    <th style={{ textAlign: "center" }}>Window</th>
                                    <th style={{ textAlign: "center" }}>Form</th>
                                    <th style={{ width: "130px" }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.name}</td>
                                        <td><span style={styles.lvlBadge}>{r.userLevel}</span></td>
                                        <td style={{ textAlign: "center" }}>{r.nOrg}</td>
                                        <td style={{ textAlign: "center" }}>{r.nWindow}</td>
                                        <td style={{ textAlign: "center" }}>{r.nForm}</td>
                                        <td>
                                            <button
                                                onClick={() => handleToggleActive(r)}
                                                disabled={togglingId === r.id}
                                                style={r.isActive ? styles.deactivateBtn : styles.activateBtn}
                                            >
                                                {togglingId === r.id ? "..." : r.isActive ? "Nonaktifkan" : "Aktifkan"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" },
    field: { display: "flex", flexDirection: "column", gap: "4px" },
    label: { fontSize: "12.5px", fontWeight: 600, color: "#555" },
    input: { padding: "9px 11px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13.5px" },
    checkRow: { gridColumn: "1 / -1", display: "flex", gap: "18px", flexWrap: "wrap" },
    checkItem: { display: "flex", alignItems: "center", gap: "7px", fontSize: "13.5px" },
    pickerGrid: {
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
        gap: "7px", maxHeight: "190px", overflowY: "auto",
        border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px", background: "#fafafa",
    },
    pickerItem: {
        display: "flex", alignItems: "center", gap: "7px", padding: "6px 10px",
        border: "1px solid #ccc", borderRadius: "16px", cursor: "pointer",
        fontSize: "12.5px", background: "#fff", userSelect: "none",
    },
    pickerItemActive: { borderColor: "#1565c0", background: "#e3f2fd", fontWeight: 600 },
    saveBtn: { backgroundColor: "#1565c0", color: "#fff", border: "none", padding: "11px 22px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
    resultBox: { marginTop: "14px", border: "1px solid", borderRadius: "8px", padding: "12px 14px", fontSize: "13.5px" },
    lvlBadge: { background: "#eceff1", padding: "2px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 },
    deactivateBtn: { background: "#fff", color: "#c62828", border: "1px solid #c62828", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
    activateBtn: { background: "#2e7d32", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
};

export default RoleManagement;
