import { useState } from 'react'

const fmt = (n, d = 4) => {
  const num = parseFloat(n)
  if (n === null || n === undefined || n === '' || isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function OrdersPage({ orders }) {
  const [search, setSearch] = useState('')

  const filtered = orders.filter(o =>
    (o.symbol || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="tab-page">
      <div className="section-head">
        <h2 className="section-title">
          Lệnh chờ khớp
          <span className="count-badge yellow">{filtered.length}</span>
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
                <th>Loại</th>
                <th>Số lượng</th>
                <th>Giá</th>
                <th>Đã khớp</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="center-state">
                    Không có lệnh chờ nào
                  </td>
                </tr>
              ) : (
                filtered.map((o, idx) => (
                  <tr key={o.orderId || idx}>
                    <td className="sans" style={{ fontWeight: 700 }}>{o.symbol}</td>
                    <td>
                      <span className={`badge ${(o.side || '').toUpperCase() === 'BUY' ? 'b-long' : 'b-short'}`}>
                        {(o.side || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="dim">{o.orderType || 'LIMIT'}</td>
                    <td>{fmt(o.qty ?? o.size)}</td>
                    <td>{fmt(o.price)}</td>
                    <td>{fmt(o.filledQty ?? o.executedQty ?? 0)}</td>
                    <td>
                      <span className="badge b-partial">{o.status}</span>
                    </td>
                    <td className="dim" style={{ fontSize: '11px' }}>
                      {new Date(Number(o.createTime || o.ctime)).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
