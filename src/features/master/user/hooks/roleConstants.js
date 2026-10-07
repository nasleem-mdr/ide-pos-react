// src/features/master/user/hooks/roleConstants.js

// Kolom Reference "List" di bxservice dikembalikan sebagai objek
// { propertyLabel, id, identifier, model-name } — ambil .id (kode list-nya).
export const listValue = (v) =>
    v && typeof v === "object" ? (v.id ?? v.identifier ?? "") : (v ?? "");

export const isTrue = (v) => v === true || v === "Y";

export const USER_LEVEL_OPTIONS = [
    { value: "CO", label: "Client (CO)" },
    { value: "CL", label: "Client + Organization (CL)" },
    { value: "OR", label: "Organization (OR)" },
    { value: "SS", label: "System (SS)" },
];

export const EMPTY_FORM = {
    name: "", description: "", userLevel: "CO",
    isActive: true, isCanReport: true, isCanExport: true, isShowAcct: false,
};

// 3 tabel access: endpoint + nama kolom FK-nya
export const ACCESS_DEFS = [
    { key: "org",    label: "🏬 Org Access (AD_Role_OrgAccess)",   table: "ad_role_orgaccess", fk: "AD_Org_ID" },
    { key: "window", label: "🪟 Window Access (AD_Window_Access)", table: "ad_window_access",  fk: "AD_Window_ID" },
    { key: "form",   label: "📋 Form Access (AD_Form_Access)",     table: "ad_form_access",    fk: "AD_Form_ID" },
];

// Window iDempiere yang dipakai aplikasi React ini. Hanya window di daftar ini yang
// tampil di picker Window Access.
//   - angka  → AD_Window_ID   (DISARANKAN: tidak terpengaruh rename / terjemahan)
//   - string → AD_Window.Name (cocok persis; bisa meleset kalau window di-rename)
// Boleh dicampur. Entri yang tidak ditemukan di server dicatat lewat console.warn.
export const APP_WINDOWS = [
    "Requisition",
    "Product",
    "Business Partner",
    "Sales Order",
    "Purchase Order",
    "Role",
    "User",
    "Physical Inventory",
    "Purchase Invoice and Credit/Debit Note",
    "Sales Invoice and Credit/Debit Note",
    "Bank/Cash Statement",
    "Payment and Receipt",
    "Sales Invoice",
];