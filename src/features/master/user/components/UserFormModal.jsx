// src/features/master/user/components/UserFormModal.jsx
// Satu modal untuk Buat Baru (mode "create") dan Edit (mode "edit").
import React from "react";
import UserFormFields from "./UserFormFields";
import RolePicker from "./RolePicker";
import styles from "./userStyles";

const UserFormModal = ({ modal, roles, rolesLoading, saving, error, onChangeForm, onToggleRole, onSave, onClose }) => {
    if (!modal) return null;
    const isCreate = modal.mode === "create";

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>
                    {isCreate ? "➕ Buat User Baru" : `✏️ Edit User — ${modal.form.name}`}
                </h3>

                <UserFormFields form={modal.form} onChange={onChangeForm} isCreate={isCreate} />
                {!isCreate && (
                    <p style={{ fontSize: "12px", color: "#888", margin: "10px 0 0" }}>Password tidak diubah lewat sini.</p>
                )}
                <RolePicker roles={roles} selectedIds={modal.selectedRoleIds} onToggle={onToggleRole} loading={rolesLoading} required={isCreate} />

                {error && <div style={styles.errorBox}>❌ <strong>Gagal:</strong> {error}</div>}

                <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-end" }}>
                    <button type="button" onClick={onClose} disabled={saving} style={styles.ghostBtn}>Batal</button>
                    <button type="button" onClick={onSave} disabled={saving} style={styles.saveBtn}>
                        {saving ? "⏳ Menyimpan..." : isCreate ? "💾 Buat User + Assignment Role" : "💾 Simpan Perubahan"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserFormModal;
