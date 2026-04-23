import { useState } from 'react'

const fmt = (n, d = 2) => {
  const num = parseFloat(n)
  if (n === null || n === undefined || n === '' || isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function HistoryPage({ history, trades }) {
  const [subTab, setSubTab] = useState('trades') // 'orders' or 'trades'

  return (
    <div className="tab-page">
      <div className="section-head">
        <div style={{ display: 'flex', gap: '15px' }}>
          <h2 
            className={`section-title ${subTab === 'trades' ? '' : 'dim'}`} 
            style={{ cursor: 'pointer' }}
            onClick={() => setSubTab('trades')}
          >
            Lịch sử khớp lệnh
          </h2>
          <h2 
            className={`section-title ${subTab === 'orders' ? '' : 'dim'}`} 
            style={{ cursor: 'pointer' }}
            onClick={() => setSubTab('orders')}
          >
            Lịch sử lệnh
          </h2>
        </div>
      </div>

      <div className="panel">
        <div className="tbl-scroll">
          {subTab === 'trades' ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Hướng</th>
                  <th>Số lượng</th>
                  <th>Giá khớp</th>
                  <th>Lãi/Lỗ</th>
                  <th>Phí</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr><td colSpan="7" className="center-state">Không có lịch sử khớp lệnh</td></tr>
                ) : (
                  trades.map((t, idx) => {
                    const pnl = parseFloat(t.realizedPNL || 0)
                    return (
                      <tr key={idx}>
                        <td className="sans" style={{ fontWeight: 700 }}>{t.symbol}</td>
                        <td>
                          <span className={`badge ${(t.side || '').toUpperCase() === 'BUY' ? 'b-long' : 'b-short'}`}>
                            {(t.side || '').toUpperCase()}
                          </span>
                        </td>
                        <td>{fmt(t.qty || t.size, 4)}</td>
                        <td>{fmt(t.price || t.avgFillPrice, 4)}</td>
                        <td className={pnl > 0 ? 'green' : pnl < 0 ? 'red' : ''}>
                          {pnl > 0 ? '+' : ''}{fmt(pnl)}
                        </td>
                        <td className="dim">{fmt(t.fee, 4)}</td>
                        <td className="dim" style={{ fontSize: '11px' }}>
                          {new Date(Number(t.createTime || t.tradeTime)).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Hướng</th>
                  <th>Loại</th>
                  <th>Giá</th>
                  <th>Giá TB</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan="7" className="center-state">Không có lịch sử lệnh</td></tr>
                ) : (
                  history.map((o, idx) => (
                    <tr key={o.orderId || idx}>
                      <td className="sans" style={{ fontWeight: 700 }}>{o.symbol}</td>
                      <td>
                        <span className={`badge ${(o.side || '').toUpperCase() === 'BUY' ? 'b-long' : 'b-short'}`}>
                          {(o.side || '').toUpperCase()}
                        </span>
                      </td>
                      <td className="dim">{o.orderType}</td>
                      <td>{fmt(o.price, 4)}</td>
                      <td>{fmt(o.avgPrice || o.avgFillPrice, 4)}</td>
                      <td>
                        <span className={`badge ${o.status === 'FILLED' ? 'b-filled' : 'b-cancel'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="dim" style={{ fontSize: '11px' }}>
                        {new Date(Number(o.createTime || o.ctime)).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
