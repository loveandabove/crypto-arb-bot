// Entry point: load config, connect to each enabled exchange, scan for
// triangular arbitrage, paper-trade, and serve the dashboard.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as kraken from "./exchanges/kraken.mjs";
import * as binanceus from "./exchanges/binanceus.mjs";
import { createEngine } from "./engine.mjs";
import { createLedger } from "./ledger.mjs";
import { startDashboard } from "./dashboard.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

// This program only simulates. Refuse to start in any other mode so a config
// typo can never turn it into something that touches real money.
if (config.mode !== "paper") {
  console.error(`mode "${config.mode}" is not supported — only "paper" exists. Nothing was started.`);
  process.exit(1);
}

const ADAPTERS = {
  kraken: { label: "Kraken", api: kraken },
  binanceus: { label: "Binance.US", api: binanceus },
};

const enabled = Object.entries(config.exchanges).filter(([, c]) => c.enabled).map(([name]) => name);
const ledger = createLedger({ dataDir: join(root, "data"), exchanges: enabled, startBalanceUsd: config.startBalanceUsd, log });

const engines = [];
for (const name of enabled) {
  const { label, api } = ADAPTERS[name];
  const exchangeConfig = config.exchanges[name];
  log(`${label}: loading pairs`);
  const pairs = await api.loadPairs();
  const engine = createEngine({ name, label, pairs, feePct: exchangeConfig.takerFeePct, config, ledger, log });
  log(`${label}: ${pairs.length} pairs, ${engine.state.triangles} triangles over ${engine.symbols.length} symbols`);
  api.connect(engine.symbols, engine.onQuote, engine.onStatus, exchangeConfig);
  setInterval(engine.scan, config.scanIntervalMs);
  engines.push(engine);
}

startDashboard({ port: config.port, config, engines, ledger, log });

// Hourly one-liner in the log so a week of output stays readable.
setInterval(() => {
  for (const { state } of engines) {
    const d = state.day;
    log(`${state.label}: balance $${ledger.balance(state.name).toFixed(2)} · today gross-hits ${d.grossHits} net-hits ${d.netHits} · best gross ${d.bestGrossPct?.toFixed(3) ?? "—"}% net ${d.bestNetPct?.toFixed(3) ?? "—"}%`);
  }
}, 3600000).unref();

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { ledger.save(); process.exit(0); });
