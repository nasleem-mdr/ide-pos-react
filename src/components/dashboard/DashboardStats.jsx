import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import useGenericStats from '../../hooks/useGenericStats';
import useDashboardAccess from '../../hooks/useDashboardAccess';
import '../../css/Dashboard.css';
const COLOR_DR = '#f57c00';
const COLOR_CO = '#00d1b2';   // teal — sama dengan welcome-card-icon
const COLOR_IP = '#6366f1';   // indigo — sama dengan welcome-title gradient

const STATUS_LABEL = { CO: 'Completed', IP: 'In Progress', DR: 'Draft' };

// ── Requisition: summary card saja ──────────────────────────────────────────
function RequisitionCard({ createdByList, loadingSubs }) {
  const { stats, loading } = useGenericStats({
    model:           'm_requisition',
    dateField:       'DateDoc',
    totalField:      'TotalLines',
    statusField:     'DocStatus',
    compareStatuses: ['CO', 'IP'],
    monthRange:      1,
    createdByList:   loadingSubs ? null : createdByList,
  });

  const co = stats?.comparison?.CO?.count ?? '-';
  const ip = stats?.comparison?.IP?.count ?? '-';

  return (
    <div className="ds-card">
      <div className="ds-card-title">
        📋 Requisition <span className="ds-card-period">(bulan ini)</span>
      </div>
      {loading || loadingSubs ? (
        <div className="ds-loading">Memuat...</div>
      ) : (
        <div className="ds-status-row">
          <div className="ds-status-box">
            <div className="ds-status-count" style={{ color: '#2e7d32' }}>{co}</div>
            <div className="ds-status-label">Completed</div>
          </div>
          <div className="ds-divider" />
          <div className="ds-status-box">
            <div className="ds-status-count" style={{ color: '#1565c0' }}>{ip}</div>
            <div className="ds-status-label">In Progress</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chart card generik untuk SO & Invoice ───────────────────────────────────
function ChartCard({ title, model, dateField, totalField, baseFilter, createdByList, loadingSubs }) {
  const { stats, loading } = useGenericStats({
    model,
    dateField,
    totalField,
    baseFilter,
    statusField:     'DocStatus',
    compareStatuses: ['CO', 'IP'],
    monthRange:      1,
    createdByList:   loadingSubs ? null : createdByList,
  });

  // Gabungkan data CO & IP per tanggal untuk chart
  const chartData = React.useMemo(() => {
    if (!stats?.comparison) return [];
    const allDates = new Set([
      ...(stats.comparison.CO?.chartData || []).map(d => d.date),
      ...(stats.comparison.IP?.chartData || []).map(d => d.date),
    ]);
    return [...allDates].sort().map(date => ({
      date: date.slice(5), // MM-DD
      CO:   stats.comparison.CO?.chartData.find(d => d.date === date)?.value || 0,
      IP:   stats.comparison.IP?.chartData.find(d => d.date === date)?.value || 0,
    }));
  }, [stats]);

  const co = stats?.comparison?.CO;
  const ip = stats?.comparison?.IP;

  return (
    <div className="ds-card">
      <div className="ds-card-title">
        {title} <span className="ds-card-period">(bulan ini)</span>
      </div>
      {loading || loadingSubs ? (
        <div className="ds-loading">Memuat...</div>
      ) : (
        <>
          <div className="ds-status-row">
            <div className="ds-status-box">
              <div className="ds-status-count" style={{ color: '#2e7d32' }}>{co?.count ?? 0}</div>
              <div className="ds-status-label">Completed ({formatNum(co?.total)})</div>
            </div>
            <div className="ds-divider" />
            <div className="ds-status-box">
              <div className="ds-status-count" style={{ color: '#1565c0' }}>{ip?.count ?? 0}</div>
              <div className="ds-status-label">In Progress ({formatNum(ip?.total)})</div>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="ds-empty">Tidak ada data</div>
          ) : (
            <>
              <div className="ds-chart-label">Tren Harian</div>
              <ResponsiveContainer width="100%">
                {/* ... LineChart sama */}
              </ResponsiveContainer>

              <div className="ds-chart-label-mt">Perbandingan per Hari</div>
              <ResponsiveContainer width="100%">
                {/* ... BarChart sama */}
              </ResponsiveContainer>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Scope info banner ────────────────────────────────────────────────────────
function ScopeBanner({ isSupervisor, subordinates, loadingSubs }) {
  if (loadingSubs) return null;
  return (
    <div className="ds-banner">
      {isSupervisor
        ? `👥 Anda melihat data milik Anda + ${subordinates.length} bawahan langsung`
        : '👤 Anda melihat data milik Anda sendiri'}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardStats() {
  const { createdByList, isSupervisor, subordinates, loadingSubs } = useDashboardAccess();

  const sharedProps = { createdByList, loadingSubs };

   return (
    <div style={{ width: '100%' }}>
      <div className="ds-container">
        <ScopeBanner isSupervisor={isSupervisor} subordinates={subordinates} loadingSubs={loadingSubs} />
        <RequisitionCard {...sharedProps} />
        <ChartCard title="🛒 Sales Order" model="c_order" dateField="DateOrdered" totalField="GrandTotal" baseFilter="IsSOTrx eq true" {...sharedProps} />
        <ChartCard title="🧾 Invoice" model="c_invoice" dateField="DateInvoiced" totalField="GrandTotal" baseFilter="IsSOTrx eq true" {...sharedProps} />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatNum(val, short = false) {
  if (val === null || val === undefined) return '-';
  if (short && val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (short && val >= 1_000)     return `${(val / 1_000).toFixed(0)}K`;
  return Number(val).toLocaleString('id-ID');
}

