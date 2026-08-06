import { useState, useCallback } from 'react';
import { idempiereApi } from '@/api/idempiereApi';

/**
 * Submits Sales Invoice(s) — one C_Invoice per customer, mirroring
 * `useInvoiceSubmit` (one C_Invoice per vendor) on the AP side.
 *
 * Consumes cart items shaped like POLineDetailSheet's handleConfirm()
 * output: { C_OrderLine_ID, M_Product_ID, Name, C_UOM_ID, Qty, Price,
 * C_BPartner_ID, CustomerName, ... }.
 *
 * No payment/allocation step yet (Bayar deferred per current scope) —
 * only 'draft' and 'complete' submitMode are handled.
 */
export function useSalesInvoiceSubmit({ invoiceDocTypeId, defaultDescription, onError }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (cart, { description, submitMode }) => {
      if (!invoiceDocTypeId) {
        onError?.('Document Type Sales Invoice belum siap.');
        return { results: null, hadError: true };
      }
      if (!cart.length) {
        onError?.('Keranjang kosong.');
        return { results: null, hadError: true };
      }

      setIsSubmitting(true);
      const results = [];
      let hadError = false;

      const byCustomer = cart.reduce((acc, line) => {
        (acc[line.C_BPartner_ID] ||= []).push(line);
        return acc;
      }, {});

      try {
        for (const [customerId, lines] of Object.entries(byCustomer)) {
          try {
            const header = await idempiereApi.post('/models/c_invoice', {
              C_DocType_ID: invoiceDocTypeId,
              C_BPartner_ID: Number(customerId),
              IsSOTrx: true,
              Description: description || defaultDescription,
              DateInvoiced: new Date().toISOString().slice(0, 10),
            });

            const invoiceId = header?.id;

            for (const line of lines) {
              await idempiereApi.post('/models/c_invoiceline', {
                C_Invoice_ID: invoiceId,
                C_OrderLine_ID: line.C_OrderLine_ID,
                M_Product_ID: line.M_Product_ID,
                QtyInvoiced: line.Qty,
                PriceEntered: line.Price,
                C_UOM_ID: line.C_UOM_ID,
              });
            }

            if (submitMode === 'complete') {
              // lowercase hyphenated key, per confirmed bxservice convention
              await idempiereApi.put(`/models/c_invoice/${invoiceId}`, {
                'doc-action': 'CO',
              });
            }

            results.push({
              customerId,
              customerName: lines[0]?.CustomerName || lines[0]?.VendorName,
              invoiceId,
              grandTotal: lines.reduce(
                (s, l) => s + (Number(l.Qty) || 0) * (Number(l.Price) || 0),
                0
              ),
            });
          } catch (err) {
            console.error('[useSalesInvoiceSubmit] customer failed:', customerId, err);
            hadError = true;
            onError?.(err.message);
          }
        }
      } finally {
        setIsSubmitting(false);
      }

      return { results: results.length ? results : null, hadError };
    },
    [invoiceDocTypeId, defaultDescription, onError]
  );

  return { submit, isSubmitting };
}
