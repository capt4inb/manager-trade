import { useState, useMemo } from 'react'
import { toast } from '../App'
import { 
  IconAlertTriangle, IconInfo, IconChevronDown, IconArrowUp,
  IconRefresh
} from '../components/Icons'
import coinsMetadata from '../data/coins_metadata.json'

// Create a map for quick lookups
const metadataMap = {}
coinsMetadata.coins.forEach(c => {
  metadataMap[c.symbol] = c
})

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
  const [loadingAction, setLoadingAction] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'pnl', direction: 'desc' })
  const [editingTPSL, setEditingTPSL] = useState(null)

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
        setEditingTPSL(null)
      } else {
        toast(`Lỗi: ${json.msg || 'Không rõ'}`, 'err')
      }
    } catch (e) {
      toast(`Lỗi kết nối: ${e.message}`, 'err')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleCloseAll = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đóng TẤT CẢ vị thế?')) return
    setLoadingAction('all-close')
    try {
      const promises = positions.map(p => 
        fetch(`/api/positions/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positionId: p.positionId, symbol: p.symbol })
        }).then(r => r.json())
      )
      const results = await Promise.allSettled(promises)
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.code === 0).length
      toast(`Đã đóng ${successCount}/${positions.length} vị thế`, successCount > 0 ? 'ok' : 'err')
      if (onRefresh) onRefresh()
    } catch (e) {
      toast(`Lỗi: ${e.message}`, 'err')
    } finally {
      setLoadingAction(null)
    }
  }

  const sortedList = useMemo(() => {
    let list = [...positions]
    
    // Sort
    list.sort((a, b) => {
      let aVal, bVal
      const aPnl = a.unrealizedPNL ?? a.unrealPnl ?? 0
      const bPnl = b.unrealizedPNL ?? b.unrealPnl ?? 0
      
      switch (sortConfig.key) {
        case 'symbol': aVal = a.symbol; bVal = b.symbol; break
        case 'size': aVal = Math.abs(a.qty ?? a.size ?? 0); bVal = Math.abs(b.qty ?? b.size ?? 0); break
        case 'pnl': aVal = parseFloat(aPnl); bVal = parseFloat(bPnl); break
        case 'liq': aVal = parseFloat(a.liquidationPrice || 0); bVal = parseFloat(b.liquidationPrice || 0); break
        default: aVal = 0; bVal = 0
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [positions, sortConfig])

  const requestSort = (key) => {
    let direction = 'desc'
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc'
    }
    setSortConfig({ key, direction })
  }

  return (
    <div className="tab-page">
      <div className="section-head" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Vị thế Future đang mở
          <span className="count-badge">{positions.length}</span>
        </h2>
        <div className="section-actions" style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button className="sidebar-btn" style={{ padding: '8px', width: 'auto' }} onClick={onRefresh}>
            <IconRefresh style={{ width: 18 }} />
          </button>
          <button 
            className="btn-close" 
            style={{ background: 'var(--red)', color: '#fff', fontSize: '12px', padding: '10px 16px', fontWeight: '700' }}
            disabled={loadingAction === 'all-close' || positions.length === 0}
            onClick={handleCloseAll}
          >
            Đóng tất cả ({positions.length})
          </button>
        </div>
      </div>

      <div className="panel" style={{ paddingBottom: '20px' }}>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th className="sort-header" onClick={() => requestSort('symbol')}>Symbol / Hướng</th>
                <th className="sort-header" onClick={() => requestSort('size')}>Kích thước</th>
                <th>Giá vào / Mark</th>
                <th className="sort-header" onClick={() => requestSort('liq')}>Giá Liq. / Khoảng cách</th>
                <th className="sort-header" onClick={() => requestSort('pnl')}>Lãi Lỗ (ROE%)</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="center-state">
                    <div style={{ opacity: 0.5, marginBottom: '10px' }}>
                      <IconInfo style={{ width: 48, height: 48 }} />
                    </div>
                    Không có vị thế nào đang mở
                  </td>
                </tr>
              ) : (
                sortedList.map(p => {
                  const side = (p.side || p.positionSide || p.posSide || '').toUpperCase()
                  const isLong = side === 'BUY' || side === 'LONG' || side === '1'
                  const pnl = p.unrealizedPNL ?? p.unrealPnl ?? p.profit ?? 0
                  const rpnl = p.realizedPNL ?? p.realPnl ?? 0
                  const margin = parseFloat(p.margin ?? p.frozenAmount ?? p.initialMargin) || 1
                  const roe = ((parseFloat(pnl) / margin) * 100).toFixed(2)
                  const isBusy = loadingAction && loadingAction.startsWith(p.positionId)
                  
                  const markPrice = parseFloat(p.markPrice ?? tickers[p.symbol] ?? p.lastPrice)
                  const liqPrice = parseFloat(p.liquidationPrice || p.liqPrice || 0)
                  
                  let distPerc = 0
                  if (liqPrice > 0 && markPrice > 0) {
                    distPerc = (Math.abs(markPrice - liqPrice) / markPrice) * 100
                  }
                  
                  const isCritical = distPerc > 0 && distPerc < 5

                  return (
                    <tr key={p.positionId}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontWeight: 700 }}>{p.symbol}</div>
                          {metadataMap[p.symbol.replace('USDT', '')] && (
                            <span className="coin-full-name" style={{ fontSize: '10px' }}>
                              ({metadataMap[p.symbol.replace('USDT', '')].name})
                            </span>
                          )}
                        </div>
                        <div className="tag-list" style={{ marginBottom: '6px' }}>
                          {metadataMap[p.symbol.replace('USDT', '')]?.tags.map(t => (
                            <span key={t} className="coin-tag">{t}</span>
                          ))}
                        </div>
                        <span className={`badge badge-with-icon ${isLong ? 'b-long' : 'b-short'}`}>
                          {isLong ? <IconArrowUp /> : <IconArrowUp style={{ transform: 'rotate(180deg)' }} />}
                          {isLong ? 'LONG' : 'SHORT'} {p.leverage}x
                        </span>
                      </td>
                      <td>
                        <div>{fmt(p.qty ?? p.size)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-gray)' }}>
                          Margin: {fmt(margin, 2)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{fmt(p.avgOpenPrice ?? p.entryPrice)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-gray)' }}>{fmt(markPrice)}</div>
                      </td>
                      <td>
                        {liqPrice > 0 ? (
                          <>
                            <div className={`liq-price ${isCritical ? 'critical' : ''}`}>
                              {isCritical && <IconAlertTriangle className="liq-warning-icon" />}
                              {fmt(liqPrice)}
                            </div>
                            <div className="dist-bar-container">
                              <div 
                                className={`dist-bar-fill ${distPerc < 5 ? 'danger' : distPerc < 15 ? 'warning' : 'safe'}`}
                                style={{ width: `${Math.min(100, distPerc * 2)}%` }}
                              />
                            </div>
                            <div style={{ fontSize: '10px', color: isCritical ? 'var(--red)' : 'var(--text-gray)', fontWeight: isCritical ? 700 : 400 }}>
                              Cách: {distPerc.toFixed(2)}%
                            </div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-gray)' }}>--</span>
                        )}
                      </td>
                      <td>
                        <div className="pnl-row">
                          <div style={{ color: 'var(--text-dark)', fontSize: '13px', fontWeight: '500' }}>
                            UPnL: <span className={pnlCls(pnl)} style={{ fontWeight: '700' }}>{pnlFmt(pnl)}</span>
                            <span className={`roe-badge ${parseFloat(roe) >= 0 ? 'pos' : 'neg'}`}>
                              {roe}%
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-gray)', fontSize: '11px' }}>
                            RPnL: <span className={pnlCls(rpnl)} style={{ fontWeight: '600' }}>{fmt(rpnl, 2)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="action-group">
                          <div className="popover-container">
                            <button 
                              className="quick-action-btn"
                              onClick={() => setEditingTPSL(editingTPSL === p.positionId ? null : p.positionId)}
                            >
                              TP/SL
                            </button>
                            {editingTPSL === p.positionId && (
                              <div className="popover-content">
                                <div className="popover-field">
                                  <label>Take Profit (Chốt lãi)</label>
                                  <input type="number" placeholder="Giá TP..." />
                                </div>
                                <div className="popover-field">
                                  <label>Stop Loss (Cắt lỗ)</label>
                                  <input type="number" placeholder="Giá SL..." />
                                </div>
                                <div className="popover-actions">
                                  <button className="btn-be" style={{ flex: 1 }} onClick={() => setEditingTPSL(null)}>Hủy</button>
                                  <button className="btn-primary" style={{ flex: 1, padding: '8px', marginTop: 0, fontSize: '12px' }} onClick={() => toast('Tính năng đang phát triển', 'inf')}>Lưu</button>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <button
                            className="btn-be"
                            disabled={isBusy}
                            onClick={() => handleAction('be', {
                              positionId: p.positionId,
                              symbol: p.symbol,
                              avgOpenPrice: p.avgOpenPrice ?? p.entryPrice
                            })}
                          >
                            BE
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
