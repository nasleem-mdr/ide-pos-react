import React, { useState, useEffect } from 'react';
import { COLOR, RADIUS } from '@/utils/styleTokens';
import { useUnreconciledPaymentLines } from '../hooks/useUnreconciledPaymentLines';

// Replicate "Create From" on "Bank Statement IDempiere" — Bank Account filter (fixed
// from context, cannot be changed here), Document Type (AR/AP), Payment
// Amount range, Business Partner, Transaction Date range, multi-select table
// with running Sum in the footer
const BankStatementImportModal = ({ isOpen, onClose, bankAccountId, bankAccountName, onImport }) => {
  const { lines, loading, fetchLines } = useUnreconciledPaymentLines();
  const [docTypeFilter, setDocTypeFilter] = useState(null); // 'AR' | 'AP' | null
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState({}); // { [C_Payment_ID]: true }

  const runFilter = () => {
    fetchLines({
      bankAccountId, docTypeFilter,
      amountMin: amountMin ? parseFloat(amountMin) : null,
      amountMax: amountMax ? parseFloat(amountMax) : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
  };

  useEffect(() => {
    if (isOpen && bankAccountId) {
      setSelected({});
      runFilter();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bankAccountId]);

  if (!isOpen) return null;

  const toggle = (id) => setSelected(prev => { const n = { ...prev }; if (n[id]) delete n[id]; else n[id] = true; return n; });

  const selectedLines = lines.filter(l => selected[l.C_Payment_ID]);
  const sumSelected = selectedLines.reduce((s, l) => s + (l.IsReceipt ? l.PayAmt : -l.PayAmt), 0);

  const handleConfirm = () => {
    const cartItems = selectedLines.map(l => ({
      type: 'payment',
      C_Payment_ID: l.C_Payment_ID,
      DocumentNo:   l.DocumentNo,
      DateTrx:      l.DateTrx,
      StmtAmt:      l.IsReceipt ? l.PayAmt : -l.PayAmt,   // Receipt (+), Payment (-)
      TrxAmt:       l.IsReceipt ? l.PayAmt : -l.PayAmt,
      C_BPartner_ID: l.C_BPartner_ID,
      BPName:        l.BPName,
      C_Invoice_ID:  l.C_Invoice_ID,
      InvoiceLabel:  l.InvoiceLabel,
      C_Currency_ID: l.C_Currency_ID,
    }));
    onImport(cartItems);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLOR.surface, width: '95%', maxWidth: '640px', maxHeight: '88vh', borderRadius: RADIUS.lg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${COLOR.border}` }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>Bank Statement — Create Lines From</div>
          <div style={{ fontSize: '11px', color: COLOR.textLt }}>Bank Account: {bankAccountName}</div>
        </div>

        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderBottom: `1px solid ${COLOR.border}` }}>
          <select value={docTypeFilter || ''} onChange={e => setDocTypeFilter(e.target.value || null)}
            style={{ padding: '8px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, gridColumn: '1 / -1' }}>
            <option value="">All Type(AR or AP)</option>
            <option value="AR">AR Receipt</option>
            <option value="AP">AP Payment</option>
          </select>
          <input type="number" placeholder="Jumlah min" value={amountMin} onChange={e => setAmountMin(e.target.value)}
            style={{ padding: '8px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm }} />
          <input type="number" placeholder="Jumlah max" value={amountMax} onChange={e => setAmountMax(e.target.value)}
            style={{ padding: '8px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm }} />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '8px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '8px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm }} />
          <button onClick={runFilter} style={{ gridColumn: '1 / -1', padding: '8px', border: 'none', borderRadius: RADIUS.sm, background: COLOR.primary, color: '#fff', fontWeight: 600 }}>
            🔄 Refresh
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: COLOR.textLt }}>⏳ Loading...</div>
          ) : lines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: COLOR.textLt }}>There are no unreconciled Payments/Receipts.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: COLOR.bg, textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}></th>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px' }}>Payment</th>
                  <th style={{ padding: '8px' }}>Type</th>
                  <th style={{ padding: '8px' }}>Vendor/Customer</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.C_Payment_ID} style={{ borderTop: `1px solid ${COLOR.border}`, background: selected[l.C_Payment_ID] ? '#e0f2fe' : 'transparent' }}
                    onClick={() => toggle(l.C_Payment_ID)}>
                    <td style={{ padding: '8px' }}><input type="checkbox" checked={!!selected[l.C_Payment_ID]} readOnly /></td>
                    <td style={{ padding: '8px' }}>{l.DateTrx ? new Date(l.DateTrx).toLocaleDateString('id-ID') : '-'}</td>
                    <td style={{ padding: '8px' }}>{l.DocumentNo}</td>
                    <td style={{ padding: '8px' }}>{l.IsReceipt ? '💰 Receipt' : '💸 Payment'}</td>
                    <td style={{ padding: '8px' }}>{l.BPName}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: l.IsReceipt ? COLOR.success : '#dc2626', fontWeight: 600 }}>
                      {l.IsReceipt ? '+' : '-'}{l.PayAmt.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: `1px solid ${COLOR.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>
            {selectedLines.length} Selected — Sum {sumSelected.toLocaleString('id-ID')}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '8px 14px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, background: 'none' }}>Cancel</button>
            <button onClick={handleConfirm} disabled={selectedLines.length === 0}
              style={{ padding: '8px 14px', border: 'none', borderRadius: RADIUS.md, background: COLOR.primary, color: '#fff', fontWeight: 700, opacity: selectedLines.length === 0 ? 0.5 : 1 }}>
              + Add ({selectedLines.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankStatementImportModal;