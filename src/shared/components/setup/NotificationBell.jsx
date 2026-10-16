// src/components/header/NotificationBell.jsx
// Satu lonceng di header: total = Workflow + Purchasing, klik → dropdown terpisah.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowPendingCount } from '@/shared/hooks/useWorkflowPendingCount'; 
import usePurchasingNotification from '@/features/purchasing/order/hooks/usePurchasingNotification'; 

function Row({ title, subtitle, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-gray-500">{subtitle}</span>
        )}
      </span>
      <span
        className={`min-w-[24px] shrink-0 rounded-full px-2 text-center text-xs font-semibold leading-5 ${
          count > 0 ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}

export default function NotificationBell({
  roleId,
  workflowPath = '/workflow',   // TODO: route halaman approval workflow
  purchasingPath = '/purchasing', // TODO: route halaman Purchasing
}) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const { count: wfCount } = useWorkflowPendingCount(roleId);
  const {
    enabled: purchasingEnabled,
    count: purchCount,
    pending,
    requestPermission,
  } = usePurchasingNotification();

  const total = wfCount + (purchasingEnabled ? purchCount : 0);

  // Tutup dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (purchasingEnabled) requestPermission(); // izin notifikasi browser (butuh gesture user)
  };

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const preview =
    pending.slice(0, 3).map((r) => r.documentNo).join(', ') +
    (pending.length > 3 ? ` +${pending.length - 3}` : '');

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifikasi (${total})`}
        className="relative inline-flex items-center p-2 text-white"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <Row
            title="Approval Workflow"
            subtitle={wfCount > 0 ? 'Menunggu persetujuan Anda' : 'Tidak ada yang menunggu'}
            count={wfCount}
            onClick={() => go(workflowPath)}
          />
          {purchasingEnabled && (
            <Row
              title="Requisition untuk Purchasing"
              subtitle={purchCount > 0 ? `FPB belum jadi PO: ${preview}` : 'Semua FPB sudah diproses'}
              count={purchCount}
              onClick={() => go(purchasingPath)}
            />
          )}
        </div>
      )}
    </div>
  );
}
