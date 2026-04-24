const fetch = require('node-fetch');

async function testOrder() {
  const payload = {
    symbol: 'BTCUSDT',
    side: 'BUY',
    positionSide: 'LONG',
    orderType: 'MARKET',
    qty: '0.001',
    marginCoin: 'USDT'
  };

  const res = await fetch('http://localhost:3000/api/trade/place_order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log("Response with strings:", text);

  const payload2 = {
    symbol: 'BTCUSDT',
    side: 1, // 1 for BUY?
    orderType: 'MARKET',
    qty: '0.001',
    marginCoin: 'USDT'
  };
  const res2 = await fetch('http://localhost:3000/api/trade/place_order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload2)
  });
  const text2 = await res2.text();
  console.log("Response with side=1:", text2);
}

testOrder();
