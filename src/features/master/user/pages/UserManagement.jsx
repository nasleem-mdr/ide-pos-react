// src/features/master/user/pages/UserManagement.jsx
import React from "react";
import { PageHeader } from "@/shared/components";
import "@/App.css";
import { useUserList } from "../hooks/useUserList";
import { useUserSubmit } from "../hooks/useUserSubmit";
import UserForm from "../components/UserForm";
import SaveResultBox from "../components/SaveResultBox";
import UserTable from "../components/UserTable";

/**
 * UserManagement — Tambah user (AD_User) + assignment role (AD_User_Roles).
 * Page hanya menyusun hook + komponen. Logika ada di:
 *   - hooks/useUserList.js   (fetch role/user, toggle aktif)
 *   - hooks/useUserSubmit.js (form, validasi, simpan 2 langkah)
 */
const UserManagement = () => {
    const {
        roles, rolesLoading, roleNameById,
        users, usersLoading, togglingId,
        refreshUsers, toggleActive,
    } = useUserList();

    const {
        form, setField, selectedRoleIds, toggleRole,
        saving, result, submit,
    } = useUserSubmit({ roleNameById, onCreated: refreshUsers });

    const handleToggleActive = async (user) => {
        const res = await toggleActive(user);
        if (!res.ok) {
            alert(`Gagal mengubah status user "${user.name}":\n${res.error}`);
        }
    };

    return (
        <div className="card-container">
            <PageHeader title="👥 Manajemen User (AD_User + Role)" />

            <div className="detail-section">
                <h3>Tambah User Baru</h3>
                <UserForm
                    form={form}
                    onFieldChange={setField}
                    roles={roles}
                    rolesLoading={rolesLoading}
                    selectedRoleIds={selectedRoleIds}
                    onToggleRole={toggleRole}
                    saving={saving}
                    onSubmit={submit}
                />
                <SaveResultBox result={result} />
            </div>

            <div className="detail-section">
                <h3>Daftar User Aktif ({users.length})</h3>
                <UserTable
                    users={users}
                    loading={usersLoading}
                    roleNameById={roleNameById}
                    togglingId={togglingId}
                    onToggleActive={handleToggleActive}
                />
            </div>
        </div>
    );
};

export default UserManagement;
