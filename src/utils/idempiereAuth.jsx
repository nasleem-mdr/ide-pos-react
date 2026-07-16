
    function safeJson(text) {
        try { return JSON.parse(text); } catch { return {}; }
    }

    export function normaliseList(data, key) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data[key])) return data[key];
        if (data && typeof data === "object") {
            const found = Object.values(data).find(Array.isArray);
            if (found) return found;
        }
        return [];
    }
    // Urutkan berdasarkan id (mis. AD_Client_ID, AD_Role_ID, dst), naik (ascending)
    export function sortById(list) {
        return [...list].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    }

    export async function apiLogin(username, password) {
        const res = await fetch(`api/v1/auth/tokens`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ userName: username, password }),
        });
        const text = await res.text();
        if (!res.ok) {
          const err = safeJson(text);
          throw new Error(err.detail || err.message || `Login gagal (${res.status})`);
        }
        const data = safeJson(text);
        if (data.token) {
          // Simpan terpisah dari 'token' final — dipakai khusus untuk cascade role/org/warehouse
          localStorage.setItem('loginToken', data.token);
        }
        return data;
    }

    export async function apiGetRoles(token, clientId) {
        const res = await fetch(`api/v1/auth/roles?client=${clientId}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        if (!res.ok) {
        const err = safeJson(text);
        throw new Error(err.detail || err.message || `Gagal ambil roles (${res.status})`);
        }
        return safeJson(text);
    }

    export  async function apiGetOrganizations(token, clientId, roleId) {
        const res = await fetch(`api/v1/auth/organizations?client=${clientId}&role=${roleId}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        if (!res.ok) {
        const err = safeJson(text);
        throw new Error(err.detail || err.message || `Gagal ambil organisasi (${res.status})`);
        }
        return safeJson(text);
    }
    
    export async function apiGetWarehouses(token, clientId, roleId, orgId) {
        const res = await fetch(`api/v1/auth/warehouses?client=${clientId}&role=${roleId}&organization=${orgId}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        if (!res.ok) {
        const err = safeJson(text);
        throw new Error(err.detail || err.message || `Gagal ambil warehouse (${res.status})`);
        }
        return safeJson(text);
    }
    
    export async function apiSetSession(token, clientId, roleId, orgId, warehouseId, language) {
        const payload = {
        clientId: parseInt(clientId, 10),
        roleId: parseInt(roleId, 10),
        organizationId: parseInt(orgId, 10),
        warehouseId: parseInt(warehouseId, 10),
        language
        };

        const res = await fetch(`api/v1/auth/tokens`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        });
    
        const text = await res.text();
    
        if (!res.ok) {
        const err = safeJson(text);
        throw new Error(err.detail || err.message || `Sesi gagal diperbarui (${res.status})`);
        }
    
        const data = safeJson(text);
    
        if (data.token) {
        localStorage.setItem('token', data.token);
        const userId = data.userId || (data.userContext && data.userContext.userId);
        if (userId) {
            localStorage.setItem('AD_User_ID', userId);
        } else {
            console.warn("AD_User_ID tidak ditemukan di respon API.");
        }
        localStorage.setItem('AD_Client_ID', clientId);
        localStorage.setItem('AD_Role_ID', roleId);
        localStorage.setItem('AD_Org_ID', orgId);
        localStorage.setItem('M_Warehouse_ID', warehouseId);
        }
    
        return data;
    }
