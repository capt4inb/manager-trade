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

  const filtered = marketData.filter(m =>
    (m.symbol || '').toLowerCase().includes(search.toLowerCase())
  )

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
                <th>Symbol</th>
                <th>Giá hiện tại</th>
                <th>24h Thay đổi</th>
                <th>24h Cao nhất</th>
                <th>24h Thấp nhất</th>
                <th>Volume (USDT)</th>
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
