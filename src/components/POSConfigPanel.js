import React, { useState, useEffect } from 'react';

/**
 * POSConfigPanel
 *
 * Props:
 *   posConfig          object   — raw config dari C_POS
 *   username           string   — nama user login
 *   priceLists         array    — [{ id, Name }] semua M_PriceList aktif
 *   selectedPriceList  object   — { id, Name } yang sedang dipilih
 *   priceListVersion   object   — { id, Name } versi aktif dari PL yang dipilih (null = tidak ada)
 *   versionMissing     bool
 *   seeding            bool
 *   loading            bool
 *   onPriceListChange  (id) => void   — dipanggil saat user ganti PL di combobox
 *   onSeedDummy        () => void
 */
const POSConfigPanel = ({
    posConfig,
    username,
    priceLists,
    selectedPriceList,
    priceListVersion,
    versionMissing,
    seeding,
    loading,
    onPriceListChange,
    onSeedDummy,
}) => {
    const labelStyle = { fontSize: '11px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px', display: 'block' };
    const valueStyle = { fontSize: '13px', color: '#222', fontWeight: '500' };
    const cellStyle  = { display: 'flex', flexDirection: 'column' };

    const warehouseName = posConfig?.M_Warehouse_ID?.Name  || posConfig?.M_Warehouse_ID  || '-';
    const bpartnerName  = posConfig?.C_BPartner_ID?.Name   || posConfig?.C_BPartner_ID   || '-';
    const posName       = posConfig?.Name || '-';

    const versionLabel = () => {
        if (loading)         return <span style={{ color: '#aaa' }}>Memuat...</span>;
        if (versionMissing)  return <span style={{ color: '#e6a817', fontWeight: 'bold' }}>⚠ Tidak ditemukan</span>;
        if (priceListVersion) return <span style={{ color: '#2e7d32' }}>{priceListVersion.Name}</span>;
        return '-';
    };

    return (
        <div style={{
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '14px 18px',
            fontSize: '12px',
        }}>
            {/* Header baris */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#333' }}>
                    🖥️ {posName}
                </span>
                <span style={{ fontSize: '11px', color: loading ? '#e6a817' : '#2e7d32', fontWeight: '600' }}>
                    {loading ? '⏳ Memuat produk...' : '● Siap'}
                </span>
            </div>

            {/* Grid info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', alignItems: 'start' }}>

                {/* User */}
                <div style={cellStyle}>
                    <span style={labelStyle}>Kasir</span>
                    <span style={valueStyle}>👤 {username || '-'}</span>
                </div>

                {/* Default Customer */}
                <div style={cellStyle}>
                    <span style={labelStyle}>Customer Default</span>
                    <span style={valueStyle} title={bpartnerName}>
                        {bpartnerName.length > 20 ? bpartnerName.slice(0, 18) + '…' : bpartnerName}
                    </span>
                </div>

                {/* Warehouse */}
                <div style={cellStyle}>
                    <span style={labelStyle}>Gudang</span>
                    <span style={valueStyle}>{warehouseName}</span>
                </div>

                {/* Price List — combobox */}
                <div style={cellStyle}>
                    <span style={labelStyle}>Price List</span>
                    <select
                        value={selectedPriceList?.id ?? ''}
                        onChange={e => onPriceListChange(Number(e.target.value))}
                        disabled={loading || !priceLists.length}
                        style={{
                            fontSize: '12px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            background: '#fff',
                            color: '#222',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            width: '100%',
                        }}
                    >
                        {priceLists.length === 0 && (
                            <option value="">Memuat...</option>
                        )}
                        {priceLists.map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.Name}</option>
                        ))}
                    </select>
                </div>

                {/* Price List Version — read only, dynamic */}
                <div style={cellStyle}>
                    <span style={labelStyle}>Versi Price List</span>
                    <div style={{ ...valueStyle, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '26px' }}>
                        {versionLabel()}
                        {versionMissing && !seeding && (
                            <button
                                onClick={onSeedDummy}
                                title="Buat dummy price list version"
                                style={{
                                    background: '#e6a817', color: '#fff', border: 'none',
                                    borderRadius: '4px', padding: '2px 7px', fontSize: '11px',
                                    cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap',
                                }}
                            >
                                + Buat
                            </button>
                        )}
                        {seeding && (
                            <span style={{ color: '#aaa', fontSize: '11px' }}>⏳ Membuat...</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default POSConfigPanel;