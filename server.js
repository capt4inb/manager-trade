import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

const API_KEY    = process.env.BITUNIX_API_KEY;
const SECRET_KEY = process.env.BITUNIX_SECRET_KEY;
const BASE_URL   = 'https://fapi.bitunix.com';

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Serve the React frontend
app.use(express.static(path.join(__dirname, 'client/dist')));

// ── Crypto helpers ──────────────────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}
function nonce16() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Bitunix double-SHA256 signature
 * digest = SHA256(nonce + timestamp + apiKey + sortedQueryStr + bodyStr)
 * sign   = SHA256(digest + secretKey)
 */
function buildSign(nonce, timestamp, queryParams = {}, bodyStr = '') {
  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map(k => `${k}${queryParams[k]}`)
    .join('');
  const digest = sha256(nonce + timestamp + API_KEY + sortedQuery + bodyStr);
  return sha256(digest + SECRET_KEY);
}

async function callBitunix(method, endpoint, queryParams = {}, body = null) {
  const nonce     = nonce16();
  const timestamp = Date.now().toString();
  const bodyStr   = body ? JSON.stringify(body) : '';
  const sign      = buildSign(nonce, timestamp, queryParams, bodyStr);

  const headers = {
    'api-key':      API_KEY,
    'nonce':        nonce,
    'timestamp':    timestamp,
    'sign':         sign,
    'Content-Type': 'application/json',
  };

  let url = `${BASE_URL}${endpoint}`;
  if (method === 'GET' && Object.keys(queryParams).length) {
    url += '?' + new URLSearchParams(queryParams).toString();
  }

  const options = { method, headers };
  if (method !== 'GET' && body) options.body = bodyStr;

  const res  = await fetch(url, options);
  const json = await res.json();
  return json;
}

// ── REST Routes ─────────────────────────────────────────────────────────────

// Account
app.get('/api/account', async (req, res) => {
  try {
    const data = await callBitunix('GET', '/api/v1/futures/account', { marginCoin: 'USDT' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Open positions
app.get('/api/positions', async (req, res) => {
  try {
    const params = {};
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/position/get_pending_positions', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pending orders
app.get('/api/orders/pending', async (req, res) => {
  try {
    const params = { pageNum: 1, pageSize: 50 };
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/trade/get_pending_orders', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Order history
app.get('/api/orders/history', async (req, res) => {
  try {
    const params = { pageNum: 1, pageSize: 50 };
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/trade/get_history_orders', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trade history
app.get('/api/trades/history', async (req, res) => {
  try {
    const params = { pageNum: 1, pageSize: 50 };
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/trade/get_history_trades', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tickers (market prices)
app.get('/api/tickers', async (req, res) => {
  try {
    const params = {};
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/market/tickers', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// ── Action: BE (Break Even) ──────────────────────────────────────────────────
// Sets stop-loss at entry price for a position
app.post('/api/positions/be', async (req, res) => {
  try {
    const { positionId, symbol, avgOpenPrice } = req.body;
    if (!positionId || !symbol || !avgOpenPrice) {
      return res.status(400).json({ error: 'Missing positionId, symbol or avgOpenPrice' });
    }
    const body = {
      symbol,
      positionId,
      slPrice: String(avgOpenPrice),
      slStopType: 'MARK_PRICE',
    };
    const data = await callBitunix('POST', '/api/v1/futures/tpsl/position/place_order', {}, body);
    console.log('[BE]', symbol, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Action: Quick Take Profit ────────────────────────────────────────────────
// Sets take-profit at given price for a position
app.post('/api/positions/tp', async (req, res) => {
  try {
    const { positionId, symbol, takeProfitPrice } = req.body;
    if (!positionId || !symbol || !takeProfitPrice) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const body = {
      symbol,
      positionId,
      tpPrice: String(takeProfitPrice),
      tpStopType: 'MARK_PRICE',
    };
    const data = await callBitunix('POST', '/api/v1/futures/tpsl/position/place_order', {}, body);
    console.log('[TP]', symbol, takeProfitPrice, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Action: Flash Close (market close position) ──────────────────────────────
app.post('/api/positions/close', async (req, res) => {
  try {
    const { positionId, symbol } = req.body;
    if (!positionId || !symbol) {
      return res.status(400).json({ error: 'Missing positionId or symbol' });
    }
    const body = { positionId, symbol };
    const data = await callBitunix('POST', '/api/v1/futures/trade/flash_close_position', {}, body);
    console.log('[CLOSE]', symbol, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Action: Place Trade Order ────────────────────────────────────────────────
app.post('/api/trade/place_order', async (req, res) => {
  try {
    const { symbol, side, orderType, qty, price } = req.body;
    
    const body = {
      symbol,
      side,
      tradeSide: 'OPEN',
      orderType,
      qty: String(qty)
    };
    if (orderType === 'LIMIT' && price) {
      body.price = String(price);
    }
    const data = await callBitunix('POST', '/api/v1/futures/trade/place_order', {}, body);
    console.log('[ORDER]', symbol, side, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Bitunix API Server → http://localhost:${PORT}\n`);
});
