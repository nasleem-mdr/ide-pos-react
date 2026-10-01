// src/config/fieldRestriction.js
//
// Pembatasan edit level FIELD per role — pasangan dari windowAccessMap
// (yang membatasi level WINDOW).
//
// Sumber data: 1 kolom string di AD_Role (nama kolom di bawah).
//
// FORMAT isi kolom (dipisah koma / titik-koma / baris baru):
//   <windowKey>.<NamaField>          → field read-only
//   <windowKey>.<NamaField>:hide     → field disembunyikan
//   *.<NamaField>                    → berlaku di semua window
//
// <windowKey> = key yang sama dengan windowAccessMap / ProtectedRoute
// (mis. product, businessPartner, purchaseOrder). Tidak case-sensitive.
//
// Contoh isi:
//   product.PriceList, product.PriceStd, purchaseOrder.PriceEntered:hide, *.Discount

export const RESTRICTED_FIELDS_COLUMN = "RestrictedFields"; // ganti sesuai nama kolom di AD_Role

export const parseRestrictedFields = (raw) => {
    const rules = {}; // { windowKey(lower): { field(lower): 'readonly' | 'hidden' } }
    if (!raw || typeof raw !== "string") return rules;

    raw.split(/[,;\n]+/).forEach((token) => {
        const t = token.trim();
        if (!t) return;
        const [target, mode] = t.split(":").map((s) => s.trim());
        const dot = target.indexOf(".");
        if (dot <= 0 || dot === target.length - 1) {
            console.warn(`RestrictedFields: format tidak valid, dilewati → "${t}"`);
            return;
        }
        const win = target.slice(0, dot).toLowerCase();
        const field = target.slice(dot + 1).toLowerCase();
        if (!rules[win]) rules[win] = {};
        rules[win][field] = mode && mode.toLowerCase() === "hide" ? "hidden" : "readonly";
    });
    return rules;
};

// Return: 'hidden' | 'readonly' | null. 'hidden' menang atas 'readonly'.
export const resolveFieldMode = (rules, windowKey, field) => {
    const w = String(windowKey || "").toLowerCase();
    const f = String(field || "").toLowerCase();
    const specific = rules[w] && rules[w][f];
    const wildcard = rules["*"] && rules["*"][f];
    if (specific === "hidden" || wildcard === "hidden") return "hidden";
    return specific || wildcard || null;
};
