import React, { useState, useEffect, useCallback } from 'react';
import { Dialog } from '@/shared/components';
import { useBankAccounts, useIsDesktop, getLoginInfo } from '@/shared/hooks';
import { useAccess } from '@/context/AccessContext';
import { COLOR, RADIUS } from '@/utils/styleTokens';

import BankStatementImportModal from '@/features/banking/statement/components/BankStatementImportModal';
import ChargeLineForm from '@/features/banking/statement/components/ChargeLineForm';
import { useBankStatementCart, lineKey } from '@/features/banking/statement/hooks/useBankStatementCart';
import { useBankStatementSubmit } from '@/features/banking/statement/hooks/useBankStatementSubmit';

const BankStatementContainer = () => {
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '' });
  const alert = (message, title = 'Attention') => setDialog({ isOpen: true, title, message });

  const { bankAccounts } = useBankAccounts();
  const [bankAccountId, setBankAccountId] = useState(null);
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [chargeFormOpen, setChargeFormOpen] = useState(false);
  const selectedBank = bankAccounts.find(b => String(b.id) === String(bankAccountId));
  const { canEdit } = useAccess();
  const canSubmit = canEdit('banking'); 
  const isDesktop = useIsDesktop();
  const { cart, addItems, addChargeLine, removeItem, updateStmtAmt, clearCart, totalItems, totalStmtAmt } = useBankStatementCart();
  const { submit, fetchBeginningBalance, isSubmitting } = useBankStatementSubmit({ onError: alert });

  useEffect(() => {
    if (!bankAccountId) { setBeginningBalance(0); return; }
    fetchBeginningBalance(bankAccountId).then(setBeginningBalance);
    clearCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccountId]);

  
  const endingBalancePreview = beginningBalance + totalStmtAmt;

  const handleSubmit = async (submitMode) => {
    const { result, hadError } = await submit(cart, { bankAccountId, beginningBalance, submitMode });
    if (!result) return;
    alert(`Bank Statement ${result.documentNo} has been successfully ${result.status === 'Completed' ? 'di-Complete' : 'Save as Draft'}.`, 'Success');
    if (!hadError) { clearCart(); }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, background: COLOR.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Dialog isOpen={dialog.isOpen} title={dialog.title} message={dialog.message} onClose={() => setDialog({ isOpen: false, title: '', message: '' })} />
      <BankStatementImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} bankAccountId={bankAccountId} bankAccountName={selectedBank?.name} onImport={addItems} />
      <ChargeLineForm isOpen={chargeFormOpen} onClose={() => setChargeFormOpen(false)} onAdd={addChargeLine} />
  
      <div className='header-purchasing'>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>🏦 Cash/Bank Statement</span>
      </div>
  
      <div style={{ padding: '14px', background: COLOR.surface, borderBottom: `1px solid ${COLOR.border}` }}>
          
        <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginTop: '4px' }}>
          <select
            value={bankAccountId || ''}
            onChange={e => setBankAccountId(e.target.value || null)}
            style={{
              flex: '1 1 auto', minWidth: 0, padding: '10px',
              border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
            }}
          >
            <option value="">-- Choose Bank Account --</option>
            {bankAccounts.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
  
          {bankAccountId && (
            <>
              <button
                onClick={() => setImportOpen(true)}
                title="Import AP/AR"
                style={{
                  padding: isDesktop ? '10px 14px' : '10px',
                  width: isDesktop ? 'auto' : '40px',
                  height: isDesktop ? 'auto' : '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', borderRadius: RADIUS.md,
                  background: COLOR.primary, color: '#fff', fontWeight: 600,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {isDesktop ? '⬇️ Import AP/AR' : '⬇️'}
              </button>
              <button
                onClick={() => setChargeFormOpen(true)}
                title="Add Charge"
                style={{
                  padding: isDesktop ? '10px 14px' : '10px',
                  width: isDesktop ? 'auto' : '40px',
                  height: isDesktop ? 'auto' : '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
                  background: 'none', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {isDesktop ? '➕ Add Charge' : '➕'}
              </button>
            </>
          )}
        </div>
  
        {bankAccountId && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px' }}>
            <span>Begining Balance: <b>{beginningBalance.toLocaleString('id-ID')}</b></span>
            <span>Ending Balance(preview): <b style={{ color: COLOR.primary }}>{endingBalancePreview.toLocaleString('id-ID')}</b></span>
          </div>
        )}
      </div>
      {bankAccountId && (
        <>
          

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: COLOR.textLt }}>Belum ada baris statement.</div>
            ) : cart.map(item => (
              <div key={lineKey(item)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, marginBottom: '6px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {item.type === 'payment' ? `${item.DocumentNo} — ${item.BPName}` : `⚙️ ${item.ChargeName}`}
                  </div>
                  {item.Description && <div style={{ fontSize: '11px', color: COLOR.textLt }}>{item.Description}</div>}
                </div>
                <input
                  type="number" value={item.StmtAmt}
                  onChange={e => updateStmtAmt(lineKey(item), parseFloat(e.target.value) || 0)}
                  style={{ width: '100px', padding: '6px', textAlign: 'right', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, color: item.StmtAmt >= 0 ? COLOR.success : '#dc2626', fontWeight: 700 }}
                />
                <button onClick={() => removeItem(lineKey(item))} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '16px', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>

          {canSubmit && cart.length > 0 && (
            <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLOR.border}`, display: 'flex', gap: '8px', background: COLOR.surface }}>
              <button disabled={isSubmitting} onClick={() => handleSubmit('draft')} style={{ flex: 1, padding: '10px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, background: 'none', fontWeight: 600 }}>Simpan Draft</button>
              <button disabled={isSubmitting} onClick={() => handleSubmit('complete')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: RADIUS.md, background: COLOR.primary, color: '#fff', fontWeight: 700 }}>Complete</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BankStatementContainer;
