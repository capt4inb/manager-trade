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

const CoinIcon = ({ symbol }) => {
  const coin = symbol.replace('USDT', '').toLowerCase()
  return (
    <div className="item-icon round">
      <img 
        src={`https://bin.bnbstatic.com/static/assets/logos/${coin}.png`} 
        onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${coin}&background=random` }}
        alt={coin}
      />
    </div>
  )
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

  const openTradeModal = (m, side = 'BUY') => {
    const price = m.lastPrice ?? m.last ?? 0
    setTradeModal({ symbol: m.symbol, price, defaultSide: side })
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
      
      const calcQty = (m, l, p) => {
        const q = (parseFloat(m) * parseFloat(l)) / parseFloat(p);
        if (p > 1000) return q.toFixed(3);
        if (p > 10) return q.toFixed(2);
        if (p > 0.1) return q.toFixed(1);
        return q.toFixed(0);
      }
      
      const qtyStr = calcQty(margin, leverage, execPrice);

      const body = {
        symbol: tradeModal.symbol,
        side,
        orderType,
        qty: qtyStr
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

  return (
    <div>
      <input
        className="search-box"
        placeholder="Tìm symbol..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="filter-tabs">
        {[
          { key: 'symbol', label: 'Tên' },
          { key: 'lastPrice', label: 'Giá' },
          { key: 'change', label: 'Biến động' },
          { key: 'quoteVol', label: 'Volume' }
        ].map(s => (
          <button 
            key={s.key}
            className={sortConfig.key === s.key ? 'active' : ''}
            onClick={() => handleSort(s.key)}
          >
            {s.label} {sortConfig.key === s.key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
          </button>
        ))}
      </div>

      <div className="list-container">
        {filtered.length === 0 ? (
          <div className="center-state">Không có kết quả</div>
        ) : (
          filtered.map(m => {
            const open = parseFloat(m.open || 0)
            const last = parseFloat(m.last || m.lastPrice || 0)
            const change = open > 0 ? ((last - open) / open) * 100 : 0
            
            return (
              <div className="list-item" key={m.symbol} onClick={() => openTradeModal(m, 'BUY')}>
                <div className="item-left">
                  <CoinIcon symbol={m.symbol} />
                  <div>
                    <div className="item-name">{m.symbol.replace('USDT', '')}</div>
                    <div className="item-sub">Vol {fmtVol(m.quoteVol)}</div>
                  </div>
                </div>
                
                <div className="item-right">
                  <div className="item-price">$ {fmt(last, last < 1 ? 4 : 2)}</div>
                  <div className={`item-change ${change >= 0 ? 'green' : 'red'}`}>
                    {change > 0 ? '+' : ''}{change.toFixed(2)}%
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Trade Modal */}
      {tradeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">Trade {tradeModal.symbol}</div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600', 
                         background: orderType === 'MARKET' ? 'var(--primary)' : 'var(--bg-light)', 
                         color: orderType === 'MARKET' ? '#fff' : 'var(--text-gray)', border: 'none' }}
                onClick={() => setOrderType('MARKET')}
              >Market</button>
              <button 
                style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600', 
                         background: orderType === 'LIMIT' ? 'var(--primary)' : 'var(--bg-light)', 
                         color: orderType === 'LIMIT' ? '#fff' : 'var(--text-gray)', border: 'none' }}
                onClick={() => setOrderType('LIMIT')}
              >Limit</button>
            </div>

            {orderType === 'LIMIT' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-gray)', fontWeight: '500' }}>Giá Limit (USDT)</label>
                <input 
                  type="number" className="search-box" style={{ marginBottom: 0 }}
                  value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: 'var(--text-gray)', fontWeight: '500' }}>
                <span>Đòn bẩy ({leverage}x)</span>
                <span style={{ color: leverage > 50 ? 'var(--red)' : 'var(--primary)' }}>{leverage > 50 ? 'Rủi ro cao' : ''}</span>
              </label>
              <input 
                type="range" min="1" max="125" step="1" 
                value={leverage} onChange={e => setLeverage(e.target.value)}
                style={{ width: '100%', cursor: 'pointer', accentColor: leverage > 50 ? 'var(--red)' : 'var(--primary)' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {[10, 20, 50, 100].map(x => (
                  <button 
                    key={x}
                    style={{ flex: 1, padding: '6px', fontSize: '12px', fontWeight: '600', borderRadius: '6px',
                             background: leverage == x ? 'var(--primary-dim)' : 'var(--bg-light)', 
                             color: leverage == x ? 'var(--primary)' : 'var(--text-gray)', border: 'none' }}
                    onClick={() => setLeverage(x)}
                  >{x}x</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-gray)', fontWeight: '500' }}>Ký quỹ / Margin (USDT)</label>
              <input 
                type="number" className="search-box" style={{ marginBottom: 0, fontSize: '16px', fontWeight: '600' }} placeholder="Ví dụ: 10"
                value={margin} onChange={e => setMargin(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-gray)', textAlign: 'center' }}>
              Quy mô vị thế ước tính: <strong style={{ color: 'var(--text-dark)', fontSize: '15px' }}>{margin && leverage ? (parseFloat(margin) * parseFloat(leverage)).toFixed(2) : '0'} USDT</strong>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                disabled={isTrading}
                style={{ flex: 1, padding: '14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '15px', cursor: isTrading ? 'not-allowed' : 'pointer', opacity: isTrading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                onClick={() => handleTrade('BUY')}
              >Mở LONG</button>
              <button 
                disabled={isTrading}
                style={{ flex: 1, padding: '14px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '15px', cursor: isTrading ? 'not-allowed' : 'pointer', opacity: isTrading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                onClick={() => handleTrade('SELL')}
              >Mở SHORT</button>
            </div>
            
            <button 
              style={{ width: '100%', padding: '12px', marginTop: '12px', background: 'none', border: 'none', color: 'var(--text-gray)', fontWeight: '600', cursor: 'pointer' }}
              onClick={() => setTradeModal(null)}
            >Hủy bỏ</button>
          </div>
        </div>
      )}
    </div>
  )
}
