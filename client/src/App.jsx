import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import PositionsPage from './pages/PositionsPage'
import OrdersPage   from './pages/OrdersPage'
import HistoryPage  from './pages/HistoryPage'
import MarketPage   from './pages/MarketPage'
import { IconChart, IconList, IconClock, IconGlobe, IconHome, IconUser, IconTradeArrows, IconArrowUp } from './components/Icons'

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
  const [tab,       setTab]       = useState('market')
  const [account,   setAccount]   = useState(null)
  const [positions, setPositions] = useState([])
  const [orders,    setOrders]    = useState([])
  const [tickers,   setTickers]   = useState({})
  const [marketData, setMarketData] = useState([])
  const [history,   setHistory]   = useState([])
  const [trades,    setTrades]    = useState([])
  const [connected, setConnected] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [toasts,      setToasts]      = useState([])
  _setToasts = setToasts

  const timerRef = useRef(null)

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
        if (!account) setConnected(false)
      }

      if (posRes.status === 'fulfilled' && posRes.value?.code === 0) {
        const list = posRes.value.data
        setPositions(Array.isArray(list) ? list : [])
        setConnected(true)
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
        
        const usdtList = list.filter(t => (t.symbol || '').toUpperCase().endsWith('USDT'))
        const sorted = [...usdtList].sort((a, b) => parseFloat(b.quoteVol || 0) - parseFloat(a.quoteVol || 0))
        setMarketData(sorted.slice(0, 50))
      }
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(fetchAll, 2000)
    return () => clearInterval(timerRef.current)
  }, [fetchAll])

  // ── Account values ──────────────────────────────────────────────────────────
  const available  = account?.available ?? account?.availableBalance ?? account?.availAmt ?? account?.crossedAvailableBalance ?? '--'
  const margin     = account?.margin ?? account?.frozen ?? account?.crossedMarginBalance ?? '--'
  const crossPnl   = account?.crossUnrealizedPNL ?? account?.unrealizedPNL ?? account?.unrealPnl ?? account?.crossedUnrealizedPNL ?? '--'
  const isooPnl    = account?.isolationUnrealizedPNL ?? 0
  const totalUPnl  = crossPnl !== '--' ? (parseFloat(crossPnl) + parseFloat(isooPnl || 0)).toFixed(4) : '--'
  const totalMargin = positions.reduce((acc, p) => acc + (parseFloat(p.margin ?? p.initialMargin) || 0), 0)
  const equity = account?.equity ?? account?.totalEquity ?? account?.crossedAccountEquity ?? (
    available !== '--' && margin !== '--' ? (parseFloat(available) + parseFloat(margin) + parseFloat(totalUPnl || 0)).toFixed(4) : '--'
  )

  const TABS = [
    { id: 'market',    label: 'Market',   Icon: IconHome },
    { id: 'positions', label: 'Positions',   Icon: IconChart, badge: positions.length },
    { id: 'orders',    label: 'Orders',     Icon: IconList,  badge: orders.length },
    { id: 'history',   label: 'History', Icon: IconClock },
  ]

  return (
    <div className="app">
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="navbar-left">
          <div className="brand">Bitunix Pro</div>
        </div>
        <div className="navbar-center">
          {TABS.map(t => (
            <button key={t.id} className={`navbar-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <t.Icon style={{ width: 18, height: 18 }} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="navbar-right">
          {connected === false && <div style={{ color: 'var(--red)', fontSize: 11 }}>Disconnected</div>}
        </div>
      </nav>

      <div className="main">
        {/* Top Header */}
        <header className="header">
          <div className="header-top">
            <div className="header-title">Total balance</div>
            <div className="header-avatar"><IconUser /></div>
          </div>
          <div className="balance-val">$ {equity !== '--' ? fmt(equity) : '--'}</div>
          
          <div className="header-summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="summary-item-mini">
              <span className="summary-label">unPnl</span>
              <div className={`summary-val-mini ${parseFloat(totalUPnl) >= 0 ? 'green' : 'red'}`}>
                {parseFloat(totalUPnl) >= 0 ? '+' : ''}{parseFloat(totalUPnl || 0).toFixed(2)}
              </div>
            </div>
            <div className="summary-item-mini">
              <span className="summary-label">Margin</span>
              <div className="summary-val-mini">{fmt(totalMargin, 2)}</div>
            </div>
            <div className="summary-item-mini">
              <span className="summary-label">Positions</span>
              <div className="summary-val-mini">{positions.length}</div>
            </div>
          </div>
        </header>

        {/* Horizontal Scroll Cards (Show active positions if any, otherwise skip) */}
        {positions.length > 0 && (
          <div className="h-scroll" style={{ marginTop: '-20px', zIndex: 10, position: 'relative' }}>
            {positions.map(p => {
              const entry = parseFloat(p.avgOpenPrice ?? p.entryPrice ?? p.avgPrice ?? p.openPrice)
              const currentPrice = tickers[p.symbol] ? parseFloat(tickers[p.symbol]) : entry
              const side = (p.side || p.positionSide || p.posSide || '').toUpperCase()
              const isLong = side === 'BUY' || side === 'LONG' || side === '1'
              const markValue = p.qty * currentPrice
              const roe = p.margin > 0 ? (p.unrealizedPNL / p.margin) * 100 : 0
              return (
                <div className="card-mini" key={p.positionId} onClick={() => setTab('positions')}>
                  <div className="card-mini-icon">{p.symbol.substring(0, 1)}</div>
                  <div className="card-mini-info">
                    <div className="card-mini-val">$ {fmt(markValue)}</div>
                    <div className={`card-mini-sub ${roe >= 0 ? 'green' : 'red'}`}>
                      {roe >= 0 ? <IconArrowUp /> : <IconArrowUp style={{ transform: 'rotate(180deg)' }} />}
                      {Math.abs(roe).toFixed(2)}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Page Content */}
        <div className="page" style={{ paddingTop: positions.length > 0 ? '0px' : '20px' }}>
          {tab === 'market' && <MarketPage marketData={marketData} loading={loading} />}
          {tab === 'positions' && <PositionsPage positions={positions} tickers={tickers} onRefresh={fetchAll} loading={loading} />}
          {tab === 'orders' && <OrdersPage orders={orders} loading={loading} />}
          {tab === 'history' && <HistoryPage history={history} trades={trades} loading={loading} />}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav">
        <button className={`bottom-nav-btn ${tab === 'market' ? 'active' : ''}`} onClick={() => setTab('market')}>
          <IconHome />
          Market
        </button>
        <button className={`bottom-nav-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <IconList />
          Orders
        </button>
        <div className="fab-container">
          <button className="fab" onClick={() => setTab('market')}>
            <IconTradeArrows />
          </button>
        </div>
        <button className={`bottom-nav-btn ${tab === 'positions' ? 'active' : ''}`} onClick={() => setTab('positions')}>
          <IconChart />
          Pos ({positions.length})
        </button>
        <button className={`bottom-nav-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <IconUser />
          Profile
        </button>
      </nav>

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </div>
  )
}
