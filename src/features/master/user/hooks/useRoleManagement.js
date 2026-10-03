/**  src/features/master/user/hooks/useRoleManagement.js
 *   Seluruh state & logika bisnis Manajemen Role. UI hanya memakai return value hook ini.
*/
import { useState, useEffect, useCallback, useMemo } from "react";
import { ACCESS_DEFS, EMPTY_FORM, APP_WINDOW_NAMES, listValue, isTrue } from "./roleConstants";
import {
    fetchRefList, fetchAppWindows, fetchAccessRecords, fetchRoleList, fetchRoleDetail,
    createRole, updateRole, deleteRole, syncAccess,
} from "./roleApi";
import { checkRestrictedColumnExists } from "./restrictedFieldsApi";
import {
    RESTRICTED_FIELDS_COLUMN, analyzeRestrictedFields, normalizeRestrictedFields,
} from "@/config/fieldRestriction";

const REF_LOADERS = {
    org:    () => fetchRefList(`/models/ad_org?$filter=IsActive eq true&$select=Name&$orderby=Name`),
    window: () => fetchAppWindows(APP_WINDOW_NAMES), // hanya window yang dipakai aplikasi
    form:   () => fetchRefList(`/models/ad_form?$filter=IsActive eq true&$select=Name&$orderby=Name`),
};

// restrictedFields: string = kolom ada di AD_Role; null = kolom belum ada (input disembunyikan,
// kolom tidak dikirim saat simpan).
const emptyModal = (restrictionSupported) => ({
    mode: "create", id: null,
    form: { ...EMPTY_FORM, restrictedFields: restrictionSupported ? "" : null },
    original: null,
    selected: { org: [], window: [], form: [] },
    records: { org: new Map(), window: new Map(), form: new Map() },
});

const toRolePayload = (f) => {
    const payload = {
        Name: f.name.trim(),
        Description: f.description.trim(),
        UserLevel: f.userLevel,
        IsActive: f.isActive,
        IsCanReport: f.isCanReport,
        IsCanExport: f.isCanExport,
        IsShowAcct: f.isShowAcct,
    };
    if (typeof f.restrictedFields === "string") {
        payload[RESTRICTED_FIELDS_COLUMN] = normalizeRestrictedFields(f.restrictedFields);
    }
    return payload;
};

export default function useRoleManagement() {
    // ── Data ────────────────────────────────────────────────────────────
    const [roles, setRoles] = useState([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [refs, setRefs] = useState({ org: [], window: [], form: [] });
    const [loadingRefs, setLoadingRefs] = useState({ org: false, window: false, form: false });
    const [restrictionSupported, setRestrictionSupported] = useState(false);

    // ── UI state ────────────────────────────────────────────────────────
    const [modal, setModal] = useState(null);        // null = tertutup
    const [formError, setFormError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);      // { type: success|error|warn, text }
    const [togglingId, setTogglingId] = useState(null);
    const [loadingEditId, setLoadingEditId] = useState(null);
    const [confirm, setConfirm] = useState({ isOpen: false, role: null });
    const [deleting, setDeleting] = useState(false);

    // ── Fetch referensi picker ──────────────────────────────────────────
    useEffect(() => {
        Object.entries(REF_LOADERS).forEach(async ([key, load]) => {
            setLoadingRefs((p) => ({ ...p, [key]: true }));
            try {
                const list = await load();
                setRefs((p) => ({ ...p, [key]: list }));
            } catch (err) {
                console.error(`Gagal mengambil ${key}:`, err.message);
            } finally {
                setLoadingRefs((p) => ({ ...p, [key]: false }));
            }
        });
    }, []);

    // ── Cek kolom RestrictedFields di AD_Role (sekali) ──────────────────
    useEffect(() => {
        let cancelled = false;
        checkRestrictedColumnExists().then((ok) => { if (!cancelled) setRestrictionSupported(ok); });
        return () => { cancelled = true; };
    }, []);

    // ── Fetch daftar role + ringkasan akses ─────────────────────────────
    const fetchRoles = useCallback(async () => {
        setRolesLoading(true);
        try {
            const { roleRes, orgCount, winCount, formCount } = await fetchRoleList();
            setRoles((roleRes.records || []).map((r) => ({
                id: r.id,
                name: listValue(r.Name) || `Role ${r.id}`,
                userLevel: listValue(r.UserLevel) || "-",
                isActive: isTrue(r.IsActive),
                nOrg: orgCount.get(r.id) || 0,
                nWindow: winCount.get(r.id) || 0,
                nForm: formCount.get(r.id) || 0,
            })));
        } catch (err) {
            console.error("Gagal mengambil daftar role:", err.message);
            setRoles([]);
        } finally {
            setRolesLoading(false);
        }
    }, []);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    const nameById = useMemo(() => ({
        org: new Map(refs.org.map((o) => [o.id, o.name])),
        window: new Map(refs.window.map((w) => [w.id, w.name])),
        form: new Map(refs.form.map((f) => [f.id, f.name])),
    }), [refs]);

    // ── Modal: buka / tutup / ubah ──────────────────────────────────────
    const openCreate = () => { setFormError(null); setModal(emptyModal(restrictionSupported)); };

    const openEdit = async (role) => {
        setLoadingEditId(role.id);
        try {
            const roleRes = await fetchRoleDetail(role.id);
            const [orgAcc, winAcc, formAcc] = await Promise.all([
                fetchAccessRecords("ad_role_orgaccess", "AD_Org_ID", role.id),
                fetchAccessRecords("ad_window_access", "AD_Window_ID", role.id),
                fetchAccessRecords("ad_form_access", "AD_Form_ID", role.id),
            ]);
            const toMap = (acc) => new Map(acc.records.map((r) => [r.fkId, r]));

            const loadedForm = {
                name: listValue(roleRes.Name) || "",
                description: roleRes.Description || "",
                userLevel: listValue(roleRes.UserLevel) || "CO",
                isActive: isTrue(roleRes.IsActive),
                isCanReport: roleRes.IsCanReport !== false && roleRes.IsCanReport !== "N",
                isCanExport: roleRes.IsCanExport !== false && roleRes.IsCanExport !== "N",
                isShowAcct: isTrue(roleRes.IsShowAcct),
                // fetchRoleDetail mengembalikan semua kolom (tanpa $select).
                // Kalau memakai $select, tambahkan RestrictedFields ke daftar select-nya.
                restrictedFields: restrictionSupported
                    ? (typeof roleRes[RESTRICTED_FIELDS_COLUMN] === "string" ? roleRes[RESTRICTED_FIELDS_COLUMN] : "")
                    : null,
            };
            setFormError(null);
            setModal({
                mode: "edit",
                id: role.id,
                form: loadedForm,
                original: { ...loadedForm },
                selected: { org: orgAcc.activeIds, window: winAcc.activeIds, form: formAcc.activeIds },
                records: { org: toMap(orgAcc), window: toMap(winAcc), form: toMap(formAcc) },
            });
        } catch (err) {
            setNotice({ type: "error", text: `Gagal memuat data role untuk edit: ${err.message}` });
        } finally {
            setLoadingEditId(null);
        }
    };

    const closeModal = () => { if (!saving) setModal(null); };

    const setModalForm = (nextForm) => setModal((prev) => ({ ...prev, form: nextForm }));

    const toggleAccess = (key) => (idVal) =>
        setModal((prev) => ({
            ...prev,
            selected: {
                ...prev.selected,
                [key]: prev.selected[key].includes(idVal)
                    ? prev.selected[key].filter((x) => x !== idVal)
                    : [...prev.selected[key], idVal],
            },
        }));

    // ── SIMPAN (create & edit) ──────────────────────────────────────────
    const saveModal = async () => {
        const { mode, id, form, original, selected, records } = modal;
        if (!form.name.trim()) { setFormError("Name role wajib diisi."); return; }

        // Validasi Field Restriction: token tidak valid ditolak (bukan diam-diam dibuang).
        if (typeof form.restrictedFields === "string") {
            const { invalid } = analyzeRestrictedFields(form.restrictedFields);
            if (invalid.length > 0) {
                setFormError(`Field Restriction tidak valid: ${invalid.join(", ")}\nFormat: windowKey.NamaField (opsional :hide).`);
                return;
            }
        }

        setSaving(true);
        setFormError(null);
        const accessErrors = [];
        try {
            let roleId = id;
            if (mode === "create") {
                const created = await createRole(toRolePayload(form));
                roleId = created?.id ?? created?.AD_Role_ID;
                if (!roleId) throw new Error("Server tidak mengembalikan AD_Role_ID.");
            } else {
                // PUT hanya field yang berubah (menghindari validasi/side-effect dari field yang tidak diubah)
                const payload = toRolePayload(form);
                const before = toRolePayload(original);
                const changed = Object.fromEntries(Object.entries(payload).filter(([k, v]) => v !== before[k]));
                if (Object.keys(changed).length) await updateRole(id, changed);
            }

            for (const def of ACCESS_DEFS) {
                await syncAccess(def, roleId, selected[def.key], records[def.key], nameById[def.key], accessErrors);
            }

            await fetchRoles();
            setModal(null);
            setNotice(accessErrors.length
                ? { type: "warn", text: `Role "${form.name}" tersimpan, tapi ada ${accessErrors.length} akses yang gagal disinkronkan:\n• ${accessErrors.join("\n• ")}` }
                : { type: "success", text: mode === "create" ? `Role "${form.name}" berhasil dibuat (AD_Role_ID: ${roleId}).` : `Role "${form.name}" berhasil diperbarui.` });
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── HAPUS ───────────────────────────────────────────────────────────
    const requestDelete = (role) => setConfirm({ isOpen: true, role });
    const cancelDelete = () => setConfirm({ isOpen: false, role: null });
    const confirmDelete = async () => {
        const role = confirm.role;
        cancelDelete();
        setDeleting(true);
        try {
            await deleteRole(role.id);
            await fetchRoles();
            setNotice({ type: "success", text: `Role "${role.name}" berhasil dihapus.` });
        } catch (err) {
            setNotice({ type: "error", text: `Gagal menghapus role "${role.name}": ${err.message}\nKemungkinan role masih dipakai user / punya record akses. Alternatif aman: Nonaktifkan.` });
        } finally {
            setDeleting(false);
        }
    };

    // ── TOGGLE AKTIF ────────────────────────────────────────────────────
    const toggleActive = async (role) => {
        setTogglingId(role.id);
        try {
            await updateRole(role.id, { IsActive: !role.isActive });
            await fetchRoles();
        } catch (err) {
            setNotice({ type: "error", text: `Gagal mengubah status role "${role.name}": ${err.message}` });
        } finally {
            setTogglingId(null);
        }
    };

    return {
        // data
        roles, rolesLoading, refs, loadingRefs,
        // modal
        modal, formError, saving, openCreate, openEdit, closeModal, setModalForm, toggleAccess, saveModal,
        // aksi baris
        togglingId, loadingEditId, toggleActive,
        deleting, confirm, requestDelete, cancelDelete, confirmDelete,
        // notifikasi
        notice, dismissNotice: () => setNotice(null),
    };
}