import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import PositionsPage from './pages/PositionsPage'
import OrdersPage   from './pages/OrdersPage'
import HistoryPage  from './pages/HistoryPage'
import MarketPage   from './pages/MarketPage'
import { IconChart, IconList, IconClock, IconRefresh, IconBolt, IconGlobe } from './components/Icons'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => {
  const num = parseFloat(n)
  if (n === null || n === undefined || n === '' || isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const pnlCls = v => { const n = parseFloat(v); return isNaN(n)||n===0?'':''.concat(n>0?'green':'red') }
const pnlFmt = v => { const n = parseFloat(v); if(isNaN(n)) return '--'; return (n>0?'+':'')+fmt(v) }

// ── Toast store ───────────────────────────────────────────────────────────────
let _setToasts = null
export function toast(msg, type = 'inf') {
  if (!_setToasts) return
  const id = Date.now()
  _setToasts(prev => [...prev, { id, msg, type }])
  setTimeout(() => _setToasts(prev => prev.filter(t => t.id !== id)), 4000)
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,       setTab]       = useState('positions')
  const [account,   setAccount]   = useState(null)
  const [positions, setPositions] = useState([])
  const [orders,    setOrders]    = useState([])
  const [tickers,   setTickers]   = useState({})
  const [marketData, setMarketData] = useState([])
  const [history,   setHistory]   = useState([])
  const [trades,    setTrades]    = useState([])
  const [connected, setConnected] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState('')
  const [toasts,      setToasts]      = useState([])
  _setToasts = setToasts

  const timerRef = useRef(null)

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [accRes, posRes, ordRes, histRes, tradesRes, tickRes] = await Promise.allSettled([
        fetch('/api/account').then(r => r.json()),
        fetch('/api/positions').then(r => r.json()),
        fetch('/api/orders/pending').then(r => r.json()),
        fetch('/api/orders/history').then(r => r.json()),
        fetch('/api/trades/history').then(r => r.json()),
        fetch('/api/tickers').then(r => r.json()),
      ])

      if (accRes.status === 'fulfilled' && accRes.value?.code === 0) {
        const accData = accRes.value.data
        setAccount(Array.isArray(accData) ? accData[0] : accData)
        setConnected(true)
      } else {
        console.error('Account fetch failed', accRes.value);
        // Only set disconnected if we have NO account data
        if (!account) setConnected(false)
      }

      if (posRes.status === 'fulfilled' && posRes.value?.code === 0) {
        const list = posRes.value.data
        setPositions(Array.isArray(list) ? list : [])
        setConnected(true) // Positions working is a good sign
      } else {
        console.error('Positions fetch failed', posRes.value);
      }
      if (ordRes.status === 'fulfilled' && ordRes.value?.code === 0) {
        const list = ordRes.value.data?.orderList ?? ordRes.value.data ?? []
        setOrders(Array.isArray(list) ? list : [])
      }
      if (histRes.status === 'fulfilled' && histRes.value?.code === 0) {
        const list = histRes.value.data?.orderList ?? histRes.value.data ?? []
        setHistory(Array.isArray(list) ? list : [])
      }
      if (tradesRes.status === 'fulfilled' && tradesRes.value?.code === 0) {
        const list = tradesRes.value.data?.tradeList ?? tradesRes.value.data ?? []
        setTrades(Array.isArray(list) ? list : [])
      }

      if (tickRes && tickRes.status === 'fulfilled' && tickRes.value?.code === 0) {
        const tickMap = {}
        const list = tickRes.value.data || []
        list.forEach(t => { tickMap[t.symbol] = t.lastPrice })
        setTickers(tickMap)
        
        // Process top 50 by quoteVol
        const sorted = [...list].sort((a, b) => parseFloat(b.quoteVol || 0) - parseFloat(a.quoteVol || 0))
        setMarketData(sorted.slice(0, 50))
      }

      setLastUpdate(new Date().toLocaleTimeString('vi-VN'))
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (autoRefresh) {
      timerRef.current = setInterval(fetchAll, 15000)
    }
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, fetchAll])

  // ── Account derived values ──────────────────────────────────────────────────
  const available  = account?.available ?? account?.availableBalance ?? account?.availAmt ?? account?.crossedAvailableBalance ?? '--'
  const frozen     = account?.frozen ?? account?.usedMargin ?? account?.crossedPositionInitialMargin ?? account?.initialMargin ?? '--'
  const margin     = account?.margin ?? account?.frozen ?? account?.crossedMarginBalance ?? '--'
  const crossPnl   = account?.crossUnrealizedPNL ?? account?.unrealizedPNL ?? account?.unrealPnl ?? account?.crossedUnrealizedPNL ?? '--'
  const isooPnl    = account?.isolationUnrealizedPNL ?? 0
  const totalUPnl  = crossPnl !== '--'
    ? (parseFloat(crossPnl) + parseFloat(isooPnl || 0)).toFixed(4)
    : '--'
  const equity = account?.equity ?? account?.totalEquity ?? account?.crossedAccountEquity ?? (
    available !== '--' && margin !== '--'
      ? (parseFloat(available) + parseFloat(margin) + parseFloat(totalUPnl || 0)).toFixed(4)
      : '--'
  )

  const TABS = [
    { id: 'market',    label: 'Thị trường',   Icon: IconGlobe },
    { id: 'positions', label: 'Vị thế mở',   Icon: IconChart, badge: positions.length },
    { id: 'orders',    label: 'Lệnh chờ',     Icon: IconList,  badge: orders.length, cls: 'yellow' },
    { id: 'history',   label: 'Lịch sử lệnh', Icon: IconClock },
  ]

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-gem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 9l9 13 9-13z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M3 9h18" stroke="white" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <div className="brand-name grad">BITUNIX</div>
            <div className="brand-sub">Futures Pro</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(({ id, label, Icon, badge, cls }) => (
            <button
              key={id}
              className={`nav-btn${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon className="nav-icon" />
              {label}
              {badge != null && badge > 0 && (
                <span className={`count-badge${cls ? ' '+cls : ''}`} style={{ marginLeft: 'auto' }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="conn-status">
            <span className={`conn-dot${connected === true ? ' ok' : connected === false ? ' err' : ''}`} />
            <span>{connected === true ? 'Đã kết nối' : connected === false ? 'Lỗi kết nối' : 'Đang kết nối...'}</span>
          </div>
          <button className={`refresh-btn${loading ? ' spin' : ''}`} onClick={fetchAll} disabled={loading}>
            <IconRefresh style={{ width: 14, height: 14 }} />
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">
              {TABS.find(t => t.id === tab)?.label ?? 'Dashboard'}
            </span>
          </div>
          <div className="topbar-right">
            <div className="live-badge">
              <span className="live-dot" />
              LIVE
            </div>
            <span className="update-time">{lastUpdate || '--:--:--'}</span>
            <label className="auto-label">
              Tự động
              <label className="toggle">
                <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                <span className="toggle-track" />
              </label>
            </label>
          </div>
        </header>

        {/* Page */}
        <div className="page">
          {/* Stat cards */}
          <div className="stats-row">
            <StatCard
              icon={<IconBolt />} cls="si-blue" label="Số dư khả dụng"
              value={available !== '--' ? fmt(available) + ' USDT' : '--'}
              sub={`Frozen: ${fmt(frozen)} USDT`}
            />
            <StatCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              cls="si-purple" label="Equity"
              value={equity !== '--' ? fmt(equity) + ' USDT' : '--'}
              sub="Tổng tài sản ước tính"
            />
            <StatCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
              cls={parseFloat(totalUPnl) >= 0 ? 'si-green' : 'si-red'} label="Unrealized PnL"
              value={<span className={pnlCls(totalUPnl)}>{pnlFmt(totalUPnl)} USDT</span>}
              sub="Lãi/lỗ chưa chốt"
            />
            <StatCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              cls="si-yellow" label="Margin đã dùng"
              value={margin !== '--' ? fmt(margin) + ' USDT' : '--'}
              sub={`${positions.length} vị thế mở`}
            />
          </div>

          {/* Tab pages */}
          {tab === 'market' && (
            <MarketPage marketData={marketData} />
          )}
          {tab === 'positions' && (
            <PositionsPage positions={positions} tickers={tickers} onRefresh={fetchAll} />
          )}
          {tab === 'orders' && (
            <OrdersPage orders={orders} />
          )}
          {tab === 'history' && (
            <HistoryPage history={history} trades={trades} />
          )}
        </div>
      </div>

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, cls, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${cls}`}>{icon}</div>
      <div className="stat-body">
        <div className="stat-lbl">{label}</div>
        <div className="stat-val">{value}</div>
        <div className="stat-sub">{sub}</div>
      </div>
    </div>
  )
}
