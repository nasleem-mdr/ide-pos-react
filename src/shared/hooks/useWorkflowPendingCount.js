import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { idempiereApi } from '@/api/idempiereApi';

const POLL_MS = 60_000;

export function useWorkflowPendingCount(roleId) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('loginToken')) return;
    try {
      // $top=1 cukup, karena yang dibutuhkan hanya "row-count" (total), bukan isi records.
      const res = await idempiereApi('/workflow?$top=1');
      const total = Number(res?.['row-count'] ?? res?.records?.length ?? 0);
      if (aliveRef.current) setCount(Number.isNaN(total) ? 0 : total);
    } catch (err) {
      console.warn('[useWorkflowPendingCount] gagal:', err);
    }
  }, []);

  // Fetch awal + saat role berganti + saat pindah halaman
  // (mis. setelah approve di /workflow-approval, badge ikut turun).
  useEffect(() => {
    aliveRef.current = true;
    refresh();
    return () => { aliveRef.current = false; };
  }, [refresh, roleId, location.pathname]);

  // Polling, dihentikan saat tab tidak terlihat; refresh lagi saat tab aktif kembali.
  useEffect(() => {
    const tick = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  return { count, refresh };
}