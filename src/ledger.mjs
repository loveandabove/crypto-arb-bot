// Paper ledger: one virtual USD balance per exchange, plus the trade history.
// Persisted to data/ so a restart does not wipe the week's results.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export function createLedger({ dataDir, exchanges, startBalanceUsd, log }) {
  mkdirSync(dataDir, { recursive: true });
  const statePath = join(dataDir, "ledger.json");
  const tradesPath = join(dataDir, "trades.jsonl");

  const state = { startedAt: new Date().toISOString(), balances: {}, trades: [] };
  for (const name of exchanges) state.balances[name] = startBalanceUsd;

  if (existsSync(statePath)) {
    try {
      const saved = JSON.parse(readFileSync(statePath, "utf8"));
      state.startedAt = saved.startedAt ?? state.startedAt;
      for (const name of exchanges) if (typeof saved.balances?.[name] === "number") state.balances[name] = saved.balances[name];
      state.trades = Array.isArray(saved.trades) ? saved.trades : [];
      log(`ledger: restored ${state.trades.length} trades from ${statePath}`);
    } catch (err) {
      log(`ledger: could not read ${statePath} (${err.message}), starting fresh`);
    }
  }

  let dirty = false;
  const save = () => {
    if (!dirty) return;
    // Keep the JSON snapshot small; the full history lives in trades.jsonl.
    const snapshot = { ...state, trades: state.trades.slice(-500) };
    writeFileSync(statePath, JSON.stringify(snapshot, null, 2));
    dirty = false;
  };
  setInterval(save, 10000).unref();
  process.on("exit", save);

  return {
    balance: (name) => state.balances[name],
    startBalance: startBalanceUsd,
    startedAt: () => state.startedAt,
    trades: (name) => state.trades.filter((t) => t.exchange === name),
    record(trade) {
      state.balances[trade.exchange] += trade.pnl;
      state.trades.push(trade);
      appendFileSync(tradesPath, JSON.stringify(trade) + "\n");
      dirty = true;
    },
    save,
  };
}
