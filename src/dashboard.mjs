// Tiny status page: one card per exchange, refreshed every 2 seconds.
// No build step, no dependencies — the HTML is served straight from here.

import { createServer } from "node:http";

export function startDashboard({ port, config, engines, ledger, log }) {
  const snapshot = () => ({
    now: new Date().toISOString(),
    startedAt: ledger.startedAt(),
    config: {
      mode: config.mode,
      startBalanceUsd: config.startBalanceUsd,
      maxTradeUsd: config.maxTradeUsd,
      minNetProfitPct: config.minNetProfitPct,
      latencyMs: config.latencyMs,
    },
    exchanges: engines.map(({ state }) => {
      const trades = ledger.trades(state.name);
      const top = Object.entries(state.day.topTriangles)
        .sort((a, b) => b[1].bestNetPct - a[1].bestNetPct)
        .slice(0, 8)
        .map(([id, t]) => ({ id, bestNetPct: t.bestNetPct, hits: t.hits }));
      return {
        ...state,
        day: { ...state.day, topTriangles: top },
        balance: ledger.balance(state.name),
        pnl: ledger.balance(state.name) - ledger.startBalance,
        tradesTotal: trades.length,
        recentTrades: trades.slice(-10).reverse(),
      };
    }),
  });

  const server = createServer((req, res) => {
    if (req.url === "/api/state") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(snapshot()));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
  });
  server.listen(port, () => log(`dashboard: http://localhost:${port}`));
  return server;
}

const PAGE = /* html */ `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arbitraj Botu — Sanal</title>
<style>
  :root { --bg:#0f1115; --card:#181b22; --line:#262a33; --fg:#e8eaf0; --muted:#8a91a0; --up:#3ecf8e; --down:#ff6b6b; --accent:#7aa2ff; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { padding:20px 24px 8px; display:flex; flex-wrap:wrap; gap:8px 24px; align-items:baseline; }
  h1 { margin:0; font-size:20px; }
  .tag { font-size:12px; color:var(--muted); }
  .warn { margin:0 24px 12px; padding:10px 14px; border:1px solid #5a4a1a; background:#2a2412; border-radius:8px; font-size:13px; }
  main { display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:16px; padding:0 24px 32px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:18px 20px; }
  .card h2 { margin:0 0 4px; font-size:18px; display:flex; justify-content:space-between; align-items:center; }
  .dot { width:10px; height:10px; border-radius:50%; background:var(--muted); display:inline-block; margin-right:8px; }
  .dot.connected { background:var(--up); }
  .dot.disconnected { background:var(--down); }
  .sub { color:var(--muted); font-size:12px; margin-bottom:14px; }
  .big { font-size:34px; font-weight:600; margin:6px 0 2px; }
  .pnl { font-size:16px; font-weight:600; }
  .up { color:var(--up); } .down { color:var(--down); }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; margin:14px 0; }
  .stat .k { color:var(--muted); font-size:12px; }
  .stat .v { font-size:17px; font-weight:600; }
  h3 { font-size:13px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin:18px 0 8px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  td, th { padding:5px 4px; border-bottom:1px solid var(--line); text-align:left; white-space:nowrap; }
  th { color:var(--muted); font-weight:500; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .empty { color:var(--muted); font-size:13px; padding:6px 0; }
  .bars { display:flex; gap:2px; height:36px; align-items:flex-end; }
  .bars div { flex:1; background:var(--accent); opacity:.35; min-height:1px; border-radius:2px 2px 0 0; }
  .bars div.net { opacity:1; }
  code { background:#0b0d11; padding:1px 5px; border-radius:4px; font-size:12px; }
</style>
</head>
<body>
<header>
  <h1>Arbitraj Botu</h1>
  <span class="tag" id="mode"></span>
  <span class="tag" id="since"></span>
  <span class="tag" id="clock"></span>
</header>
<div class="warn">Sanal mod: gerçek fiyat, sahte para. Hiçbir borsaya emir gönderilmiyor. Rakamlar "gerçek olsaydı ne olurdu" tahminidir.</div>
<main id="cards"></main>
<script>
const fmtUsd = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => n == null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(3) + "%";
const cls = (n) => n > 0 ? "up" : n < 0 ? "down" : "";
const statusText = { connected: "bağlı", disconnected: "bağlantı yok", starting: "başlıyor" };
const time = (iso) => new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function card(x) {
  const d = x.day;
  const maxBar = Math.max(1, ...d.hourly.map(h => h.gross));
  const bars = d.hourly.map((h, i) => '<div class="' + (h.net ? "net" : "") + '" style="height:' + Math.max(3, h.gross / maxBar * 100) + '%" title="' + i + ':00 — komisyon öncesi ' + h.gross + ', komisyon sonrası ' + h.net + '"></div>').join("");
  const top = d.topTriangles.length
    ? '<table><tr><th>Üçgen</th><th class="num">En iyi net</th><th class="num">Görülme</th></tr>' + d.topTriangles.map(t => '<tr><td><code>' + t.id + '</code></td><td class="num ' + cls(t.bestNetPct) + '">' + fmtPct(t.bestNetPct) + '</td><td class="num">' + t.hits + '</td></tr>').join("") + '</table>'
    : '<div class="empty">Bugün komisyon öncesi bile artıda kalan üçgen görülmedi.</div>';
  const trades = x.recentTrades.length
    ? '<table><tr><th>Saat</th><th>Üçgen</th><th class="num">Tutar</th><th class="num">Beklenen</th><th class="num">Gerçek</th><th class="num">Kâr</th></tr>' + x.recentTrades.map(t => '<tr><td>' + time(t.at) + '</td><td><code>' + t.triangle + '</code></td><td class="num">' + fmtUsd(t.size) + '</td><td class="num">' + fmtPct(t.expectedPct) + '</td><td class="num ' + cls(t.pnlPct) + '">' + fmtPct(t.pnlPct) + '</td><td class="num ' + cls(t.pnl) + '">' + fmtUsd(t.pnl) + '</td></tr>').join("") + '</table>'
    : '<div class="empty">Henüz işlem yok. Bot komisyonu geçen fırsat bulunca burada görünür.</div>';
  return '<section class="card">'
    + '<h2><span><span class="dot ' + x.status + '"></span>' + x.label + '</span><span class="tag">' + (statusText[x.status] || x.status) + '</span></h2>'
    + '<div class="sub">' + x.pairs + ' parite · ' + x.triangles + ' üçgen · ' + x.quotesLive + '/' + x.symbols + ' canlı fiyat · komisyon %' + x.feePct.toFixed(2) + ' · tarama ' + x.scans.toLocaleString("tr-TR") + '</div>'
    + '<div class="big">' + fmtUsd(x.balance) + '</div>'
    + '<div class="pnl ' + cls(x.pnl) + '">' + (x.pnl >= 0 ? "+" : "") + fmtUsd(x.pnl) + ' · ' + x.tradesTotal + ' işlem</div>'
    + '<div class="grid">'
    + '<div class="stat"><div class="k">Komisyon öncesi fırsat (bugün)</div><div class="v">' + d.grossHits.toLocaleString("tr-TR") + '</div></div>'
    + '<div class="stat"><div class="k">Komisyon sonrası fırsat (bugün)</div><div class="v ' + (d.netHits ? "up" : "") + '">' + d.netHits.toLocaleString("tr-TR") + '</div></div>'
    + '<div class="stat"><div class="k">En iyi fark, komisyon öncesi</div><div class="v ' + cls(d.bestGrossPct) + '">' + fmtPct(d.bestGrossPct) + '</div></div>'
    + '<div class="stat"><div class="k">En iyi fark, komisyon sonrası</div><div class="v ' + cls(d.bestNetPct) + '">' + fmtPct(d.bestNetPct) + '</div></div>'
    + '</div>'
    + '<h3>Saatlik fırsat dağılımı (soluk: komisyon öncesi, parlak: sonrası)</h3><div class="bars">' + bars + '</div>'
    + '<h3>Bugünün en iyi üçgenleri</h3>' + top
    + '<h3>Son işlemler</h3>' + trades
    + '</section>';
}

async function refresh() {
  try {
    const s = await (await fetch("/api/state", { cache: "no-store" })).json();
    document.getElementById("mode").textContent = "mod: " + (s.config.mode === "paper" ? "sanal" : s.config.mode) + " · başlangıç " + fmtUsd(s.config.startBalanceUsd) + " · işlem başı en çok " + fmtUsd(s.config.maxTradeUsd) + " · eşik " + fmtPct(s.config.minNetProfitPct) + " · gecikme " + s.config.latencyMs + " ms";
    document.getElementById("since").textContent = "kayıt başlangıcı: " + new Date(s.startedAt).toLocaleString("tr-TR");
    document.getElementById("clock").textContent = "güncellendi " + time(s.now);
    document.getElementById("cards").innerHTML = s.exchanges.map(card).join("");
  } catch (e) {
    document.getElementById("clock").textContent = "bot cevap vermiyor";
  }
}
refresh();
setInterval(refresh, 2000);
</script>
</body>
</html>`;
