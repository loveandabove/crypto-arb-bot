// Kraken spot market data: pair list via REST, live best bid/ask via WebSocket v2.
// Public endpoints only — no account or API key needed.

const REST = "https://api.kraken.com/0/public";
const WS = "wss://ws.kraken.com/v2";
const SUBSCRIBE_BATCH = 100;

// Kraken's REST pair names use legacy codes (XBT, XDG); WebSocket v2 uses the
// common ones. Normalise everything to the v2 form.
const ASSET_ALIASES = { XBT: "BTC", XDG: "DOGE" };
const normaliseAsset = (a) => ASSET_ALIASES[a] ?? a;

export async function loadPairs() {
  const res = await fetch(`${REST}/AssetPairs`);
  const json = await res.json();
  if (json.error?.length) throw new Error(`Kraken AssetPairs: ${json.error.join(", ")}`);
  const pairs = [];
  for (const info of Object.values(json.result)) {
    if (info.status !== "online" || !info.wsname) continue;
    const [base, quote] = info.wsname.split("/").map(normaliseAsset);
    pairs.push({ symbol: `${base}/${quote}`, base, quote });
  }
  return pairs;
}

// Streams quotes as { symbol, bid, ask, bidQty, askQty, ts }. Reconnects on drop.
export function connect(symbols, onQuote, onStatus) {
  let ws;
  let closed = false;
  let heartbeatTimer;

  const open = () => {
    ws = new WebSocket(WS);

    ws.onopen = () => {
      onStatus("connected");
      for (let i = 0; i < symbols.length; i += SUBSCRIBE_BATCH) {
        ws.send(JSON.stringify({
          method: "subscribe",
          params: { channel: "ticker", symbol: symbols.slice(i, i + SUBSCRIBE_BATCH), event_trigger: "bbo" },
        }));
      }
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.channel === "heartbeat") { resetHeartbeat(); return; }
      if (data.channel !== "ticker") {
        if (data.method === "subscribe" && data.success === false) onStatus("unsupported", data.symbol);
        return;
      }
      resetHeartbeat();
      const now = Date.now();
      for (const t of data.data) {
        onQuote({ symbol: t.symbol, bid: t.bid, ask: t.ask, bidQty: t.bid_qty, askQty: t.ask_qty, ts: now });
      }
    };

    ws.onclose = () => {
      onStatus("disconnected");
      if (!closed) setTimeout(open, 3000);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  };

  // Kraken sends a heartbeat every second; silence means the socket is dead.
  const resetHeartbeat = () => {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => { try { ws.close(); } catch {} }, 15000);
  };

  open();
  return () => { closed = true; clearTimeout(heartbeatTimer); try { ws.close(); } catch {} };
}
