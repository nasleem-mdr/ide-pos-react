import React, { createContext, useContext } from 'react';
import { useWindowAccess } from '../hooks/useWindowAccess';
import { getWindowId } from '../config/windowAccessMap';

// ─────────────────────────────────────────────────────────────────────────────
// AccessContext.jsx
// Provider tunggal di root App agar accessMap (AD_Window_Access role aktif)
// di-fetch SEKALI saat app mount, lalu dipakai bersama oleh Sidebar,
// ProtectedRoute, dan tombol-tombol aksi di dalam form — tanpa fetch berulang.
//
// Penggunaan:
//   // di App.jsx, bungkus seluruh routes:
//   <AccessProvider><Routes>...</Routes></AccessProvider>
//
//   // di komponen mana pun:
//   const { canView, canEdit, loading } = useAccess();
//   if (!canView('requisition')) return null;
// ─────────────────────────────────────────────────────────────────────────────
const AccessContext = createContext(null);

export const AccessProvider = ({ children }) => {
  const { accessMap, loading, error, reload } = useWindowAccess();

  // canView: window terdaftar di AD_Window_Access (IsActive) → boleh dilihat.
  // Window dengan windowId === null di config (mis. dashboard) selalu true.
  const canView = (windowKey) => {
    const windowId = getWindowId(windowKey);
    if (windowId === null) return true; // halaman yang sengaja tidak dibatasi
    if (!accessMap) return false;       // belum dimuat → fail-closed sementara
    return accessMap.has(windowId);
  };

  // canEdit: selain terdaftar, juga harus IsReadWrite true di AD_Window_Access.
  // Dipakai untuk show/hide tombol Submit, Save, Delete, Edit, dll.
  const canEdit = (windowKey) => {
    const windowId = getWindowId(windowKey);
    if (windowId === null) return true;
    if (!accessMap) return false;
    const entry = accessMap.get(windowId);
    return !!entry?.isReadWrite;
  };

  const value = { accessMap, loading, error, canView, canEdit, reload };

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = () => {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error('useAccess() harus dipakai di dalam <AccessProvider>. Bungkus App.jsx dengan AccessProvider.');
  }
  return ctx;
};
