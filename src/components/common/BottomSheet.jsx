import React from 'react';
import { COLOR, RADIUS } from '../../utils/styleTokens';

const BottomSheet = ({ isOpen, onClose, children, maxHeight = '85dvh', maxWidth = '480px', zIndex = 300 }) => {
  if (!isOpen) return null;
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div style={{
        width: '100%', maxWidth,
        background: COLOR.surface,
        borderRadius: `${RADIUS.xl} ${RADIUS.xl} 0 0`,
        maxHeight,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div
            onClick={onClose}
            style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#d1d5db', cursor: 'pointer' }}
          />
        </div>
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
