// src/features/master/user/components/RoleFormFields.jsx
import React from "react";
import { USER_LEVEL_OPTIONS } from "../hooks/roleConstants";
import { analyzeRestrictedFields } from "@/config/fieldRestriction";
import styles from "./roleStyles";

const hintStyle = { fontSize: "11.5px", color: "#777", lineHeight: 1.5 };
const chipStyle = (hide) => ({
    display: "inline-block", padding: "2px 9px", borderRadius: "10px", fontSize: "12px",
    fontWeight: 600, margin: "2px 4px 2px 0",
    background: hide ? "#ffebee" : "#fff3e0", color: hide ? "#c62828" : "#e65100",
});

const RoleFormFields = ({ form, onChange }) => {
    const set = (patch) => onChange({ ...form, ...patch });

    // restrictedFields === null/undefined → kolom belum ada di AD_Role → input disembunyikan.
    const showRestriction = typeof form.restrictedFields === "string";
    const { entries, invalid } = showRestriction
        ? analyzeRestrictedFields(form.restrictedFields)
        : { entries: [], invalid: [] };

    return (
        <div style={styles.formGrid}>
            <div style={styles.field}>
                <label style={styles.label}>Name *</label>
                <input style={styles.input} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Contoh: Kasir POS, Supervisor Gudang" />
            </div>
            <div style={styles.field}>
                <label style={styles.label}>User Level *</label>
                <select style={styles.input} value={form.userLevel} onChange={(e) => set({ userLevel: e.target.value })}>
                    {USER_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>
            <div style={{ ...styles.field, gridColumn: "1 / -1" }}>
                <label style={styles.label}>Description</label>
                <input style={styles.input} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Opsional — deskripsi tugas role" />
            </div>
            <div style={styles.checkRow}>
                <label style={styles.checkItem}>
                    <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Role Aktif
                </label>
                <label style={styles.checkItem}>
                    <input type="checkbox" checked={form.isCanReport} onChange={(e) => set({ isCanReport: e.target.checked })} /> Can Report
                </label>
                <label style={styles.checkItem}>
                    <input type="checkbox" checked={form.isCanExport} onChange={(e) => set({ isCanExport: e.target.checked })} /> Can Export
                </label>
                <label style={styles.checkItem} title="Tampilkan info akunting">
                    <input type="checkbox" checked={form.isShowAcct} onChange={(e) => set({ isShowAcct: e.target.checked })} /> Show Accounting
                </label>
            </div>

            {showRestriction && (
                <div style={{ ...styles.field, gridColumn: "1 / -1" }}>
                    <label style={styles.label}>Field Restriction (batasi edit per field)</label>
                    <textarea
                        rows={3}
                        style={{ ...styles.input, fontFamily: "monospace", resize: "vertical" }}
                        value={form.restrictedFields}
                        onChange={(e) => set({ restrictedFields: e.target.value })}
                        placeholder="pos.PriceEntered, product.PriceList:hide, *.Discount"
                    />
                    <div style={hintStyle}>
                        Format <code>windowKey.NamaField</code> = read-only · tambah <code>:hide</code> = disembunyikan ·
                        <code> *.NamaField</code> = semua window. Pisahkan dengan koma / baris baru.
                        Berlaku untuk user role ini setelah login ulang.
                    </div>
                    {invalid.length > 0 && (
                        <div style={{ fontSize: "12px", color: "#c62828" }}>
                            ⚠ Format tidak valid: {invalid.join(" · ")}
                        </div>
                    )}
                    {entries.length > 0 && (
                        <div>
                            {entries.map((e, i) => (
                                <span key={i} style={chipStyle(e.mode === "hide")}>
                                    {e.windowKey}.{e.field} · {e.mode === "hide" ? "hidden" : "read-only"}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RoleFormFields;