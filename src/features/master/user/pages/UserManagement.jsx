// src/features/master/user/pages/UserManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { idempiereApi, fkId } from "@/api/idempiereApi";
import { PageHeader } from "@/shared/components";
import "@/App.css";

/**
 * UserManagement — Tambah user (AD_User) + assignment role (AD_User_Roles).
 *
 * ALUR SIMPAN (2 langkah, transaksi per langkah):
 *   1) POST /models/ad_user        → Name, EMail (dipakai sebagai username
 *                                    login iDempiere), Password, Description,
 *                                    IsActive. Server yang hash password
 *                                    (beforeSave di model AD_User) — jangan
 *                                    hash di client.
 *   2) Untuk tiap role tercentang: POST /models/ad_user_roles
 *      { AD_User_ID, AD_Role_ID, IsActive }.
 *      Gagal di salah satu role TIDAK membatalkan user yang sudah ke-create —
 *      error role-nya dilaporkan satu per satu di modal hasil.
 *
 * CATATAN iDEMPUIERE:
 *   - Login user internal iDempiere memakai kolom EMail sebagai username
 *     (kecuali setup LDAP). Makanya field "Username / Email" di sini.
 *   - AD_User_Roles = tabel AD_User_Roles (huruf kecil di REST: ad_user_roles).
 *     Kombinasi AD_User_ID + AD_Role_ID unik — duplikat akan ditolak server.
 *   - Record role yang sudah ada TIDAK dihapus/diubah halaman ini; ini khusus
 *     create + lihat. Edit role per user bisa ditambah belakangan.
 */

const CHUNK_SIZE = 40; // untuk fetch role-name lookup (pola chunk seperti report)

const EMPTY_FORM = { name: "", email: "", password: "", confirm: "", description: "", isActive: true };

const UserManagement = () => {
    const [roles, setRoles] = useState([]);            // [{ id, Name }]
    const [rolesLoading, setRolesLoading] = useState(false);
    const [users, setUsers] = useState([]);            // [{ id, Name, EMail, IsActive, roleIds: [] }]
    const [usersLoading, setUsersLoading] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [selectedRoleIds, setSelectedRoleIds] = useState([]); // array of AD_Role_ID
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null); // { userId, roleErrors: [] } | { fatal: msg }
    const [togglingId, setTogglingId] = useState(null);

    // ─── FETCH: daftar role aktif ──────────────────────────────────────────
    const fetchRoles = useCallback(async () => {
        setRolesLoading(true);
        try {
            const res = await idempiereApi(
                `/models/ad_role?$filter=IsActive eq true&$select=Name&$orderby=Name`
            );
            const records = (res.records || []).map((r) => ({
                id: r.id ?? r.AD_Role_ID,
                name: r.Name || `Role ${r.id}`,
            }));
            setRoles(records);
            return records;
        } catch (err) {
            console.error("Gagal mengambil daftar role:", err.message);
            setRoles([]);
            return [];
        } finally {
            setRolesLoading(false);
        }
    }, []);

    // ─── FETCH: users + role assignment-nya ────────────────────────────────
    // Strategi: 1x ambil semua ad_user, 1x ambil semua ad_user_roles aktif,
    // lalu join di client (skala user POS kecil — puluhan record, aman).
    // Kalau user Anda bisa ratusan, ubah jadi chunked per user seperti pola
    // report (CHUNK_SIZE di atas).
    const fetchUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const [userRes, urRes] = await Promise.all([
                idempiereApi(`/models/ad_user?$filter=IsActive eq true&$select=Name,EMail&$orderby=Name&$top=500`),
                idempiereApi(`/models/ad_user_roles?$filter=IsActive eq true&$select=AD_User_ID,AD_Role_ID&$top=1000`),
            ]);
            const roleByUser = new Map(); // userId -> [roleId]
            (urRes.records || []).forEach((ur) => {
                const uid = fkId(ur.AD_User_ID);
                const rid = fkId(ur.AD_Role_ID);
                if (!roleByUser.has(uid)) roleByUser.set(uid, []);
                roleByUser.get(uid).push(rid);
            });
            const rows = (userRes.records || []).map((u) => ({
                id: u.id ?? u.AD_User_ID,
                name: u.Name || "-",
                email: u.EMail || "-",
                isActive: u.IsActive === true || u.IsActive === "Y",
                roleIds: roleByUser.get(u.id ?? u.AD_User_ID) || [],
            }));
            setUsers(rows);
        } catch (err) {
            console.error("Gagal mengambil daftar user:", err.message);
            setUsers([]);
        } finally {
            setUsersLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoles();
        fetchUsers();
    }, [fetchRoles, fetchUsers]);

    const roleNameById = useMemo(() => {
        const m = new Map();
        roles.forEach((r) => m.set(r.id, r.name));
        return m;
    }, [roles]);

    // ─── Toggle pilihan role di form ────────────────────────────────────────
    const handleToggleRole = (roleId) => {
        setSelectedRoleIds((prev) =>
            prev.includes(roleId) ? prev.filter((x) => x !== roleId) : [...prev, roleId]
        );
    };

    // ─── VALIDASI form ─────────────────────────────────────────────────────
    const validateForm = () => {
        const errors = [];
        if (!form.name.trim()) errors.push("Name wajib diisi");
        if (!form.email.trim()) errors.push("Username / Email wajib diisi");
        if (!form.password) errors.push("Password wajib diisi");
        else if (form.password.length < 6) errors.push("Password minimal 6 karakter");
        if (form.password !== form.confirm) errors.push("Konfirmasi password tidak sama");
        return errors;
    };

    // ─── SIMPAN: AD_User → AD_User_Roles ────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        const errors = validateForm();
        if (errors.length > 0) {
            setResult({ fatal: errors.join("\n• ") });
            return;
        }

        setSaving(true);
        setResult(null);
        try {
            // Langkah 1: buat user
            const created = await idempiereApi(`/models/ad_user`, {
                method: "POST",
                body: JSON.stringify({
                    Name: form.name.trim(),
                    EMail: form.email.trim(),
                    Password: form.password, // server yang hash — jangan di-hash client
                    Description: form.description.trim(),
                    IsActive: form.isActive,
                }),
            });
            const userId = fkId(created?.id) ?? created?.id ?? created?.AD_User_ID;
            if (!userId) throw new Error("Server tidak mengembalikan AD_User_ID.");

            // Langkah 2: assignment role satu per satu — gagal satu role
            // tidak menggagalkan role lain, error-nya dikumpulkan.
            const roleErrors = [];
            for (const roleId of selectedRoleIds) {
                try {
                    await idempiereApi(`/models/ad_user_roles`, {
                        method: "POST",
                        body: JSON.stringify({
                            AD_User_ID: { id: parseInt(userId, 10) },
                            AD_Role_ID: { id: parseInt(roleId, 10) },
                            IsActive: true,
                        }),
                    });
                } catch (err) {
                    const rname = roleNameById.get(roleId) || roleId;
                    roleErrors.push(`${rname}: ${err.message}`);
                }
            }

            setResult({
                userId,
                roleErrors,
                roleOk: selectedRoleIds.length - roleErrors.length,
            });
            setForm(EMPTY_FORM);
            setSelectedRoleIds([]);
            await fetchUsers();
        } catch (err) {
            setResult({ fatal: err.message });
        } finally {
            setSaving(false);
        }
    };

    // ─── AKTIF/NONAKTIFKAN user (PUT IsActive) — tidak menghapus data ───────
    const handleToggleActive = async (user) => {
        setTogglingId(user.id);
        try {
            await idempiereApi(`/models/ad_user/${user.id}`, {
                method: "PUT",
                body: JSON.stringify({ IsActive: !user.isActive }),
            });
            await fetchUsers();
        } catch (err) {
            alert(`Gagal mengubah status user "${user.name}":\n${err.message}`);
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="card-container">
            <PageHeader title="👥 Manajemen User (AD_User + Role)" />

            {/* ─── Form tambah user ─────────────────────────────────────── */}
            <div className="detail-section">
                <h3>Tambah User Baru</h3>
                <form onSubmit={handleSubmit}>
                    <div style={styles.formGrid}>
                        <div style={styles.field}>
                            <label style={styles.label}>Name *</label>
                            <input
                                style={styles.input}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Nama lengkap user"
                            />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Username / Email *</label>
                            <input
                                style={styles.input}
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="Dipakai untuk login iDempiere"
                            />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Password *</label>
                            <input
                                style={styles.input}
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Min. 6 karakter"
                            />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Konfirmasi Password *</label>
                            <input
                                style={styles.input}
                                type="password"
                                value={form.confirm}
                                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                            />
                        </div>
                        <div style={{ ...styles.field, gridColumn: "1 / -1" }}>
                            <label style={styles.label}>Description</label>
                            <input
                                style={styles.input}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Opsional — jabatan / keterangan"
                            />
                        </div>
                        <div style={styles.field}>
                            <label style={{ ...styles.label, display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                />
                                User Aktif
                            </label>
                        </div>
                    </div>

                    {/* ─── Pilihan role (AD_User_Roles) ─────────────────── */}
                    <h4 style={{ margin: "18px 0 8px" }}>Role * ({selectedRoleIds.length} dipilih)</h4>
                    {rolesLoading ? (
                        <p style={{ color: "#777" }}>Memuat daftar role...</p>
                    ) : roles.length === 0 ? (
                        <p style={{ color: "#777" }}>Tidak ada role aktif di iDempiere.</p>
                    ) : (
                        <div style={styles.roleGrid}>
                            {roles.map((r) => (
                                <label key={r.id} style={{
                                    ...styles.roleItem,
                                    ...(selectedRoleIds.includes(r.id) ? styles.roleItemActive : {}),
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedRoleIds.includes(r.id)}
                                        onChange={() => handleToggleRole(r.id)}
                                    />
                                    <span>{r.name}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    <button type="submit" disabled={saving} style={{ ...styles.saveBtn, marginTop: "18px" }}>
                        {saving ? "⏳ Menyimpan..." : "💾 Buat User + Assignment Role"}
                    </button>
                </form>

                {/* ─── Hasil simpan ─────────────────────────────────────── */}
                {result && (
                    <div style={{ ...styles.resultBox, background: result.fatal ? "#ffebee" : "#e8f5e9", borderColor: result.fatal ? "#ef9a9a" : "#a5d6a7" }}>
                        {result.fatal ? (
                            <>❌ <strong>Gagal:</strong> {result.fatal}</>
                        ) : (
                            <>
                                ✅ <strong>User "{form.name || "baru"}" berhasil dibuat</strong> (AD_User_ID: {result.userId})
                                {selectedRoleIds.length > 0 && (
                                    <div style={{ marginTop: "6px", fontSize: "13px" }}>
                                        Role ter-assign: {result.roleOk}/{selectedRoleIds.length}
                                        {result.roleErrors.length > 0 && (
                                            <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "#c62828" }}>
                                                {result.roleErrors.map((msg, i) => <li key={i}>{msg}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Daftar user existing ─────────────────────────────────── */}
            <div className="detail-section">
                <h3>Daftar User Aktif ({users.length})</h3>
                {usersLoading ? (
                    <p style={{ color: "#777" }}>Memuat...</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Username / Email</th>
                                    <th>Role</th>
                                    <th style={{ width: "140px" }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td>{u.name}</td>
                                        <td>{u.email}</td>
                                        <td>
                                            {u.roleIds.length === 0 ? (
                                                <span style={{ color: "#999" }}>— tanpa role —</span>
                                            ) : (
                                                u.roleIds.map((rid) => (
                                                    <span key={rid} style={styles.roleBadge}>
                                                        {roleNameById.get(rid) || `Role #${rid}`}
                                                    </span>
                                                ))
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleToggleActive(u)}
                                                disabled={togglingId === u.id}
                                                style={u.isActive ? styles.deactivateBtn : styles.activateBtn}
                                            >
                                                {togglingId === u.id ? "..." : u.isActive ? "Nonaktifkan" : "Aktifkan"}
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
    roleGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
    roleItem: {
        display: "flex", alignItems: "center", gap: "7px", padding: "7px 12px",
        border: "1px solid #ccc", borderRadius: "20px", cursor: "pointer", fontSize: "13px",
        background: "#fff", userSelect: "none",
    },
    roleItemActive: { borderColor: "#1565c0", background: "#e3f2fd", fontWeight: 600 },
    saveBtn: { backgroundColor: "#1565c0", color: "#fff", border: "none", padding: "11px 22px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
    resultBox: { marginTop: "14px", border: "1px solid", borderRadius: "8px", padding: "12px 14px", fontSize: "13.5px" },
    roleBadge: {
        display: "inline-block", background: "#e3f2fd", color: "#0d47a1",
        padding: "2px 9px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, margin: "2px 4px 2px 0",
    },
    deactivateBtn: { background: "#fff", color: "#c62828", border: "1px solid #c62828", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
    activateBtn: { background: "#2e7d32", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
};

export default UserManagement;
