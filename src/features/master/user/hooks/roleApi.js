// src/features/master/user/hooks/roleApi.js
// Pemanggilan REST iDempiere untuk role & access (tanpa state React).
import { idempiereApi, fkId } from "@/api/idempiereApi";
import { isTrue } from "./roleConstants";

const PAGE_SIZE = 100;
const MAX_PAGES = 100; // pengaman

/**
 * Ambil SEMUA record dengan paging ($top/$skip). Server iDempiere bisa membatasi
 * ukuran halaman (mis. 100) walau $top lebih besar — jadi $skip dimajukan
 * sebanyak record yang benar-benar diterima, bukan sebesar $top.
 * `url` tidak boleh memuat $top/$skip. Hasil: array record.
 */
export const fetchAllPages = async (url, pageSize = PAGE_SIZE) => {
    const sep = url.includes("?") ? "&" : "?";
    const all = [];
    let skip = 0;
    let prevFirst = null;
    for (let i = 0; i < MAX_PAGES; i++) {
        const res = await idempiereApi(`${url}${sep}$top=${pageSize}&$skip=${skip}`);
        const page = res.records || [];
        if (page.length === 0) break;
        // Server mengabaikan $skip → halaman yang sama berulang. (Tidak pakai r.id:
        // tabel access ber-PK komposit tidak punya id tunggal.)
        const first = JSON.stringify(page[0]);
        if (first === prevFirst) break;
        prevFirst = first;
        all.push(...page);
        skip += page.length;
        const total = res["row-count"];
        if (typeof total === "number" && skip >= total) break;
    }
    return all;
};

const odataStr = (s) => String(s).replace(/'/g, "''");

const toRef = (r) => ({ id: r.id, name: r.Name || `#${r.id}` });

export const fetchRefList = async (url) => (await fetchAllPages(url)).map(toRef);

// Window yang dipakai aplikasi saja (filter di server, daftar kecil → 1 request)
export const fetchAppWindows = async (names) => {
    if (!names?.length) return [];
    const nameFilter = names.map((n) => `Name eq '${odataStr(n)}'`).join(" or ");
    const rows = await fetchAllPages(
        `/models/ad_window?$filter=IsActive eq true and (${nameFilter})&$select=Name&$orderby=Name`
    );
    return rows.map(toRef);
};

// Fetch SEMUA record access sebuah role (aktif & non-aktif)
// → { records: [{ recordId, fkId, isActive }], activeIds: [fkId...] }
export const fetchAccessRecords = async (table, fkColumn, roleId) => {
    const rows = await fetchAllPages(
        `/models/${table}?$filter=AD_Role_ID eq ${roleId}`
    );
    const records = rows.map((r) => ({
        recordId: r.uid ?? r.id,   // tabel access ber-PK komposit: pakai uid
        fkId: Number(fkId(r[fkColumn])),
        isActive: isTrue(r.IsActive),
    }));
    return { records, activeIds: records.filter((r) => r.isActive).map((r) => r.fkId) };
};

// Hitung jumlah access aktif per role → Map roleId → jumlah
const countByRole = (rows) => {
    const m = new Map();
    rows.forEach((r) => {
        const rid = fkId(r.AD_Role_ID);
        m.set(rid, (m.get(rid) || 0) + 1);
    });
    return m;
};

export const fetchRoleList = async () => {
    const [roleRows, orgRows, winRows, formRows] = await Promise.all([
        fetchAllPages(`/models/ad_role?$filter=IsActive eq true&$select=Name,UserLevel&$orderby=Name`),
        fetchAllPages(`/models/ad_role_orgaccess?$filter=IsActive eq true&$select=AD_Role_ID`),
        fetchAllPages(`/models/ad_window_access?$filter=IsActive eq true&$select=AD_Role_ID`),
        fetchAllPages(`/models/ad_form_access?$filter=IsActive eq true&$select=AD_Role_ID`),
    ]);
    return {
        roleRes: { records: roleRows },
        orgCount: countByRole(orgRows),
        winCount: countByRole(winRows),
        formCount: countByRole(formRows),
    };
};

export const fetchRoleDetail = (id) => idempiereApi(`/models/ad_role/${id}`);
export const createRole = (body) => idempiereApi(`/models/ad_role`, { method: "POST", body: JSON.stringify(body) });
export const updateRole = (id, body) => idempiereApi(`/models/ad_role/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteRole = (id) => idempiereApi(`/models/ad_role/${id}`, { method: "DELETE" });

const isDuplicateErr = (err) => /duplicate key|unique/i.test(err?.message || "");

// Record sudah ada di DB (mis. tak terbaca di daftar) → cari lalu aktifkan bila non-aktif.
// Return true kalau baris (role, fk) itu KETEMU (berarti duplicate key-nya
// memang soal baris ini, sudah ditangani). Return false kalau tidak ketemu —
// artinya duplicate key itu bukan soal baris (role, fk) ini (lihat catatan
// di syncAccess soal sequence out-of-sync), dan pemanggil perlu retry POST.
const activateExisting = async (def, roleId, fkVal) => {
    const rows = await fetchAllPages(
        `/models/${def.table}?$filter=AD_Role_ID eq ${roleId} and ${def.fk} eq ${fkVal}`
    );
    const row = rows[0];
    if (!row) return false;
    if (!isTrue(row.IsActive)) {
        await idempiereApi(`/models/${def.table}/${row.uid ?? row.id}`, {
            method: "PUT", body: JSON.stringify({ IsActive: true }),
        });
    }
    return true;
};

// Berapa kali retry POST kalau "duplicate key" ternyata bukan soal baris
// (role, fk) yang kita insert (lihat catatan di syncAccess).
const MAX_DUPLICATE_RETRY = 3;

/**
 * Sinkronisasi satu tabel access (dipakai CREATE & EDIT, soft-toggle).
 * selectedIds : fkId yang TERpilih (termasuk yang tidak tampil di picker)
 * recordsByFk : Map fkId → { recordId, isActive } (semua status)
 */
export const syncAccess = async (def, roleId, selectedIds, recordsByFk, nameById, errors) => {
    const sel = selectedIds.map(Number);
    const nameOf = (fk) => nameById?.get(fk) || `#${fk}`;

    for (const fkVal of sel) {
        const rec = recordsByFk.get(fkVal);
        try {
            if (!rec) {
                const body = {
                    AD_Role_ID: { id: parseInt(roleId, 10) },
                    [def.fk]: { id: fkVal },
                    IsActive: true,
                };
                if (def.key !== "org") body.IsReadWrite = true; // window & form

                // "duplicate key" dari POST bisa berarti 2 hal berbeda:
                //  (a) baris (role, fk) ini MEMANG sudah ada di DB (mis. tidak
                //      kebaca waktu fetch awal) → activateExisting menemukannya
                //      lewat filter (AD_Role_ID, def.fk) dan cukup diaktifkan.
                //  (b) AD_Sequence untuk def.table tidak sinkron dengan
                //      MAX(id) sebenarnya (lazim setelah import/migrasi data
                //      manual) → bentrok terjadi di PK SURROGATE
                //      (AD_*_Access_ID), pada baris milik role/fk LAIN sama
                //      sekali → activateExisting (yang mencari berdasarkan
                //      role+fk kita) tidak akan menemukan apa pun.
                //      Di kasus (b), solusinya retry POST: nextval() Postgres
                //      TIDAK di-rollback walau transaksi POST sebelumnya
                //      gagal, jadi percobaan berikutnya otomatis dapat ID
                //      baru yang sudah lewat area yang bentrok — sampai
                //      akhirnya lolos atau MAX_DUPLICATE_RETRY habis.
                for (let attempt = 0; ; attempt++) {
                    try {
                        await idempiereApi(`/models/${def.table}`, { method: "POST", body: JSON.stringify(body) });
                        break; // sukses
                    } catch (postErr) {
                        if (!isDuplicateErr(postErr)) throw postErr;

                        const found = await activateExisting(def, roleId, fkVal);
                        if (found) break; // kasus (a): sudah diaktifkan, selesai

                        // kasus (b): tidak ketemu → retry POST, kecuali sudah mentok
                        if (attempt >= MAX_DUPLICATE_RETRY - 1) {
                            throw new Error(
                                `duplicate key tapi baris (role, fk) tidak ditemukan setelah ${MAX_DUPLICATE_RETRY}x percobaan ` +
                                `— kemungkinan AD_Sequence tabel ${def.table} tidak sinkron, perlu di-resync di server.`
                            );
                        }
                        // lanjut ke iterasi berikut → retry POST
                    }
                }
            } else if (!rec.isActive) {
                await idempiereApi(`/models/${def.table}/${rec.recordId}`, {
                    method: "PUT", body: JSON.stringify({ IsActive: true }),
                });
            }
        } catch (err) {
            errors.push(`${def.label}: ${nameOf(fkVal)} → ${err.message}`);
        }
    }

    // Lepas akses: record aktif yang tidak dipilih → matikan.
    for (const [fkVal, rec] of recordsByFk) {
        if (!sel.includes(Number(fkVal)) && rec.isActive) {
            try {
                await idempiereApi(`/models/${def.table}/${rec.recordId}`, {
                    method: "PUT", body: JSON.stringify({ IsActive: false }),
                });
            } catch (err) {
                errors.push(`${def.label}: lepas ${nameOf(fkVal)} → ${err.message}`);
            }
        }
    }
};