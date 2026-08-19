import React, { useState, useEffect } from 'react';
import { COLOR, RADIUS } from '@/utils/styleTokens';
import { useShipmentInvoiceLines } from '../hooks/useShipmentInvoiceLines';

// Flat multi-select (pola BankStatementImportModal) — 1 baris = 1 M_InOutLine
// yang masih ada sisa qty belum ditagih. Filter customer OPSIONAL: kalau
// customer sudah dipilih di container, otomatis dikunci ke customer itu
// (invoice = 1 customer selalu, tidak masuk akal import lintas customer).
const SalesInvoiceImportFromShipment = ({ isOpen, onClose, customerId, customerName, onImport }) => {
  const { shipments, loading, fetchLines } = useShipmentInvoiceLines();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState({}); // { [M_InOutLine_ID]: qty }

  const runFilter = () => fetchLines({ term: query, customerId });

  useEffect(() => {
    if (isOpen) { setSelected({}); runFilter(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (line) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[line.M_InOutLine_ID] != null) delete next[line.M_InOutLine_ID];
      else next[line.M_InOutLine_ID] = line.qtyOutstanding;
      return next;
    });
  };

  const changeQty = (line, value) => {
    const qty = Math.min(Math.max(parseFloat(value) || 0, 0), line.qtyOutstanding);
    setSelected(prev => ({ ...prev, [line.M_InOutLine_ID]: qty }));
  };

  const selectedLines = shipments.filter(l => selected[l.M_InOutLine_ID] > 0);

  const handleConfirm = () => {
    const chosen = selectedLines.map(l => ({
      M_InOutLine_ID: l.M_InOutLine_ID,
      C_OrderLine_ID: l.C_OrderLine_ID,
      M_Product_ID:   l.M_Product_ID,
      Name:           l.ProductName,
      Description:    `${l.ProductName} - ${l.ShipmentDocumentNo}`, 
      C_UOM_ID:       l.C_UOM_ID,
      UomName:        l.UomName,
      Qty:            selected[l.M_InOutLine_ID],
      Price:          l.Price,
      ShipmentDocumentNo: l.ShipmentDocumentNo,
    }));
    if (chosen.length === 0) return;
    onImport(chosen);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLOR.surface, width: '100%', maxWidth: '640px', maxHeight: '85vh', borderRadius: RADIUS.lg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${COLOR.border}` }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>Import dari Shipment</div>
          <div style={{ fontSize: '11px', color: COLOR.textLt }}>
            {customerName ? `Customer: ${customerName}` : 'Semua customer'}
          </div>
        </div>

        <div style={{ padding: '10px 16px', display: 'flex', gap: '8px', borderBottom: `1px solid ${COLOR.border}` }}>
          <input
            type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runFilter(); }}
            placeholder="Cari No. Shipment / customer..."
            style={{ flex: 1, padding: '8px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm }}
          />
          <button onClick={runFilter} style={{ padding: '8px 14px', border: 'none', borderRadius: RADIUS.sm, background: COLOR.primary, color: '#fff', fontWeight: 600 }}>
            🔍 Cari
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: COLOR.textLt }}>⏳ Memuat...</div>
          ) : shipments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: COLOR.textLt }}>Tidak ada baris shipment yang belum ditagih.</div>
          ) : (
            shipments.map(line => (
              <div key={line.M_InOutLine_ID} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: `1px solid ${COLOR.border}` }}>
                <input type="checkbox" checked={selected[line.M_InOutLine_ID] != null} onChange={() => toggle(line)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{line.ProductName}</div>
                  <div style={{ fontSize: '11px', color: COLOR.textLt }}>
                    {line.ShipmentDocumentNo} · {line.CustomerName} · Sisa {line.qtyOutstanding} {line.UomName}
                    {line.priceMissing && <span style={{ color: '#dc2626', fontWeight: 600 }}> · ⚠ harga tidak ditemukan, isi manual</span>}
                  </div>
                </div>
                <input
                  type="number" min={0} max={line.qtyOutstanding}
                  value={selected[line.M_InOutLine_ID] ?? ''}
                  onChange={e => changeQty(line, e.target.value)}
                  disabled={selected[line.M_InOutLine_ID] == null}
                  style={{ width: '64px', padding: '6px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm }}
                />
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${COLOR.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{selectedLines.length} dipilih</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '8px 14px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, background: 'none' }}>Batal</button>
            <button onClick={handleConfirm} disabled={selectedLines.length === 0}
              style={{ padding: '8px 14px', border: 'none', borderRadius: RADIUS.md, background: COLOR.primary, color: '#fff', fontWeight: 700, opacity: selectedLines.length === 0 ? 0.5 : 1 }}>
              Tambahkan ({selectedLines.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesInvoiceImportFromShipment;
