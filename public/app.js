/* ================================================================
   BITUNIX FUTURES DASHBOARD — APP.JS
   ================================================================ */

const BASE = '';           // same origin (proxy server)
let autoRefreshTimer = null;
let allPositions = [];
let allOrders    = [];
let allHistory   = [];
let allTrades    = [];

// ── Utilities ──────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  if (n === null || n === undefined || n === '') return '--';
  const num = parseFloat(n);
  if (isNaN(num)) return '--';
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtTime(ts) {
  if (!ts) return '--';
  const d = new Date(Number(ts));
  return d.toLocaleString('vi-VN', { hour12: false });
}

function pnlClass(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return '';
  return n > 0 ? 'text-green' : 'text-red';
}

function pnlSign(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return fmt(val);
  return (n > 0 ? '+' : '') + fmt(val);
}

function dirBadge(side) {
  const s = (side || '').toUpperCase();
  if (s === 'BUY' || s === 'LONG') return `<span class="dir-badge dir-long">LONG</span>`;
  return `<span class="dir-badge dir-short">SHORT</span>`;
}

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  const map = {
    new: ['status-open', 'Mới'],
    open: ['status-open', 'Mở'],
    partially_filled: ['status-partial', 'KP một phần'],
    filled: ['status-filled', 'Đã khớp'],
    canceled: ['status-canceled', 'Đã hủy'],
    cancelled: ['status-canceled', 'Đã hủy'],
    pending: ['status-pending', 'Chờ'],
  };
  const [cls, label] = map[s] || ['status-open', status || '--'];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function setConnected(ok) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  dot.className  = `status-dot ${ok ? 'connected' : 'error'}`;
  text.textContent = ok ? 'Đã kết nối' : 'Lỗi kết nối';
}

function updateClock() {
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('vi-VN');
}

// ── Fetch helpers ──────────────────────────────────────────────────

async function apiFetch(endpoint) {
  const res = await fetch(BASE + endpoint);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── ACCOUNT ───────────────────────────────────────────────────────

async function loadAccount() {
  try {
    const data = await apiFetch('/api/account');
    const acc  = data?.data || data?.result || data;
    // remove loading shimmer
    ['stat-balance','stat-equity','stat-pnl','stat-margin'].forEach(id => {
      document.getElementById(id)?.classList.remove('loading');
    });

    if (!acc || data?.code !== 0) {
      setConnected(false);
      toast('Không thể tải tài khoản: ' + (data?.msg || 'Lỗi API'), 'error');
      return;
    }

    setConnected(true);

    // Try all known Bitunix field name variants
    const available  = acc.available  ?? acc.availableBalance ?? acc.availAmt ?? acc.crossedAvailableBalance ?? '--';
    const equity     = acc.equity     ?? acc.totalEquity ?? acc.totalMarginBalance ?? acc.crossedAccountEquity ?? acc.crossedMarginBalance ?? '--';
    const unrealPnl  = acc.unrealizedPNL ?? acc.unrealPnl ?? acc.crossedUnrealizedPNL ?? acc.unrealizePnl ?? '--';
    const usedMargin = acc.frozen ?? acc.usedMargin ?? acc.crossedPositionInitialMargin ?? acc.initialMargin ?? '--';

    document.getElementById('val-balance').textContent     = fmt(available) + ' USDT';
    document.getElementById('val-balance-sub').textContent = 'Khả dụng';
    document.getElementById('val-equity').textContent      = fmt(equity) + ' USDT';
    document.getElementById('val-equity-sub').textContent  = 'Tổng tài sản';

    const pnlEl = document.getElementById('val-pnl');
    pnlEl.textContent = pnlSign(unrealPnl) + ' USDT';
    pnlEl.className   = 'stat-value ' + pnlClass(unrealPnl);

    document.getElementById('val-margin').textContent     = fmt(usedMargin) + ' USDT';
    document.getElementById('val-margin-sub').textContent = 'Đã ký quỹ';

  } catch (e) {
    setConnected(false);
    toast('Lỗi tải tài khoản: ' + e.message, 'error');
  }
}

// ── POSITIONS ─────────────────────────────────────────────────────

function renderPositionsTable(positions) {
  if (!positions.length) {
    return `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Không có vị thế nào đang mở</div>`;
  }

  const rows = positions.map(p => {
    const pnl       = p.unrealizedPNL ?? p.unrealPnl ?? p.profit ?? 0;
    const roe       = p.roe ?? p.achievedProfits ?? null;
    const side      = p.side || p.positionSide || p.posSide || '';
    const symbol    = p.symbol || '--';
    const size      = p.size ?? p.qty ?? p.total ?? p.holdVolume ?? '--';
    const entryPx   = p.entryPrice ?? p.avgPrice ?? p.openAvgPrice ?? p.avgOpenPrice ?? p.openPrice ?? '--';
    const markPx    = p.markPrice  ?? p.lastPrice ?? p.indexPrice ?? '--';
    const liqPx     = p.liquidationPrice ?? p.liqPrice ?? p.forceClosePrice ?? '--';
    const leverage  = p.leverage   ?? p.leverageLevel ?? '--';
    const margin    = p.margin     ?? p.frozenAmount ?? p.initialMargin ?? '--';

    return `<tr>
      <td class="label">${symbol}</td>
      <td>${dirBadge(side)}</td>
      <td>${fmt(size, 4)}</td>
      <td>${fmt(entryPx, 4)}</td>
      <td>${fmt(markPx, 4)}</td>
      <td>${fmt(liqPx, 4)}</td>
      <td>${leverage}x</td>
      <td class="${pnlClass(pnl)}">${pnlSign(pnl)}</td>
      <td class="${roe !== null ? pnlClass(roe) : ''}">${roe !== null ? pnlSign(roe) + '%' : '--'}</td>
      <td>${fmt(margin)}</td>
    </tr>`;
  }).join('');

  return `<table class="data-table">
    <thead><tr>
      <th>Symbol</th><th>Hướng</th><th>Kích thước</th>
      <th>Giá vào</th><th>Giá Mark</th><th>Thanh lý</th>
      <th>Đòn bẩy</th><th>Lãi/Lỗ</th><th>ROE%</th><th>Margin</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderOverviewPositions(positions) {
  const el = document.getElementById('overview-positions');
  document.getElementById('badge-positions').textContent = positions.length;
  if (!positions.length) {
    el.innerHTML = `<div class="empty-state" style="padding:30px">Không có vị thế mở</div>`;
    return;
  }
  el.innerHTML = positions.slice(0, 5).map(p => {
    const pnl  = p.unrealizedPNL ?? p.unrealPnl ?? 0;
    const side = p.side || p.positionSide || '';
    return `<div class="mini-card">
      <div class="mini-card-left">
        <div class="mini-symbol">${p.symbol} ${dirBadge(side)}</div>
        <div class="mini-meta">Vào: ${fmt(p.entryPrice ?? p.avgPrice, 4)} · ${(p.leverage ?? '--')}x</div>
      </div>
      <div class="mini-card-right">
        <div class="mini-value ${pnlClass(pnl)}">${pnlSign(pnl)} USDT</div>
        <div class="mini-sub">Unrealized PnL</div>
      </div>
    </div>`;
  }).join('');
}

async function loadPositions() {
  try {
    const data = await apiFetch('/api/positions');
    const list = data?.data?.positionList ?? data?.data ?? data?.result ?? [];
    allPositions = Array.isArray(list) ? list : [];

    renderOverviewPositions(allPositions);
    document.getElementById('positions-table-wrapper').innerHTML = renderPositionsTable(allPositions);
  } catch (e) {
    document.getElementById('positions-table-wrapper').innerHTML = `<div class="empty-state">Lỗi tải vị thế: ${e.message}</div>`;
  }
}

function filterPositions(q) {
  const filtered = allPositions.filter(p => (p.symbol || '').toLowerCase().includes(q.toLowerCase()));
  document.getElementById('positions-table-wrapper').innerHTML = renderPositionsTable(filtered);
}

// ── PENDING ORDERS ─────────────────────────────────────────────────

function renderOrdersTable(orders) {
  if (!orders.length) {
    return `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Không có lệnh chờ nào</div>`;
  }

  const rows = orders.map(o => `<tr>
    <td class="label">${o.symbol || '--'}</td>
    <td>${dirBadge(o.side)}</td>
    <td class="text-muted label">${o.orderType || '--'}</td>
    <td>${fmt(o.qty ?? o.size, 4)}</td>
    <td>${fmt(o.price, 4)}</td>
    <td>${fmt(o.filledQty ?? o.executedQty ?? 0, 4)}</td>
    <td>${statusBadge(o.status)}</td>
    <td class="text-muted">${fmtTime(o.createTime ?? o.cTime)}</td>
  </tr>`).join('');

  return `<table class="data-table">
    <thead><tr>
      <th>Symbol</th><th>Hướng</th><th>Loại</th>
      <th>Số lượng</th><th>Giá</th><th>Đã khớp</th><th>Trạng thái</th><th>Thời gian</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderOverviewOrders(orders) {
  const el = document.getElementById('overview-orders');
  document.getElementById('badge-orders').textContent = orders.length;
  if (!orders.length) {
    el.innerHTML = `<div class="empty-state" style="padding:30px">Không có lệnh chờ</div>`;
    return;
  }
  el.innerHTML = orders.slice(0, 5).map(o => `<div class="mini-card">
    <div class="mini-card-left">
      <div class="mini-symbol">${o.symbol} ${dirBadge(o.side)}</div>
      <div class="mini-meta">${o.orderType || '--'} · Qty: ${fmt(o.qty ?? o.size, 4)}</div>
    </div>
    <div class="mini-card-right">
      <div class="mini-value">${fmt(o.price, 4)}</div>
      <div class="mini-sub">${statusBadge(o.status)}</div>
    </div>
  </div>`).join('');
}

async function loadPendingOrders() {
  try {
    const data = await apiFetch('/api/orders/pending');
    const list = data?.data?.orderList ?? data?.data ?? data?.result ?? [];
    allOrders = Array.isArray(list) ? list : [];

    renderOverviewOrders(allOrders);
    document.getElementById('orders-table-wrapper').innerHTML = renderOrdersTable(allOrders);
  } catch (e) {
    document.getElementById('orders-table-wrapper').innerHTML = `<div class="empty-state">Lỗi tải lệnh chờ: ${e.message}</div>`;
  }
}

function filterOrders(q) {
  const filtered = allOrders.filter(o => (o.symbol || '').toLowerCase().includes(q.toLowerCase()));
  document.getElementById('orders-table-wrapper').innerHTML = renderOrdersTable(filtered);
}

// ── ORDER HISTORY ──────────────────────────────────────────────────

function renderHistoryTable(orders) {
  if (!orders.length) {
    return `<div class="empty-state">Không có lịch sử lệnh</div>`;
  }

  const rows = orders.map(o => `<tr>
    <td class="label">${o.symbol || '--'}</td>
    <td>${dirBadge(o.side)}</td>
    <td class="text-muted label">${o.orderType || '--'}</td>
    <td>${fmt(o.qty ?? o.size, 4)}</td>
    <td>${fmt(o.price, 4)}</td>
    <td>${fmt(o.avgPrice ?? o.avgFillPrice, 4)}</td>
    <td>${fmt(o.filledQty ?? o.executedQty, 4)}</td>
    <td>${statusBadge(o.status)}</td>
    <td class="text-muted">${fmtTime(o.createTime ?? o.cTime)}</td>
  </tr>`).join('');

  return `<table class="data-table">
    <thead><tr>
      <th>Symbol</th><th>Hướng</th><th>Loại</th>
      <th>Số lượng</th><th>Giá đặt</th><th>Giá TB</th>
      <th>Đã khớp</th><th>Trạng thái</th><th>Thời gian</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function loadOrderHistory() {
  try {
    const data = await apiFetch('/api/orders/history');
    const list = data?.data?.orderList ?? data?.data ?? data?.result ?? [];
    allHistory = Array.isArray(list) ? list : [];
    document.getElementById('history-table-wrapper').innerHTML = renderHistoryTable(allHistory);
  } catch (e) {
    document.getElementById('history-table-wrapper').innerHTML = `<div class="empty-state">Lỗi: ${e.message}</div>`;
  }
}

function filterHistory(q) {
  const filtered = allHistory.filter(o => (o.symbol || '').toLowerCase().includes(q.toLowerCase()));
  document.getElementById('history-table-wrapper').innerHTML = renderHistoryTable(filtered);
}

// ── TRADE HISTORY ──────────────────────────────────────────────────

function renderTradesTable(trades) {
  if (!trades.length) {
    return `<div class="empty-state">Không có lịch sử giao dịch</div>`;
  }

  const rows = trades.map(t => {
    const pnl = t.realizedPNL ?? t.profit ?? null;
    return `<tr>
      <td class="label">${t.symbol || '--'}</td>
      <td>${dirBadge(t.side)}</td>
      <td>${fmt(t.qty ?? t.size, 4)}</td>
      <td>${fmt(t.price ?? t.tradePrice, 4)}</td>
      <td class="${pnl !== null ? pnlClass(pnl) : ''}">${pnl !== null ? pnlSign(pnl) : '--'}</td>
      <td>${fmt(t.fee ?? t.tradeFee, 6)}</td>
      <td class="text-muted">${fmtTime(t.createTime ?? t.tradeTime)}</td>
    </tr>`;
  }).join('');

  return `<table class="data-table">
    <thead><tr>
      <th>Symbol</th><th>Hướng</th><th>Số lượng</th>
      <th>Giá khớp</th><th>Lãi/Lỗ thực</th><th>Phí</th><th>Thời gian</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderOverviewTrades(trades) {
  const el = document.getElementById('overview-trades');
  if (!trades.length) {
    el.innerHTML = `<div class="empty-state" style="padding:30px">Không có giao dịch gần đây</div>`;
    return;
  }
  const rows = trades.slice(0, 8).map(t => {
    const pnl = t.realizedPNL ?? t.profit ?? null;
    return `<tr>
      <td class="label">${t.symbol || '--'}</td>
      <td>${dirBadge(t.side)}</td>
      <td>${fmt(t.qty ?? t.size, 4)}</td>
      <td>${fmt(t.price ?? t.tradePrice, 4)}</td>
      <td class="${pnl !== null ? pnlClass(pnl) : ''}">${pnl !== null ? pnlSign(pnl) : '--'}</td>
      <td class="text-muted">${fmtTime(t.createTime ?? t.tradeTime)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Symbol</th><th>Hướng</th><th>Qty</th><th>Giá</th><th>PnL</th><th>Thời gian</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function loadTradeHistory() {
  try {
    const data = await apiFetch('/api/trades/history');
    const list = data?.data?.tradeList ?? data?.data ?? data?.result ?? [];
    allTrades = Array.isArray(list) ? list : [];
    renderOverviewTrades(allTrades);
    document.getElementById('trades-table-wrapper').innerHTML = renderTradesTable(allTrades);
  } catch (e) {
    document.getElementById('trades-table-wrapper').innerHTML = `<div class="empty-state">Lỗi: ${e.message}</div>`;
  }
}

function filterTrades(q) {
  const filtered = allTrades.filter(t => (t.symbol || '').toLowerCase().includes(q.toLowerCase()));
  document.getElementById('trades-table-wrapper').innerHTML = renderTradesTable(filtered);
}

// ── Main refresh ───────────────────────────────────────────────────

async function refreshAll() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');
  updateClock();

  await Promise.allSettled([
    loadAccount(),
    loadPositions(),
    loadPendingOrders(),
    loadOrderHistory(),
    loadTradeHistory(),
  ]);

  btn.classList.remove('spinning');
  updateClock();
}

// ── Tabs ───────────────────────────────────────────────────────────

const TAB_TITLES = {
  overview:  'Tổng quan',
  positions: 'Vị thế mở',
  orders:    'Lệnh chờ',
  history:   'Lịch sử lệnh',
  trades:    'Lịch sử giao dịch',
};

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tabId}`)?.classList.add('active');
  document.getElementById(`nav-${tabId}`)?.classList.add('active');
  document.getElementById('page-title').textContent = TAB_TITLES[tabId] || tabId;
}

// ── Sidebar ────────────────────────────────────────────────────────

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Auto refresh ───────────────────────────────────────────────────

function toggleAutoRefresh(enabled) {
  clearInterval(autoRefreshTimer);
  if (enabled) {
    autoRefreshTimer = setInterval(refreshAll, 15000); // every 15s
    toast('Tự động làm mới mỗi 15 giây', 'info');
  } else {
    toast('Đã tắt tự động làm mới', 'info');
  }
}

// ── Init ───────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

refreshAll();
toggleAutoRefresh(true);
