import { useState } from 'react'

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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="center-state">
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
