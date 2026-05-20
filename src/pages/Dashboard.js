import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { HomeIcon, PartnerIcon, BoxIcon, ShoppingCartIcon, CashierIcon } from '../components/Icons';
import '../css/Dashboard.css';

/**
 * Dashboard komponen
 * Props:
 *   session: { username, clientId, clientName, roleId, roleName, orgId, orgName, language, token }
 *   onLogout: () => void
 */

// ─── Interactive Line Chart (SVG + tooltip, no deps) ───────────────────────
function LineChart({ data, color = '#3b82f6', height = 80 }) {
  const [tooltip, setTooltip] = useState(null); // { x, y, date, value }
  const svgRef = useRef(null);

  if (!data || data.length < 2) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>
      Tidak ada data
    </div>
  );

  const W      = 500; // internal viewBox width
  const H      = height;
  const padX   = 8;
  const padY   = 8;
  const values = data.map(d => d.value);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;

  const pts = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (W - padX * 2),
    y: padY + (1 - (d.value - min) / range) * (H - padY * 2),
    date: d.date,
    value: d.value,
  }));

  const areaPath = `M${pts[0].x},${pts[0].y} ` +
    pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${H - padY} L${padX},${H - padY} Z`;
  const linePath = `M${pts[0].x},${pts[0].y} ` +
    pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ');

  const handleMouseMove = (e) => {
    const svg    = svgRef.current;
    if (!svg) return;
    const rect   = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    // Find closest point
    let closest = pts[0], minDist = Infinity;
    pts.forEach(p => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) { minDist = dist; closest = p; }
    });
    setTooltip({ x: closest.x, y: closest.y, date: closest.date, value: closest.value });
  };

  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Zero-value day markers (grey dot) */}
        {pts.filter(p => p.value === 0).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#ddd" />
        ))}

        {/* Hover crosshair + active dot */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x} y1={padY}
              x2={tooltip.x} y2={H - padY}
              stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
            />
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="#fff" stroke={color} strokeWidth="2" />
          </>
        )}

        {/* Today dot */}
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r="3.5" fill={color}
        />
      </svg>

      {/* Tooltip box — positioned via % */}
      {tooltip && (
        <div style={{
          position:      'absolute',
          top:           0,
          left:          `${(tooltip.x / W) * 100}%`,
          transform:     tooltip.x > W * 0.7 ? 'translateX(-110%)' : 'translateX(8px)',
          background:    '#1e293b',
          color:         '#fff',
          borderRadius:  6,
          padding:       '5px 10px',
          fontSize:      11,
          pointerEvents: 'none',
          whiteSpace:    'nowrap',
          boxShadow:     '0 2px 8px rgba(0,0,0,0.2)',
          zIndex:        10,
        }}>
          <div style={{ color: '#94a3b8', marginBottom: 2 }}>
            {new Date(tooltip.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </div>
          <div style={{ fontWeight: 700, fontSize: 12 }}>
            Rp {tooltip.value.toLocaleString('id-ID')}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
// Format singkat: 1.500.000 -> 1.5M, 400.000 -> 400K
function shortNum(v, isCurrency = false) {
  const n = parseFloat(v) || 0;
  let result;
  if (n >= 1_000_000_000) result = (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  else if (n >= 1_000_000) result = (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  else if (n >= 1_000)     result = (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  else                      result = n.toLocaleString('id-ID');
  return isCurrency ? `Rp ${result}` : result;
}

function StatCard({ label, today, yesterday, format = 'currency', color, chart }) {
  const todayNum     = parseFloat(today)     || 0;
  const yesterdayNum = parseFloat(yesterday) || 0;
  const delta        = yesterdayNum === 0 ? null : ((todayNum - yesterdayNum) / yesterdayNum) * 100;
  const isUp         = delta === null ? null : delta >= 0;
  const isCurrency   = format === 'currency';

  const ArrowUp = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </svg>
  );
  const ArrowDown = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
    </svg>
  );

  return (
    <div style={{ ...cardStyle, borderTop: `3px solid ${color}` }}>

      {/* Label */}
      <div style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>

      {/* Delta */}
      <div style={{ marginBottom: 12 }}>
        {delta === null ? (
          <span style={{ fontSize: 12, color: '#aaa' }}>Belum ada data kemarin</span>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 20, fontWeight: 800,
            color: isUp ? '#16a34a' : '#dc2626',
          }}>
            {isUp ? <ArrowUp /> : <ArrowDown />}
            {isUp ? '+' : ''}{delta.toFixed(1)}%
          </div>
        )}
      </div>

      {/* Hari ini */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#aaa', minWidth: 52 }}>Hari ini</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#1a202c' }}>
          {shortNum(todayNum, isCurrency)}
        </span>
      </div>

      {/* Kemarin */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
        <span style={{ fontSize: 11, color: '#aaa', minWidth: 52, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Kemarin</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>
          {shortNum(yesterdayNum, isCurrency)}
        </span>
      </div>

      {/* Mini chart */}
      {chart && chart.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <LineChart data={chart} color={color} height={52} />
        </div>
      )}
    </div>
  );
}

// ─── Monthly Chart Card ─────────────────────────────────────────────────────
function MonthlyChartCard({ data }) {
  // Fill hari kosong dengan value 0 dari tanggal 1 s/d hari ini
  const now          = new Date();
  const year         = now.getFullYear();
  const month        = now.getMonth();
  const todayDate    = now.getDate();
  const dataMap      = {};
  (data || []).forEach(d => { dataMap[d.date] = d.value; });

  const filledData = [];
  for (let day = 1; day <= todayDate; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    filledData.push({ date: dateStr, value: dataMap[dateStr] || 0 });
  }

  const hasData    = filledData.some(d => d.value > 0);
  const totalMonth = filledData.reduce((s, d) => s + d.value, 0);

  // X-axis: tampilkan tanggal 1, 5, 10, 15, 20, 25, dan hari ini
  const xLabels = filledData.filter(d => {
    const day = new Date(d.date).getDate();
    return day === 1 || day % 5 === 0 || day === todayDate;
  });

  return (
    <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Penjualan Bulan Ini
          </div>
          {hasData && (
            <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
              Total: <strong>Rp {totalMonth.toLocaleString('id-ID')}</strong>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#aaa' }}>
          {now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {filledData.length >= 2 ? (
        <>
          <LineChart data={filledData} color="#3b82f6" height={110} />

          {/* X-axis labels */}
          <div style={{ position: 'relative', height: 18, marginTop: 2 }}>
            {xLabels.map((d) => {
              const day     = new Date(d.date).getDate();
              const pct     = ((day - 1) / (todayDate - 1 || 1)) * 100;
              const isToday = day === todayDate;
              return (
                <span key={d.date} style={{
                  position:   'absolute',
                  left:       `${pct}%`,
                  transform:  'translateX(-50%)',
                  fontSize:   10,
                  color:      isToday ? '#3b82f6' : '#bbb',
                  fontWeight: isToday ? 700 : 400,
                  whiteSpace: 'nowrap',
                }}>
                  {isToday ? 'Hari ini' : day}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, padding: '20px 0' }}>
          Belum ada data bulan ini
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard({ session, onLogout }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  const API_BASE    = '/api/v1';
  const customFetch = useCallback(async (url) => {
    const token    = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`[${response.status}]`);
    return response.json();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const now       = new Date();
        const toDateStr = (d) => d.toISOString().split('T')[0];

        const today     = toDateStr(now);
        const yd        = new Date(now); yd.setDate(yd.getDate() - 1);
        const yesterday = toDateStr(yd);

        // First day of current month
        const firstOfMonth = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

        const baseFilter = `IsSOTrx eq true and DocStatus eq 'CO'`;

        // ── Fetch c_order data (sales + monthly) ─────────────────────
        const [resToday, resYday, resMonth] = await Promise.all([
          customFetch(
            `/models/c_order?$filter=${baseFilter}` +
            ` and DateOrdered ge ${today}T00:00:00Z and DateOrdered le ${today}T23:59:59Z` +
            `&$select=C_Order_ID,GrandTotal`
          ),
          customFetch(
            `/models/c_order?$filter=${baseFilter}` +
            ` and DateOrdered ge ${yesterday}T00:00:00Z and DateOrdered le ${yesterday}T23:59:59Z` +
            `&$select=C_Order_ID,GrandTotal`
          ),
          customFetch(
            `/models/c_order?$filter=${baseFilter}` +
            ` and DateOrdered ge ${firstOfMonth}T00:00:00Z and DateOrdered le ${today}T23:59:59Z` +
            `&$select=GrandTotal,DateOrdered`
          ),
        ]);

        // ── Aggregate sales today & yesterday ────────────────────────
        const sumTotal = (records) =>
          (records || []).reduce((s, r) => s + parseFloat(r.GrandTotal || 0), 0);

        const todaySales     = sumTotal(resToday.records);
        const yesterdaySales = sumTotal(resYday.records);

        // ── Monthly chart: group by date ─────────────────────────────
        const monthMap = {};
        (resMonth.records || []).forEach(r => {
          const day = (r.DateOrdered || '').split('T')[0];
          if (day) monthMap[day] = (monthMap[day] || 0) + parseFloat(r.GrandTotal || 0);
        });
        const monthChart = Object.entries(monthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => ({ date, value }));

        // ── QtyOrdered: 2-step karena iDempiere tidak support dot-notation filter ──
        // Step 1: ambil id numerik dari c_order records yang sudah difetch sebelumnya
        const extractIds = (records) => {
          const ids = (records || []).map(r => {
            // iDempiere bisa return id dalam beberapa format
            // Coba urutan: r.id -> r.C_Order_ID.id -> r.C_Order_ID (integer)
            if (r.id)                              return r.id;
            if (r.C_Order_ID?.id)                  return r.C_Order_ID.id;
            if (typeof r.C_Order_ID === 'number')  return r.C_Order_ID;
            return null;
          }).filter(id => id !== null && id !== undefined);
          console.debug('[Dashboard] extractIds - sample record:', JSON.stringify(records?.[0]));
          console.debug('[Dashboard] extractIds - result ids:', ids.slice(0, 5));
          return ids;
        };

        const todayOrderIds     = extractIds(resToday.records);
        const yesterdayOrderIds = extractIds(resYday.records);

        console.debug('[Dashboard] todayOrderIds:', todayOrderIds);
        console.debug('[Dashboard] yesterdayOrderIds:', yesterdayOrderIds);

        const sumQty = (records) =>
          (records || []).reduce((s, r) => s + parseFloat(r.QtyOrdered || 0), 0);

        // Step 2: fetch c_orderline hanya jika ada order IDs
        let todayQty = 0, yesterdayQty = 0;

        if (todayOrderIds.length > 0) {
          const idFilter = todayOrderIds.map(id => `C_Order_ID eq ${id}`).join(' or ');
          console.debug('[Dashboard] c_orderline filter today:', idFilter);
          const res = await customFetch(
            `/models/c_orderline?$filter=${idFilter}&$select=QtyOrdered`
          );
          console.debug('[Dashboard] c_orderline today records:', res.records?.length, res.records?.[0]);
          todayQty = sumQty(res.records);
        }

        if (yesterdayOrderIds.length > 0) {
          const idFilter = yesterdayOrderIds.map(id => `C_Order_ID eq ${id}`).join(' or ');
          const res = await customFetch(
            `/models/c_orderline?$filter=${idFilter}&$select=QtyOrdered`
          );
          console.debug('[Dashboard] c_orderline yesterday records:', res.records?.length, res.records?.[0]);
          yesterdayQty = sumQty(res.records);
        }

        setStats({
          todaySales, yesterdaySales,
          monthChart,
          todayQty, yesterdayQty,
        });
      } catch (err) {
        console.error('Dashboard load error:', err.message);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customFetch]);


  return (
    <div className="dashboard-root">
      <main className="dashboard-main">
        <div className="dashboard-welcome">
            {/* ── Nav shortcut ── */}
            <div className="welcome-cards">
              <div className="welcome-card">
              <div className="welcome-card-icon"></div>
                <Link to="/pos-order" className="welcome-card-link"> 
                  <CashierIcon />  
                  <div className="welcome-card-label">Menu</div>
                  <div className="welcome-card-value">Sales Order</div>
                </Link>

              </div>    
              <div className="welcome-card">
                <div className="welcome-card-icon">🛡️</div>
                <div className="welcome-card-label">Role</div>
                <div className="welcome-card-value">{session.roleName}</div>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-icon">🏬</div>
                <div className="welcome-card-label">Organisasi</div>
                <div className="welcome-card-value">{session.orgName}</div>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-icon">
                  <CashierIcon />
                </div>
                <div className="welcome-card-label">Bahasa</div>
                <div className="welcome-card-value">{session.language}</div>
              </div>
            </div>

            {/* ── Stats ── */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: 13 }}>
                Memuat data dashboard...
              </div>
            ) : !stats ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#f87171', fontSize: 13 }}>
                Gagal memuat data. Periksa koneksi API.
              </div>
            ) : (
              <div style={gridStyle}>
                {/* Card 1 — Total Sales */}
                <StatCard
                  label="Total Penjualan"
                  today={stats.todaySales}
                  yesterday={stats.yesterdaySales}
                  format="currency"
                  color="#3b82f6"
                  chart={stats.monthChart}
                />

                {/* Card 2 — Total Qty */}
                <StatCard
                  label="Total Item Terjual"
                  today={stats.todayQty}
                  yesterday={stats.yesterdayQty}
                  format="number"
                  color="#10b981"
                />

                {/* Card 3 — Monthly Chart */}
                <MonthlyChartCard data={stats.monthChart} />
              </div>
            )}         
            
        </div>
      </main>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  padding: '16px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  border: '1px solid #f0f0f0',
};


const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)', // Tetap membagi 3 kolom
  gap: '16px',
  alignItems: 'start',
  width: '100%',                         /* Tambahkan ini agar grid melebar penuh */
  textAlign: 'left'                      /* Tambahkan ini jika ingin teks di dalam kartu rata kiri */
};



const navCardStyle = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  background: '#fff',
  borderRadius: 12,
  padding: '12px 16px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  border: '1px solid #f0f0f0',
};

const navLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 8,
  background: '#f8fafc',
  color: '#334155',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid #e2e8f0',
  transition: 'background 0.15s',
};
// ── Cari objek gridStyle di bagian bawah file React Anda dan ganti menjadi: ──
