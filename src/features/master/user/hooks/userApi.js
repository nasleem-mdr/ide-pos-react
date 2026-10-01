// src/features/master/user/hooks/userApi.js
// Pemanggilan REST iDempiere untuk user & role assignment (tanpa state React).
import { idempiereApi, fkId } from "@/api/idempiereApi";
import { isTrue } from "./roleConstants";

export const fetchActiveRoles = async () => {
    const res = await idempiereApi(`/models/ad_role?$filter=IsActive eq true&$select=Name&$orderby=Name`);
    return (res.records || []).map((r) => ({
        id: r.id ?? r.AD_Role_ID,
        name: r.Name || `Role ${r.id}`,
    }));
};

export const fetchUserList = async () => {
    const [userRes, urRes] = await Promise.all([
        idempiereApi(`/models/ad_user?$filter=IsActive eq true&$select=Name,EMail&$orderby=Name&$top=500`),
        idempiereApi(`/models/ad_user_roles?$filter=IsActive eq true&$select=AD_User_ID,AD_Role_ID&$top=2000`),
    ]);
    const roleByUser = new Map();
    (urRes.records || []).forEach((ur) => {
        const uid = fkId(ur.AD_User_ID);
        const rid = fkId(ur.AD_Role_ID);
        if (!roleByUser.has(uid)) roleByUser.set(uid, []);
        roleByUser.get(uid).push(rid);
    });
    return (userRes.records || []).map((u) => {
        const uid = u.id ?? u.AD_User_ID;
        return {
            id: uid,
            name: u.Name || "-",
            email: u.EMail || "-",
            isActive: isTrue(u.IsActive),
            roleIds: roleByUser.get(uid) || [],
        };
    });
};

// Data lengkap user + SEMUA record role assignment-nya (aktif & non-aktif)
// supaya soft-toggle bisa bekerja dua arah.
export const fetchUserDetail = async (id) => {
    const [user, urRes] = await Promise.all([
        idempiereApi(`/models/ad_user/${id}`),
        idempiereApi(`/models/ad_user_roles?$filter=AD_User_ID eq ${id}&$select=AD_Role_ID,IsActive&$top=500`),
    ]);
    const records = (urRes.records || []).map((r) => ({
        recordId: r.id ?? r.AD_User_Roles_ID,
        roleId: fkId(r.AD_Role_ID),
        isActive: isTrue(r.IsActive),
    }));
    return { user, records };
};

export const createUser = (body) => idempiereApi(`/models/ad_user`, { method: "POST", body: JSON.stringify(body) });
export const updateUser = (id, body) => idempiereApi(`/models/ad_user/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteUser = (id) => idempiereApi(`/models/ad_user/${id}`, { method: "DELETE" });

/**
 * Sinkronisasi role user (dipakai CREATE & EDIT, soft-toggle):
 *   - terpilih tanpa record       → POST
 *   - terpilih, record non-aktif  → PUT IsActive=true
 *   - dilepas, record aktif       → PUT IsActive=false
 * Kegagalan per-role dikumpulkan di `errors`, tidak menghentikan proses.
 */
export const syncUserRoles = async (userId, selectedRoleIds, records, roleNameById, errors) => {
    const nameOf = (rid) => roleNameById.get(rid) || rid;
    const recByRoleId = new Map(records.map((r) => [r.roleId, r]));

    for (const roleId of selectedRoleIds) {
        const rec = recByRoleId.get(roleId);
        try {
            if (!rec) {
                await idempiereApi(`/models/ad_user_roles`, {
                    method: "POST",
                    body: JSON.stringify({
                        AD_User_ID: { id: parseInt(userId, 10) },
                        AD_Role_ID: { id: parseInt(roleId, 10) },
                        IsActive: true,
                    }),
                });
            } else if (!rec.isActive) {
                await idempiereApi(`/models/ad_user_roles/${rec.recordId}`, {
                    method: "PUT", body: JSON.stringify({ IsActive: true }),
                });
            }
        } catch (err) {
            errors.push(`${nameOf(roleId)}: ${err.message}`);
        }
    }

    for (const rec of records) {
        if (rec.isActive && !selectedRoleIds.includes(rec.roleId)) {
            try {
                await idempiereApi(`/models/ad_user_roles/${rec.recordId}`, {
                    method: "PUT", body: JSON.stringify({ IsActive: false }),
                });
            } catch (err) {
                errors.push(`Lepas role ${nameOf(rec.roleId)}: ${err.message}`);
            }
        }
    }
};
