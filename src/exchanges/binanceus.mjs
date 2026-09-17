// Binance.US spot market data: pair list + best bid/ask via REST polling.
// The all-market WebSocket stream is unreliable on Binance.US, and one REST
// call returns every symbol's top of book at once, so polling once a second
// is both simpler and cheaper. Public endpoints only — no account needed.

const REST = "https://api.binance.us/api/v3";

export async function loadPairs() {
  const res = await fetch(`${REST}/exchangeInfo`);
  const json = await res.json();
  return json.symbols
    .filter((s) => s.status === "TRADING" && s.isSpotTradingAllowed !== false)
    .map((s) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));
}

// Polls quotes as { symbol, bid, ask, bidQty, askQty, ts }.
export function connect(symbols, onQuote, onStatus, { pollIntervalMs = 1000 } = {}) {
  const wanted = new Set(symbols);
  let stopped = false;
  let failures = 0;

  const poll = async () => {
    if (stopped) return;
    try {
      const res = await fetch(`${REST}/ticker/bookTicker`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      const now = Date.now();
      for (const r of rows) {
        if (!wanted.has(r.symbol)) continue;
        onQuote({ symbol: r.symbol, bid: +r.bidPrice, ask: +r.askPrice, bidQty: +r.bidQty, askQty: +r.askQty, ts: now });
      }
      if (failures > 0) onStatus("connected");
      failures = 0;
    } catch (err) {
      failures++;
      if (failures === 3) onStatus("disconnected", err.message);
    }
    // Back off while the API is failing so we do not hammer it.
    setTimeout(poll, failures ? Math.min(pollIntervalMs * 2 ** failures, 30000) : pollIntervalMs);
  };

  onStatus("connected");
  poll();
  return () => { stopped = true; };
}
