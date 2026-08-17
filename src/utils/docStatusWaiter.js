import { idempiereApi } from '@/api/idempiereApi';

// ─────────────────────────────────────────────────────────────────────────────
// docStatusWaiter.js
// Dipakai di useCashPurchaseSubmit: Receipt mereferensikan C_OrderLine_ID milik
// PO, dan Invoice mereferensikan M_InOutLine_ID milik Receipt — jadi dokumen
// sebelumnya HARUS sudah benar-benar Complete (DocStatus='CO') dulu sebelum
// dokumen berikutnya dibuat. Kalau proses doc-action di instance iDempiere ini
// diproses async (mis. lewat job/queue, bukan selesai total dalam satu response
// PUT), record hasil PUT bisa saja masih menunjukkan status lama sesaat setelah
// request dikirim — makanya di-poll, bukan langsung dipercaya dari response
// PUT pertama.
//
// Catatan: Invoice & Payment di alur ini SENGAJA TIDAK di-poll — response PUT
// doc-action langsung dipakai apa adanya, karena tidak ada tahap berikutnya
// yang butuh baris anak dokumen itu sebagai referensi (beda dgn PO→Receipt
// dan Receipt→Invoice). Kalau nanti ternyata Invoice/Payment JUGA butuh
// dipastikan CO dulu (misalnya kalau ditambah tahap setelah Payment yang
// mereferensikan C_Payment_ID), tinggal panggil fungsi ini juga di situ.
// ─────────────────────────────────────────────────────────────────────────────

const SUCCESS_STATUSES = ['CO', 'CL'];       // final, boleh lanjut
const FAILURE_STATUSES = ['VO', 'RE', 'IN']; // final, gagal permanen — jangan tunggu lagi

/**
 * Poll record sampai DocStatus mencapai status final, atau timeout.
 *
 * @param {string} model - nama model REST, mis. 'c_order', 'm_inout'.
 * @param {number} recordId
 * @param {{ timeoutMs?: number, intervalMs?: number }} opts
 * @returns {Promise<{ success: boolean, status: string, documentNo?: string }>}
 */
export async function waitForDocStatus(model, recordId, { timeoutMs = 20000, intervalMs = 700 } = {}) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const rec = await idempiereApi(
            `/models/${model}/${recordId}?$select=DocStatus,DocumentNo`
        );
        const status = rec?.DocStatus?.id ?? rec?.DocStatus ?? null;

        if (SUCCESS_STATUSES.includes(status)) {
            return { success: true, status, documentNo: rec.DocumentNo };
        }
        if (FAILURE_STATUSES.includes(status)) {
            return { success: false, status, documentNo: rec.DocumentNo };
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return { success: false, status: 'timeout' };
}
