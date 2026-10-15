// src/features/finance/bank-transfer/utils/bankTransferApi.js
// Lapisan akses data Bank/Cash Transfer (tabel C_BankTransfer) lewat bxservice REST.
//
// Cara kerja di iDempiere: dokumen C_BankTransfer di-COMPLETE (DocAction 'CO') →
// MBankTransfer otomatis membuat DUA C_Payment (pembayaran dari rekening asal dan
// penerimaan ke rekening tujuan, keduanya memakai Charge) yang terhubung lewat
// C_Payment.C_BankTransfer_ID. Rekonsiliasi dilakukan terpisah di Bank Statement.
import { idempiereApi, fkId, fkLabel } from '@/api/idempiereApi';
import { buildStatusCondition, normalizeStatus } from '@/utils/docStatus';

const TABLE = '/models/c_banktransfer';

// ─── helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s || '').replace(/'/g, "''");
const pk = (r, col) => r.id ?? fkId(r[col]);
const isTrue = (v) => v === true || v === 'Y' || v === 'true';

export const num = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
export const fmtAmt = (v, decimals = 2) =>
  num(v).toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// 'YYYY-MM-DD' dari tanggal API tanpa konversi zona waktu (hindari geser sehari)
export const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');
export const fmtDate = (v) => {
  const s = toDateInput(v);
  if (!s) return '-';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};
export const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

// TODO: samakan dengan helper toIdempiereTimestamp() yang sudah dipakai di modul Sales.
const toTs = (dateStr) => `${dateStr}T00:00:00Z`;

// AD_Org_ID sesi login. TODO: pastikan key localStorage-nya sama dengan yang dipakai app.
const getLoginOrgId = () => Number(localStorage.getItem('AD_Org_ID')) || null;

// Tender Type (C_BankTransfer.From_TenderType / To_TenderType)
export const TENDER_TYPES = [
  { value: 'A', label: 'Transfer (Direct Deposit)' },
  { value: 'X', label: 'Tunai (Cash)' },
  { value: 'K', label: 'Cek' },
];

export const readError = (err) => err?.message || String(err);

// ─── request helpers ──────────────────────────────────────────────────────────
// ⚠️ SESUAIKAN dengan signature idempiereApi di proyek Anda. Di sini diasumsikan
// idempiereApi(path, { method, body: <string JSON> }). Kalau idempiereApi sudah
// men-stringify body sendiri, kirim `data` apa adanya; kalau signature-nya
// (path, method, data), ubah baris di bawah. Cukup di SATU tempat ini.
const send = (method, path, data) =>
  idempiereApi(path, { method, body: JSON.stringify(data) });

// bxservice membatasi 100 baris/request → paging $skip sampai row-count terpenuhi.
// Path WAJIB memuat $orderby supaya urutan paging stabil.
async function fetchAll(path, { pageSize = 100, max = 2000 } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const all = [];
  let skip = 0;
  while (all.length < max) {
    const res = await idempiereApi(`${path}${sep}$top=${pageSize}&$skip=${skip}`);
    const recs = res?.records || [];
    if (recs.length === 0) break;
    all.push(...recs);
    skip += recs.length;
    const total = res['row-count'];
    if (typeof total === 'number' && skip >= total) break;
  }
  return all;
}

// ─── lookup untuk form ────────────────────────────────────────────────────────
// Lookup memakai tanpa $select supaya tidak gagal kalau nama kolom beda antar versi.
export async function fetchBankAccounts() {
  const rows = await fetchAll(`/models/c_bankaccount?$filter=IsActive eq true&$orderby=C_BankAccount_ID`);
  return rows.map((r) => {
    const bank = fkLabel(r.C_Bank_ID);
    return {
      id: pk(r, 'C_BankAccount_ID'),
      label: [bank, r.AccountNo, r.Name].filter(Boolean).join(' · ') || `#${pk(r, 'C_BankAccount_ID')}`,
      currencyId: fkId(r.C_Currency_ID),
      currencyCode: fkLabel(r.C_Currency_ID) || '',
    };
  });
}

export async function fetchCharges() {
  const rows = await fetchAll(`/models/c_charge?$filter=IsActive eq true&$orderby=Name`);
  return rows.map((r) => ({ id: pk(r, 'C_Charge_ID'), label: r.Name || `#${pk(r, 'C_Charge_ID')}` }));
}

export async function fetchConversionTypes() {
  const rows = await fetchAll(`/models/c_conversiontype?$filter=IsActive eq true&$orderby=Name`);
  return rows.map((r) => ({
    id: pk(r, 'C_ConversionType_ID'),
    label: r.Name || `#${pk(r, 'C_ConversionType_ID')}`,
    isSpot: String(r.Value || '').toUpperCase() === 'S',
  }));
}

// Cari Business Partner (dropdown bisa ribuan baris → pencarian server-side, maks 20 hasil)
export async function fetchBPartners(keyword = '', top = 20) {
  const q = esc(keyword).toUpperCase();
  const cond = q ? ` and (contains(toupper(Name),'${q}') or contains(toupper(Value),'${q}'))` : '';
  const res = await idempiereApi(
    `/models/c_bpartner?$filter=IsActive eq true${cond}&$select=C_BPartner_ID,Value,Name&$orderby=Name&$top=${top}`
  );
  return (res?.records || []).map((r) => ({
    id: pk(r, 'C_BPartner_ID'),
    label: [r.Value, r.Name].filter(Boolean).join(' - ') || `#${pk(r, 'C_BPartner_ID')}`,
  }));
}

// ─── daftar transfer ──────────────────────────────────────────────────────────
export const toTransferRow = (r) => ({
  id: pk(r, 'C_BankTransfer_ID'),
  documentNo: r.DocumentNo || '',
  payDate: r.PayDate,
  dateAcct: r.DateAcct,
  description: r.Description || '',
  fromAccountId: fkId(r.From_C_BankAccount_ID),
  fromAccount: fkLabel(r.From_C_BankAccount_ID) || '',
  toAccountId: fkId(r.To_C_BankAccount_ID),
  toAccount: fkLabel(r.To_C_BankAccount_ID) || '',
  fromCurrency: fkLabel(r.From_C_Currency_ID) || '',
  toCurrency: fkLabel(r.To_C_Currency_ID) || '',
  fromAmt: num(r.From_Amt),
  toAmt: num(r.To_Amt),
  fromBPartner: r.From_C_BPartner_ID ? { id: fkId(r.From_C_BPartner_ID), label: fkLabel(r.From_C_BPartner_ID) || '' } : null,
  toBPartner: r.To_C_BPartner_ID ? { id: fkId(r.To_C_BPartner_ID), label: fkLabel(r.To_C_BPartner_ID) || '' } : null,
  chargeId: fkId(r.From_C_Charge_ID) ?? fkId(r.To_C_Charge_ID),
  conversionTypeId: fkId(r.C_ConversionType_ID),
  rate: num(r.Rate),
  fromTender: r.From_TenderType?.id ?? r.From_TenderType ?? 'A',
  toTender: r.To_TenderType?.id ?? r.To_TenderType ?? 'A',
  status: normalizeStatus(r.DocStatus),
});

export async function fetchTransfers({ search, startDate, endDate, status, offset = 0, pageSize = 10 }) {
  const conds = [`PayDate ge '${startDate}'`, `PayDate le '${endDate}'`];
  const statusCond = buildStatusCondition(status);
  if (statusCond) conds.push(statusCond);
  if (search) conds.push(`contains(tolower(DocumentNo),'${esc(search).toLowerCase()}')`);

  const res = await idempiereApi(
    `${TABLE}?$filter=${conds.join(' and ')}` +
    `&$orderby=DocumentNo desc&$top=${pageSize}&$skip=${offset}`
  );
  return {
    rows: (res?.records || []).map(toTransferRow),
    total: res?.['row-count'] ?? 0,
  };
}

// ─── simpan (create / update) ─────────────────────────────────────────────────
// Callout iDempiere TIDAK jalan lewat REST, jadi mata uang, jumlah tujuan, dan org
// diisi eksplisit di sini (bukan diharapkan terisi otomatis seperti di window ZK).
export function buildTransferPayload(form, fromAcc, toAcc) {
  const sameCurrency = fromAcc.currencyId === toAcc.currencyId;
  const fromAmt = num(form.amount);

  const payload = {
    PayDate: toTs(form.payDate),
    DateAcct: toTs(form.dateAcct),
    Description: form.description || '',
    From_C_BankAccount_ID: fromAcc.id,
    To_C_BankAccount_ID: toAcc.id,
    From_C_Currency_ID: fromAcc.currencyId,
    To_C_Currency_ID: toAcc.currencyId,
    From_Amt: fromAmt,
    To_Amt: sameCurrency ? fromAmt : num(form.toAmt),
    // Business Partner WAJIB di C_BankTransfer (From & To). Umumnya BP yang sama.
    From_C_BPartner_ID: form.fromBPartner?.id,
    To_C_BPartner_ID: (form.sameBp ? form.fromBPartner : form.toBPartner)?.id,
    From_C_Charge_ID: form.chargeId,
    To_C_Charge_ID: form.chargeId,
    From_TenderType: form.fromTender,
    To_TenderType: form.toTender,
  };

  if (!sameCurrency) {
    payload.C_ConversionType_ID = form.conversionTypeId;
    payload.IsOverrideCurrencyRate = true;
    payload.Rate = num(form.rate);
  }

  // Transfer dalam satu organisasi login (org kedua rekening mungkin '*' / org 0)
  const orgId = getLoginOrgId();
  if (orgId) {
    payload.AD_Org_ID = orgId;
    payload.From_AD_Org_ID = orgId;
    payload.To_AD_Org_ID = orgId;
  }
  return payload;
}

export async function saveTransfer({ id, form, fromAcc, toAcc }) {
  const payload = buildTransferPayload(form, fromAcc, toAcc);
  const res = id ? await send('PUT', `${TABLE}/${id}`, payload) : await send('POST', TABLE, payload);
  return { ...res, id: id ?? pk(res, 'C_BankTransfer_ID') };
}

// ─── aksi dokumen ─────────────────────────────────────────────────────────────
// bxservice memproses DocAction lewat properti "doc-action" pada PUT.
// action: 'CO' (Complete) | 'VO' (Void)
export const runDocAction = (id, action) => send('PUT', `${TABLE}/${id}`, { 'doc-action': action });

// Void transfer yang sudah Completed diblokir kalau salah satu payment-nya sudah
// direkonsiliasi di Bank Statement (tahap berikutnya harus dibatalkan dulu).
export async function getVoidBlocker(id) {
  const payments = await fetchAll(`/models/c_payment?$filter=C_BankTransfer_ID eq ${id}&$orderby=C_Payment_ID`);
  const reconciled = payments.filter((p) => isTrue(p.IsReconciled));
  if (reconciled.length > 0) {
    const nos = reconciled.map((p) => p.DocumentNo || `#${p.id}`).join(', ');
    return `Payment ${nos} sudah direkonsiliasi di Bank Statement. Batalkan rekonsiliasinya dulu sebelum void transfer ini.`;
  }
  return null;
}
