import { useState } from 'react'
import { IconClock, IconList } from '../components/Icons'

const fmt = (n, d = 2) => {
  const num = parseFloat(n)
  if (n === null || n === undefined || n === '' || isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const HistoryCard = ({ title, sub, rightTop, rightBottom, side, status, time, type }) => (
  <div className="list-item" style={{ cursor: 'default' }}>
    <div className="item-left">
      <div className="item-icon" style={{ background: side === 'BUY' ? 'var(--green-dim)' : 'var(--red-dim)', color: side === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
        {side === 'BUY' ? 'L' : 'S'}
      </div>
      <div>
        <div className="item-name">{title} <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-gray)' }}>{type}</span></div>
        <div className="item-sub">{time}</div>
      </div>
    </div>
    <div className="item-right">
      <div className="item-price" style={{ color: rightTop.includes('+') ? 'var(--green)' : rightTop.includes('-') ? 'var(--red)' : 'var(--text-dark)' }}>{rightTop}</div>
      <div className="item-sub" style={{ textAlign: 'right' }}>{rightBottom}</div>
      {status && (
        <div className={`badge ${status === 'FILLED' ? 'b-filled' : 'b-cancel'}`} style={{ marginTop: '4px' }}>
          {status}
        </div>
      )}
    </div>
  </div>
)

export default function HistoryPage({ history, trades }) {
  const [subTab, setSubTab] = useState('trades') // 'orders' or 'trades'

  return (
    <div className="tab-page">
      <div className="toggle-group">
        <button 
          className={`toggle-btn ${subTab === 'trades' ? 'active buy' : ''}`}
          onClick={() => setSubTab('trades')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <IconClock style={{ width: 16, height: 16 }} />
          Khớp lệnh
        </button>
        <button 
          className={`toggle-btn ${subTab === 'orders' ? 'active buy' : ''}`}
          onClick={() => setSubTab('orders')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <IconList style={{ width: 16, height: 16 }} />
          Lịch sử lệnh
        </button>
      </div>

      <div className="list-container" style={{ marginTop: '10px' }}>
        {subTab === 'trades' ? (
          trades.length === 0 ? (
            <div className="center-state">Không có lịch sử khớp lệnh</div>
          ) : (
            trades.map((t, idx) => {
              const pnl = parseFloat(t.realizedPNL ?? t.profit ?? 0)
              const side = (t.side || '').toUpperCase()
              return (
                <HistoryCard 
                  key={idx}
                  title={t.symbol}
                  type={side}
                  side={side}
                  time={new Date(Number(t.createTime || t.tradeTime)).toLocaleString('vi-VN')}
                  rightTop={pnl !== 0 ? `${pnl > 0 ? '+' : ''}${fmt(pnl)} USDT` : `${fmt(t.price ?? t.tradePrice ?? t.avgFillPrice, 4)}`}
                  rightBottom={`Qty: ${fmt(t.qty ?? t.size, 4)}`}
                />
              )
            })
          )
        ) : (
          history.length === 0 ? (
            <div className="center-state">Không có lịch sử lệnh</div>
          ) : (
            history.map((o, idx) => {
              const side = (o.side || '').toUpperCase()
              return (
                <HistoryCard 
                  key={o.orderId || idx}
                  title={o.symbol}
                  type={o.orderType || 'LIMIT'}
                  side={side}
                  status={o.status}
                  time={new Date(Number(o.createTime || o.ctime)).toLocaleString('vi-VN')}
                  rightTop={`${fmt(o.price, 4)} USDT`}
                  rightBottom={`Filled: ${fmt(o.filledQty ?? o.executedQty ?? 0, 4)}/${fmt(o.qty ?? o.size, 4)}`}
                />
              )
            })
          )
        )}
      </div>
    </div>
  )
}
