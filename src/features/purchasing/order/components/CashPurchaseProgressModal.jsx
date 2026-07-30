import React from 'react';
import { COLOR, RADIUS } from '@/utils/styleTokens';

const STEP_LABELS = {
    po:         'Purchase Order',
    receipt:    'Material Receipt',
    invoice:    'Vendor Invoice',
    payment:    'Payment',
    allocation: 'Allocation',
};

const StatusIcon = ({ status }) => {
    if (status === 'success') return <span style={{ color: '#22c55e' }}>✓</span>;
    if (status === 'error')   return <span style={{ color: '#dc2626' }}>✕</span>;
    if (status === 'pending') return <span style={{ color: '#f59e0b' }}>⏳</span>;
    return <span style={{ color: '#d1d5db' }}>○</span>; // belum mulai
};

const CashPurchaseProgressModal = ({ isOpen, steps, onClose, isDone }) => {
    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: COLOR.surface, borderRadius: RADIUS.lg, padding: '24px', width: '340px', maxWidth: '90vw' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: COLOR.textDk }}>Proses Pembelian Tunai</h3>

                {Object.entries(STEP_LABELS).map(([key, label]) => {
                    const step = steps[key] || { status: 'idle' };
                    return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <StatusIcon status={step.status} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', color: COLOR.textDk }}>{label}</div>
                                {step.status === 'success' && step.documentNo && (
                                    <div style={{ fontSize: '11px', color: '#22c55e' }}>{step.documentNo}</div>
                                )}
                                {step.status === 'error' && step.message && (
                                    <div style={{ fontSize: '11px', color: '#dc2626' }}>{step.message}</div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isDone && (
                    <button
                        onClick={onClose}
                        style={{ marginTop: '16px', width: '100%', padding: '10px', background: COLOR.primary, color: '#fff', border: 'none', borderRadius: RADIUS.md, fontWeight: 700, cursor: 'pointer' }}
                    >Tutup</button>
                )}
            </div>
        </div>
    );
};

export default CashPurchaseProgressModal;
