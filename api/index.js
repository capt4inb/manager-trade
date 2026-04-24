import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app  = express();

const API_KEY    = process.env.BITUNIX_API_KEY;
const SECRET_KEY = process.env.BITUNIX_SECRET_KEY;
const BASE_URL   = 'https://fapi.bitunix.com';

app.use(cors());
app.use(express.json());

// ── Crypto helpers ──────────────────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}
function nonce16() {
  return crypto.randomBytes(16).toString('hex');
}

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

app.get('/api/account', async (req, res) => {
  try {
    const data = await callBitunix('GET', '/api/v1/futures/account', { marginCoin: 'USDT' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/positions', async (req, res) => {
  try {
    const params = {};
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/position/get_pending_positions', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/pending', async (req, res) => {
  try {
    const params = { pageNum: 1, pageSize: 50 };
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/trade/get_pending_orders', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/history', async (req, res) => {
  try {
    const params = { pageNum: 1, pageSize: 50 };
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/trade/get_history_orders', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trades/history', async (req, res) => {
  try {
    const params = { pageNum: 1, pageSize: 50 };
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/trade/get_history_trades', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tickers', async (req, res) => {
  try {
    const params = {};
    if (req.query.symbol) params.symbol = req.query.symbol;
    const data = await callBitunix('GET', '/api/v1/futures/market/tickers', params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/positions/close', async (req, res) => {
  try {
    const { positionId, symbol } = req.body;
    if (!positionId || !symbol) {
      return res.status(400).json({ error: 'Missing positionId or symbol' });
    }
    const body = { positionId, symbol };
    const data = await callBitunix('POST', '/api/v1/futures/trade/flash_close_position', {}, body);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default app;
