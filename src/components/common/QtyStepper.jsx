import React from 'react';
import { COLOR, RADIUS, stepBtnBase } from '../../utils/styleTokens';

// ─────────────────────────────────────────────────────────────────────────────
// QtyStepper.jsx
// Tombol [−] [input qty] [+] — dipakai di CartItem (ukuran kecil) dan
// ProductDetailSheet (ukuran besar). Sebelumnya logic ini diduplikasi dengan
// gaya inline berbeda di dua tempat; sekarang satu komponen dengan prop `size`.
//
// Penggunaan:
//   <QtyStepper value={qty} onChange={setQty} min={0.01} size="lg" />
//   <QtyStepper value={item.Qty} onChange={q => onQtyChange(item.M_Product_ID, q)} />
// ─────────────────────────────────────────────────────────────────────────────
const SIZES = {
  sm: { btn: '32px', font: '18px', inputW: '52px', inputFont: '14px' },
  lg: { btn: '40px', font: '20px', inputW: null, inputFont: '16px' }, // inputW null = flex:1
};

const QtyStepper = ({ value, onChange, min = 0.01, step = 1, size = 'sm' }) => {
  const s = SIZES[size] || SIZES.sm;

  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(value + step);

  const btnStyle = { ...stepBtnBase, width: s.btn, height: s.btn, fontSize: s.font };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'lg' ? '8px' : '3px' }}>
      <button
        onTouchEnd={e => { e.preventDefault(); dec(); }}
        onClick={dec}
        style={btnStyle}
      >−</button>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          ...(s.inputW ? { width: s.inputW } : { flex: 1 }),
          textAlign: 'center',
          padding: size === 'lg' ? '10px 6px' : '5px 2px',
          border: `${size === 'lg' ? '1.5px' : '1px'} solid ${COLOR.border}`,
          borderRadius: RADIUS.sm,
          fontSize: s.inputFont,
          fontWeight: 700,
          color: COLOR.textDk,
        }}
      />
      <button
        onTouchEnd={e => { e.preventDefault(); inc(); }}
        onClick={inc}
        style={btnStyle}
      >+</button>
    </div>
  );
};

export default QtyStepper;
