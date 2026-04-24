import { useState } from 'react'
import { toast } from '../App'

const fmt = (n, d = 4) => {
  const num = parseFloat(n)
  if (n === null || n === undefined || n === '' || isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const pnlCls = v => {
  const n = parseFloat(v)
  if (isNaN(n) || n === 0) return ''
  return n > 0 ? 'green' : 'red'
}

const pnlFmt = v => {
  const n = parseFloat(v)
  if (isNaN(n)) return '--'
  return (n > 0 ? '+' : '') + fmt(v, 2)
}

export default function PositionsPage({ positions, tickers = {}, onRefresh }) {
  const [search, setSearch] = useState('')
  const [loadingAction, setLoadingAction] = useState(null)

  const filtered = positions.filter(p =>
    (p.symbol || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleAction = async (action, data) => {
    setLoadingAction(data.positionId + action)
    try {
      const res = await fetch(`/api/positions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const json = await res.json()
      if (json.code === 0) {
        toast(`Thành công: ${action.toUpperCase()} ${data.symbol}`, 'ok')
        if (onRefresh) onRefresh()
      } else {
        toast(`Lỗi: ${json.msg || 'Không rõ'}`, 'err')
      }
    } catch (e) {
      toast(`Lỗi kết nối: ${e.message}`, 'err')
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="tab-page">
      <div className="section-head">
        <h2 className="section-title">
          Vị thế Future đang mở
          <span className="count-badge">{filtered.length}</span>
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
                <th>Symbol</th>
                <th>Hướng</th>
                <th>Kích thước</th>
                <th>Giá vào</th>
                <th>Giá Mark</th>
                <th>Lãi/Lỗ (ROE%)</th>
                <th>Margin</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="center-state">
                    Không có vị thế nào
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const side = (p.side || p.positionSide || p.posSide || '').toUpperCase()
                  const pnl = p.unrealizedPNL ?? p.unrealPnl ?? p.profit ?? 0
                  const margin = parseFloat(p.margin ?? p.frozenAmount ?? p.initialMargin) || 1 // avoid div by zero
                  const roe = ((parseFloat(pnl) / margin) * 100).toFixed(2)
                  const isBusy = loadingAction && loadingAction.startsWith(p.positionId)

                  return (
                    <tr key={p.positionId}>
                      <td className="sans" style={{ fontWeight: 700 }}>{p.symbol}</td>
                      <td>
                        <span className={`badge ${side === 'BUY' ? 'b-long' : 'b-short'}`}>
                          {side === 'BUY' ? 'LONG' : 'SHORT'} {p.leverage}x
                        </span>
                      </td>
                      <td>{fmt(p.qty ?? p.size ?? p.total ?? p.holdVolume)}</td>
                      <td>{fmt(p.avgOpenPrice ?? p.entryPrice ?? p.avgPrice ?? p.openPrice)}</td>
                      <td>{fmt(p.markPrice ?? p.lastPrice ?? p.indexPrice ?? tickers[p.symbol])}</td>
                      <td className={pnlCls(pnl)}>
                        {pnlFmt(pnl)} USDT ({roe}%)
                      </td>
                      <td>{fmt(p.margin ?? p.frozenAmount ?? p.initialMargin, 2)}</td>
                      <td>
                        <div className="action-group">
                          <button
                            className="btn-be"
                            disabled={isBusy}
                            onClick={() => handleAction('be', {
                              positionId: p.positionId,
                              symbol: p.symbol,
                              avgOpenPrice: p.avgOpenPrice ?? p.entryPrice ?? p.avgPrice ?? p.openPrice
                            })}
                          >
                            BE
                          </button>
                          
                          {/* Quick TP Buttons: Sets TP at +10% and +20% ROI */}
                          <button
                            className="btn-tp"
                            disabled={isBusy}
                            onClick={() => {
                              const entry = parseFloat(p.avgOpenPrice ?? p.entryPrice ?? p.avgPrice ?? p.openPrice)
                              const lev = parseFloat(p.leverage)
                              // TP Price calculation for 10% ROE
                              // ROE = ((Price - Entry) / Entry) * Lev
                              // Price = Entry * (1 + ROE/Lev)
                              const tpPrice = side === 'BUY' 
                                ? entry * (1 + 0.1 / lev) 
                                : entry * (1 - 0.1 / lev)
                              handleAction('tp', {
                                positionId: p.positionId,
                                symbol: p.symbol,
                                takeProfitPrice: tpPrice.toFixed(6)
                              })
                            }}
                          >
                            TP 10%
                          </button>

                          <button
                            className="btn-tp"
                            disabled={isBusy}
                            onClick={() => {
                              const entry = parseFloat(p.avgOpenPrice ?? p.entryPrice ?? p.avgPrice ?? p.openPrice)
                              const lev = parseFloat(p.leverage)
                              const tpPrice = side === 'BUY' 
                                ? entry * (1 + 0.25 / lev) 
                                : entry * (1 - 0.25 / lev)
                              handleAction('tp', {
                                positionId: p.positionId,
                                symbol: p.symbol,
                                takeProfitPrice: tpPrice.toFixed(6)
                              })
                            }}
                          >
                            TP 25%
                          </button>

                          <button
                            className="btn-close"
                            disabled={isBusy}
                            onClick={() => handleAction('close', {
                              positionId: p.positionId,
                              symbol: p.symbol
                            })}
                          >
                            Đóng
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
