// Triangular arbitrage engine for one exchange.
//
// A triangle is a round trip through three markets that starts and ends in the
// same asset (e.g. USD -> BTC -> ETH -> USD). If the prices are momentarily
// inconsistent, the round trip ends with more than it started with. The engine
// finds every such triangle, re-evaluates all of them every few hundred
// milliseconds against live top-of-book quotes, and paper-trades the ones that
// still show a profit after fees.
//
// Everything here is simulation. No order is ever sent anywhere.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- triangles

// Builds every 3-leg cycle starting and ending in one of `startAssets`.
export function findTriangles(pairs, startAssets) {
  const byAsset = new Map(); // asset -> [{ market, other }]
  const marketKey = (a, b) => `${a}|${b}`;
  const marketByAssets = new Map();
  for (const p of pairs) {
    for (const [a, b] of [[p.base, p.quote], [p.quote, p.base]]) {
      if (!byAsset.has(a)) byAsset.set(a, []);
      byAsset.get(a).push({ market: p, other: b });
      marketByAssets.set(marketKey(a, b), p);
    }
  }

  const triangles = [];
  for (const start of startAssets) {
    for (const leg1 of byAsset.get(start) ?? []) {
      const a = leg1.other;
      for (const leg2 of byAsset.get(a) ?? []) {
        const b = leg2.other;
        if (b === start || b === a) continue;
        const m3 = marketByAssets.get(marketKey(b, start));
        if (!m3) continue;
        triangles.push({
          id: `${start}>${a}>${b}>${start}`,
          start,
          legs: [
            { from: start, to: a, market: leg1.market },
            { from: a, to: b, market: leg2.market },
            { from: b, to: start, market: m3 },
          ],
        });
      }
    }
  }
  return triangles;
}

// ------------------------------------------------------------------ pricing

// Converts `amount` of leg.from into leg.to at the current top of book.
// Returns { out, cap } where cap is how much of leg.from the top of book can
// absorb before we would start eating into worse prices.
function fillLeg(leg, quote, amount, feeRate) {
  const buyingBase = leg.to === leg.market.base;
  if (buyingBase) {
    // Pay quote, receive base at the ask.
    return { out: (amount / quote.ask) * (1 - feeRate), cap: quote.askQty * quote.ask };
  }
  // Sell base, receive quote at the bid.
  return { out: amount * quote.bid * (1 - feeRate), cap: quote.bidQty };
}

// Runs a triangle at `size` (in the start asset). Returns null when a quote is
// missing or stale. `liquidSize` is the size that fits inside the top of book.
export function evaluate(tri, quotes, size, feeRate, now, staleMs) {
  let amount = size;
  let liquidSize = size;
  const legs = [];
  for (const leg of tri.legs) {
    const q = quotes.get(leg.market.symbol);
    if (!q || now - q.ts > staleMs || !(q.bid > 0) || !(q.ask > 0)) return null;
    const { out, cap } = fillLeg(leg, q, amount, feeRate);
    // Scale this leg's cap back to the start asset so caps are comparable.
    liquidSize = Math.min(liquidSize, cap * (size / amount));
    legs.push({ symbol: leg.market.symbol, from: leg.from, to: leg.to, price: leg.to === leg.market.base ? q.ask : q.bid, in: amount, out });
    amount = out;
  }
  const net = amount - size;
  return { end: amount, net, netPct: (net / size) * 100, liquidSize, legs };
}

// ------------------------------------------------------------------- engine

export function createEngine({ name, label, pairs, feePct, config, ledger, log }) {
  const feeRate = feePct / 100;
  const quotes = new Map();
  const triangles = findTriangles(pairs, config.startAssets);
  const symbols = [...new Set(triangles.flatMap((t) => t.legs.map((l) => l.market.symbol)))];

  const state = {
    name,
    label,
    status: "starting",
    feePct,
    pairs: pairs.length,
    symbols: symbols.length,
    triangles: triangles.length,
    quotesLive: 0,
    scans: 0,
    lastScanAt: null,
    busy: false,
    // Rolling "today" stats (reset at local midnight).
    day: newDay(),
  };

  function newDay() {
    return {
      date: new Date().toDateString(),
      scans: 0,
      grossHits: 0,       // scans where at least one triangle was positive before fees
      netHits: 0,         // scans where at least one triangle beat fees + threshold
      bestGrossPct: null,
      bestNetPct: null,
      bestTriangle: null,
      hourly: Array.from({ length: 24 }, () => ({ gross: 0, net: 0 })),
      topTriangles: {},   // id -> { bestNetPct, hits }
    };
  }

  function onQuote(q) {
    if (!quotes.has(q.symbol)) state.quotesLive++;
    quotes.set(q.symbol, q);
  }

  function onStatus(status, detail) {
    if (status === "unsupported") { log(`${label}: ${detail} not supported on stream, ignoring`); return; }
    state.status = status;
    log(`${label}: ${status}${detail ? ` (${detail})` : ""}`);
  }

  // One pass over every triangle. Cheap: a few thousand triangles x 3 multiplies.
  function scan() {
    const now = Date.now();
    if (state.day.date !== new Date().toDateString()) state.day = newDay();
    const day = state.day;
    state.scans++;
    day.scans++;
    state.lastScanAt = now;

    const size = Math.min(config.maxTradeUsd, ledger.balance(name));
    let best = null;
    let bestGross = null;

    for (const tri of triangles) {
      const gross = evaluate(tri, quotes, size, 0, now, config.staleQuoteMs);
      if (!gross) continue;
      if (bestGross === null || gross.netPct > bestGross.netPct) bestGross = { ...gross, id: tri.id };
      if (gross.net <= 0) continue;

      const net = evaluate(tri, quotes, size, feeRate, now, config.staleQuoteMs);
      if (!net) continue;
      if (best === null || net.netPct > best.netPct) best = { ...net, tri };

      const top = day.topTriangles[tri.id] ?? (day.topTriangles[tri.id] = { bestNetPct: -Infinity, hits: 0 });
      top.hits++;
      if (net.netPct > top.bestNetPct) top.bestNetPct = net.netPct;
    }

    const hour = new Date().getHours();
    if (bestGross && bestGross.net > 0) {
      day.grossHits++;
      day.hourly[hour].gross++;
    }
    if (bestGross && (day.bestGrossPct === null || bestGross.netPct > day.bestGrossPct)) day.bestGrossPct = bestGross.netPct;
    if (best && (day.bestNetPct === null || best.netPct > day.bestNetPct)) {
      day.bestNetPct = best.netPct;
      day.bestTriangle = best.tri.id;
    }

    if (best && best.netPct >= config.minNetProfitPct && best.liquidSize >= config.minTradeUsd) {
      day.netHits++;
      day.hourly[hour].net++;
      if (!state.busy) paperTrade(best.tri, Math.min(size, best.liquidSize), best.netPct);
    }
  }

  // Simulates sending the three orders one after another. Each leg fills at
  // whatever the top of book is *after* the round-trip delay, which is how a
  // real bot loses the edge it saw: by the time the order lands, the price moved.
  async function paperTrade(tri, size, expectedPct) {
    state.busy = true;
    const startedAt = Date.now();
    try {
      let amount = size;
      const legs = [];
      for (const leg of tri.legs) {
        await sleep(config.latencyMs);
        const q = quotes.get(leg.market.symbol);
        if (!q) throw new Error(`lost quote for ${leg.market.symbol}`);
        const { out } = fillLeg(leg, q, amount, feeRate);
        legs.push({ symbol: leg.market.symbol, from: leg.from, to: leg.to, price: leg.to === leg.market.base ? q.ask : q.bid, in: amount, out });
        amount = out;
      }
      const trade = {
        exchange: name,
        at: new Date(startedAt).toISOString(),
        triangle: tri.id,
        size,
        end: amount,
        pnl: amount - size,
        pnlPct: ((amount - size) / size) * 100,
        expectedPct,
        legs,
      };
      ledger.record(trade);
      log(`${label}: ${tri.id} size $${size.toFixed(2)} expected ${expectedPct.toFixed(3)}% -> actual ${trade.pnlPct.toFixed(3)}% ($${trade.pnl.toFixed(2)})`);
    } catch (err) {
      log(`${label}: paper trade aborted: ${err.message}`);
    } finally {
      await sleep(config.cooldownMs);
      state.busy = false;
    }
  }

  return { state, symbols, onQuote, onStatus, scan };
}
