import { useState } from 'react'
import { toast } from '../App'

const fmt = (n, d = 4) => {
  const num = parseFloat(n)
  if (n === null || n === undefined || n === '' || isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const fmtVol = (n) => {
  const num = parseFloat(n)
  if (isNaN(num)) return '--'
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return num.toFixed(2)
}

export default function MarketPage({ marketData }) {
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'quoteVol', direction: 'desc' })

  // Trade Modal State
  const [tradeModal, setTradeModal] = useState(null)
  const [orderType, setOrderType] = useState('MARKET')
  const [limitPrice, setLimitPrice] = useState('')
  const [margin, setMargin] = useState('')
  const [leverage, setLeverage] = useState(10)
  const [isTrading, setIsTrading] = useState(false)

  const openTradeModal = (m) => {
    const price = m.lastPrice ?? m.last ?? 0
    setTradeModal({ symbol: m.symbol, price })
    setLimitPrice(price)
    setOrderType('MARKET')
    setMargin('')
    setLeverage(10)
  }

  const handleTrade = async (side) => {
    if (!margin || isNaN(margin) || margin <= 0) return toast('Vui lòng nhập Margin hợp lệ', 'err')
    if (orderType === 'LIMIT' && (!limitPrice || isNaN(limitPrice) || limitPrice <= 0)) return toast('Vui lòng nhập giá Limit', 'err')
    
    setIsTrading(true)
    try {
      const execPrice = orderType === 'LIMIT' ? parseFloat(limitPrice) : parseFloat(tradeModal.price)
      const qty = (parseFloat(margin) * parseFloat(leverage)) / execPrice

      const body = {
        symbol: tradeModal.symbol,
        side,
        orderType,
        qty: qty.toFixed(3) // Ensure stable decimal for qty
      }
      if (orderType === 'LIMIT') body.price = execPrice.toFixed(6)

      const res = await fetch('/api/trade/place_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (json.code === 0) {
        toast(`Thành công: Lệnh ${side} ${tradeModal.symbol} đã gửi`, 'ok')
        setTradeModal(null)
      } else {
        toast(`Lỗi từ sàn: ${json.msg || 'Không rõ'}`, 'err')
      }
    } catch (e) {
      toast(`Lỗi kết nối: ${e.message}`, 'err')
    } finally {
      setIsTrading(false)
    }
  }

  const handleSort = (key) => {
    let direction = 'desc'
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc'
    }
    setSortConfig({ key, direction })
  }

  const sortedData = [...marketData].sort((a, b) => {
    let aVal, bVal
    if (sortConfig.key === 'symbol') {
      aVal = a.symbol || ''
      bVal = b.symbol || ''
    } else if (sortConfig.key === 'change') {
      const aOpen = parseFloat(a.open || 0), aLast = parseFloat(a.last || a.lastPrice || 0)
      aVal = aOpen > 0 ? ((aLast - aOpen) / aOpen) * 100 : 0
      const bOpen = parseFloat(b.open || 0), bLast = parseFloat(b.last || b.lastPrice || 0)
      bVal = bOpen > 0 ? ((bLast - bOpen) / bOpen) * 100 : 0
    } else {
      aVal = parseFloat(a[sortConfig.key] ?? a.lastPrice ?? 0)
      bVal = parseFloat(b[sortConfig.key] ?? b.lastPrice ?? 0)
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const filtered = sortedData.filter(m =>
    (m.symbol || '').toLowerCase().includes(search.toLowerCase())
  )

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>
    return <span style={{ marginLeft: 4 }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="tab-page">
      <div className="section-head">
        <h2 className="section-title">
          Top 50 Thị Trường (Volume)
        </h2>
        <div className="section-actions">
          <input
            className="search-box"
            placeholder="Tìm symbol..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="panel">
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('symbol')}>Symbol <SortIcon column="symbol"/></th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('lastPrice')}>Giá hiện tại <SortIcon column="lastPrice"/></th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('change')}>24h Thay đổi <SortIcon column="change"/></th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('high')}>24h Cao nhất <SortIcon column="high"/></th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('low')}>24h Thấp nhất <SortIcon column="low"/></th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('quoteVol')}>Volume (USDT) <SortIcon column="quoteVol"/></th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="center-state">
                    Đang tải dữ liệu hoặc không có kết quả
                  </td>
                </tr>
              ) : (
                filtered.map((m, idx) => {
                  const open = parseFloat(m.open || 0)
                  const last = parseFloat(m.last || m.lastPrice || 0)
                  const change = open > 0 ? ((last - open) / open) * 100 : 0
                  
                  return (
                    <tr key={m.symbol}>
                      <td className="dim">{idx + 1}</td>
                      <td className="sans" style={{ fontWeight: 700 }}>{m.symbol}</td>
                      <td>{fmt(last, 6)}</td>
                      <td className={change > 0 ? 'green' : change < 0 ? 'red' : ''}>
                        {change > 0 ? '+' : ''}{change.toFixed(2)}%
                      </td>
                      <td className="dim">{fmt(m.high, 6)}</td>
                      <td className="dim">{fmt(m.low, 6)}</td>
                      <td className="sans">{fmtVol(m.quoteVol)}</td>
                      <td>
                        <button 
                          className="btn-be" 
                          style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
                          onClick={() => openTradeModal(m)}
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Modal */}
      {tradeModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="panel" style={{ width: '350px', padding: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Trade {tradeModal.symbol}</h2>
              <button className="btn-link" onClick={() => setTradeModal(null)}>✕</button>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#94a3b8' }}>Loại lệnh</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  style={{ flex: 1, padding: '8px', background: orderType === 'MARKET' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => setOrderType('MARKET')}
                >Market</button>
                <button 
                  style={{ flex: 1, padding: '8px', background: orderType === 'LIMIT' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => setOrderType('LIMIT')}
                >Limit</button>
              </div>
            </div>

            {orderType === 'LIMIT' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#94a3b8' }}>Giá Limit (USDT)</label>
                <input 
                  type="number" className="search-box" style={{ width: '100%', boxSizing: 'border-box' }}
                  value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#94a3b8' }}>Ký quỹ / Margin (USDT)</label>
                <input 
                  type="number" className="search-box" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Ví dụ: 10"
                  value={margin} onChange={e => setMargin(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#94a3b8' }}>Đòn bẩy (x)</label>
                <input 
                  type="number" className="search-box" style={{ width: '100%', boxSizing: 'border-box' }}
                  value={leverage} onChange={e => setLeverage(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '12px', color: '#94a3b8' }}>
              Quy mô vị thế ước tính: <strong style={{ color: '#fff' }}>{margin && leverage ? (parseFloat(margin) * parseFloat(leverage)).toFixed(2) : '0'} USDT</strong>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                disabled={isTrading}
                style={{ flex: 1, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isTrading ? 'not-allowed' : 'pointer', opacity: isTrading ? 0.7 : 1 }}
                onClick={() => handleTrade('BUY')}
              >
                Mở LONG
              </button>
              <button 
                disabled={isTrading}
                style={{ flex: 1, padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isTrading ? 'not-allowed' : 'pointer', opacity: isTrading ? 0.7 : 1 }}
                onClick={() => handleTrade('SELL')}
              >
                Mở SHORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
